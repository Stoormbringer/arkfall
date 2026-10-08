import F from '../data/formulas.json';
import { Rng } from '../core/rng';
import type { FacetRarity } from '../data/types';
import { ITEMS, rollItem } from '../run/loot';
import { levelFromXp } from './Level';
import { saveProgress, type Progress } from './Progress';

/** Доход Эхо линеен по Тиру (GDD §8.1) */
export const echoTierMult = (tier: number) => 1 + F.echo.tierStep * (tier - 1);
export const echoForEliteRoom = (tier: number) => Math.round(F.echo.eliteRoom * echoTierMult(tier));
export const echoForBoss = (act: number, tier: number) =>
  Math.round(F.echo.bossByAct[Math.min(act, F.echo.bossByAct.length) - 1] * echoTierMult(tier));
/** Итог забега: +30 % только живым (GDD §8.2) */
export const echoRunTotal = (earned: number, won: boolean) => Math.round(won ? earned * (1 + F.echo.winBonus) : earned);

/** Сброс скиллов: 50 Эхо, после 100 уровня × L/100 (GDD §8.3) */
export const skillResetPrice = (level: number) => Math.round(F.echo.skillReset.base * Math.max(1, level / F.echo.skillReset.scaleFromLevel));

/** Цены лавки хаба привязаны к открытому Тиру игрока, не к накоплениям (GDD §8.4) */
export const hubItemPrice = (id: string, tier: number) => Math.round(F.echo.hubShop.itemPrice[ITEMS[id].rarity as FacetRarity] * echoTierMult(tier));

export interface HubShop { cycle: number; stock: (string | null)[] }

/** Ассортимент меняется каждые N забегов; детерминирован номером цикла, купленное не возвращается до смены */
export function hubShopFor(p: Progress): HubShop {
  const cycle = Math.floor(p.runs / F.echo.hubShop.rotateEveryRuns);
  if (p.hubShop && p.hubShop.cycle === cycle) return p.hubShop;
  const rng = new Rng(cycle * 7919 + 17);
  const stock: string[] = [];
  for (let i = 0; i < F.echo.hubShop.itemSlots; i++) { const id = rollItem(rng, p.unlockedTier, stock); if (id) stock.push(id); }
  return { cycle, stock };
}

export function buyHubItem(p: Progress, index: number): Progress | null {
  const shop = hubShopFor(p);
  const id = shop.stock[index];
  if (!id) return null;
  const price = hubItemPrice(id, p.unlockedTier);
  if (p.echo < price) return null;
  const stock = [...shop.stock]; stock[index] = null;
  const next: Progress = { ...p, echo: p.echo - price, inventory: [...p.inventory, id], hubShop: { cycle: shop.cycle, stock } };
  saveProgress(next);
  return next;
}

/** Сброс: скиллы снимаются, все пройденные милстоуны выбираются заново (GDD §5.1) */
export function resetSkills(p: Progress): Progress | null {
  const level = levelFromXp(p.xp).level;
  const price = skillResetPrice(level);
  if (p.echo < price || p.skills.length === 0) return null;
  const milestones = (F.milestones.skillLevels as number[]).filter((m) => m <= level);
  const next: Progress = { ...p, echo: p.echo - price, skills: [], pendingMilestones: milestones };
  saveProgress(next);
  return next;
}
