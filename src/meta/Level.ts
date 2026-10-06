import { xpToNext } from '../core/formulas';
import F from '../data/formulas.json';

/** Уровень персонажа по накопленному опыту (GDD §5.2–5.3). */
export function levelFromXp(totalXp: number): { level: number; into: number; need: number } {
  let level = 1, rest = totalXp;
  for (;;) {
    const need = xpToNext(level);
    if (rest < need) return { level, into: rest, need };
    rest -= need;
    level++;
  }
}

/** Милстоуны (10, 20 … 100), пройденные между двумя значениями уровня */
export function milestonesCrossed(fromLevel: number, toLevel: number): number[] {
  return (F.milestones.skillLevels as number[]).filter((m) => m > fromLevel && m <= toLevel);
}
