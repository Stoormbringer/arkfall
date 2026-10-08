import { describe, expect, it } from 'vitest';
import { enemyCount, enemyDmg, enemyHp, enemySpd, shardsForRank, tierMult, xpMob, xpToNext } from '../../src/core/formulas';

describe('кривая опыта (GDD §5.2)', () => {
  it('сшита без скачков на 100 и 300', () => {
    expect(xpToNext(100)).toBeCloseTo(60_000, 0);
    expect(xpToNext(300)).toBeCloseTo(540_000, 0);
  });
  it('монотонно растёт', () => {
    for (let l = 1; l < 1000; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
  });
  it('даёт ~2,43 млн до 100 уровня', () => {
    let sum = 0;
    for (let l = 1; l < 100; l++) sum += xpToNext(l);
    expect(sum).toBeGreaterThan(2.3e6);
    expect(sum).toBeLessThan(2.5e6);
  });
});

describe('доход опыта', () => {
  it('Тир 1 комната 15 → 58 за моба', () => expect(xpMob(1, 15)).toBeCloseTo(58, 0));
  it('множитель Тира непрерывен на границе 10', () => {
    expect(tierMult(10)).toBeCloseTo(5.5, 5);
    expect(tierMult(11)).toBeCloseTo(5.5 * 1.15, 5);
  });
  it('~870 осколков ≈ Ранг 12', () => {
    let sum = 0;
    for (let k = 1; k <= 12; k++) sum += shardsForRank(k);
    expect(sum).toBeGreaterThan(780);
    expect(sum).toBeLessThan(900);
  });
});

describe('статы врагов (GDD §6.2)', () => {
  it('HP растёт с Тиром быстрее урона (hpTierExp > dmgTierExp)', () => expect(enemyHp(1, 10, 0)).toBeGreaterThan(enemyDmg(1, 10, 0)));
  it('скорость упирается в +30 %', () => expect(enemySpd(100, 50)).toBe(130));
  it('количество упирается в ×2', () => expect(enemyCount(10, 50, 0)).toBe(20));
});
