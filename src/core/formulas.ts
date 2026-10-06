import F from '../data/formulas.json';

/** Опыт до следующего уровня, GDD §5.2 */
export function xpToNext(level: number): number {
  const { early, mid, late } = F.xp;
  if (level <= early.maxLevel) return early.k * level ** early.exp;
  if (level <= mid.maxLevel) return mid.k * (level / early.maxLevel) ** mid.exp;
  return late.k * (level / mid.maxLevel) ** late.exp;
}

/** Множитель дохода опыта от Тира */
export function tierMult(tier: number): number {
  const { tierLinearStep, tierLinearUntil, tierExpBase } = F.xp;
  if (tier <= tierLinearUntil) return 1 + tierLinearStep * (tier - 1);
  const atCap = 1 + tierLinearStep * (tierLinearUntil - 1);
  return atCap * tierExpBase ** (tier - tierLinearUntil);
}

export function xpMob(tier: number, room: number): number {
  return F.xp.mobBase * tierMult(tier) * (1 + F.xp.roomGrowth * room);
}
export const xpElite = (tier: number, room: number) => xpMob(tier, room) * F.xp.eliteMult;
export const xpBoss = (tier: number, room: number) =>
  xpMob(tier, room) * F.xp.bossMult + F.xp.bossBonus * tierMult(tier);

/** Осколки до Ранга k */
export const shardsForRank = (k: number) => F.shards.k * k ** F.shards.exp;

/** Статы врагов, GDD §6.2 */
export const enemyHp = (base: number, tier: number, room: number) =>
  base * (1 + F.enemy.hpRoomGrowth * room) * tier ** F.enemy.hpTierExp;
/** Тяжёлые враги (роль tank) растут по комнатам мягче — иначе Молот к 6-й комнате уходит из коридора TTK */
export const enemyHpHeavy = (base: number, tier: number, room: number) =>
  base * (1 + F.enemy.hpRoomGrowthHeavy * room) * tier ** F.enemy.hpTierExp;
export const enemyDmg = (base: number, tier: number, room: number) =>
  base * (1 + F.enemy.dmgRoomGrowth * room) * tier ** F.enemy.dmgTierExp;
export const enemySpd = (base: number, tier: number) =>
  base * Math.min(F.enemy.spdCap, 1 + F.enemy.spdTierStep * (tier - 1));
export const enemyCount = (base: number, tier: number, room: number) =>
  Math.round(base * (1 + F.enemy.countRoomGrowth * room) * Math.min(F.enemy.countCap, 1 + F.enemy.countTierStep * (tier - 1)));

/** Телеграф укорачивается с Тиром, но не ниже минимума (честность, §6.7) */
export const telegraphSec = (baseSec: number, tier: number) =>
  Math.max(F.telegraph.minSeconds, baseSec - F.telegraph.tierStep * (tier - 1));

export const ttkTarget = F.ttkTarget;
