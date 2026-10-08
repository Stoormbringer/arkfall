import F from '../data/formulas.json';
import SKILLS from '../data/skills.json';
import type { Mods, SkillMods } from '../run/mods';
import type { UpgradeSlot } from '../data/types';
import { levelFromXp } from './Level';
import { saveProgress, type Progress } from './Progress';

/** Прокачка скиллов: id скилла → слот → ранг (GDD §C.3, схема рангов — formulas.upgradeSlots) */
export type UpgradableSlot = Exclude<UpgradeSlot, 'unique'>;
export type Upgrades = Record<string, Partial<Record<UpgradableSlot, number>>>;

/** Закалка по уровню: урон, HP, откаты (GDD §5 — малый постоянный рост) */
export function heroGrowth(level: number) {
  const g = F.heroGrowth;
  const L = Math.max(0, level - 1);
  return { damageMult: 1 + g.damagePerLevel * L, hpDelta: Math.round(g.hpPerLevel * L), cooldownMult: 1 - Math.min(g.cooldownCap, g.cooldownPerLevel * L) };
}

export function applyHeroGrowth(m: Mods, level: number) {
  const g = heroGrowth(level);
  m.damageMult *= g.damageMult; m.maxHpDelta += g.hpDelta; m.cooldownMult *= g.cooldownMult;
}

export const maxRank = (slot: UpgradableSlot) => (F.upgradeSlots as Record<string, number[]>)[slot].length;
export const upgradePointsTotal = (level: number) => Math.floor(level / F.heroGrowth.upgradePointEveryLevels);
export const upgradePointsSpent = (u: Upgrades) => Object.values(u).reduce((a, s) => a + Object.values(s).reduce((x, y) => x + (y ?? 0), 0), 0);
export const upgradePointsFree = (p: Progress) => upgradePointsTotal(levelFromXp(p.xp).level) - upgradePointsSpent(p.upgrades ?? {});

/** Суммарный эффект рангов слота: проценты складываются по схеме, штучные — по единицам */
export function slotValue(slot: UpgradableSlot, rank: number): number {
  const steps = (F.upgradeSlots as Record<string, number[]>)[slot];
  let v = 0; for (let i = 0; i < Math.min(rank, steps.length); i++) v += steps[i];
  return v;
}

export function skillModsFor(u: Upgrades, id: string): SkillMods {
  const s = u[id] ?? {};
  return {
    damage: 1 + slotValue('damage', s.damage ?? 0), cooldown: 1 + slotValue('cooldown', s.cooldown ?? 0), area: 1 + slotValue('area', s.area ?? 0),
    duration: 1 + slotValue('duration', s.duration ?? 0), projectiles: slotValue('projectiles', s.projectiles ?? 0), charges: slotValue('charges', s.charges ?? 0),
  };
}

export function applyUpgrades(m: Mods, u: Upgrades) {
  for (const id of Object.keys(u)) m.skill[id] = skillModsFor(u, id);
}

/** Потратить очко: слот должен быть у скилла, ранг — ниже потолка, очко — свободно */
export function spendUpgrade(p: Progress, id: string, slot: UpgradableSlot): Progress | null {
  const def = (SKILLS as Record<string, { upgradeSlots?: string[] }>)[id];
  if (!def || !def.upgradeSlots?.includes(slot) || !p.skills.includes(id)) return null;
  if (upgradePointsFree(p) <= 0) return null;
  const cur = p.upgrades?.[id]?.[slot] ?? 0;
  if (cur >= maxRank(slot)) return null;
  const upgrades: Upgrades = { ...(p.upgrades ?? {}), [id]: { ...(p.upgrades?.[id] ?? {}), [slot]: cur + 1 } };
  const next = { ...p, upgrades };
  saveProgress(next);
  return next;
}
