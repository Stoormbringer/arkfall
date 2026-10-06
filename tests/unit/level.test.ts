import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { levelFromXp, milestonesCrossed } from '../../src/meta/Level';
import { IMPLEMENTED_SKILLS, offerSkills, SKILLS } from '../../src/meta/skillChoice';

describe('уровень персонажа (GDD §5)', () => {
  it('0 опыта = 1 уровень; 6 663 опыта = 10 уровень', () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(6_662).level).toBe(9);
    expect(levelFromXp(6_663).level).toBe(10);
  });
  it('первый забег (~51 тыс. опыта на Тире 1) даёт ~21 уровень', () => {
    const l = levelFromXp(51_300).level;
    expect(l).toBeGreaterThanOrEqual(20);
    expect(l).toBeLessThanOrEqual(22);
  });
  it('милстоуны между уровнями', () => {
    expect(milestonesCrossed(1, 21)).toEqual([10, 20]);
    expect(milestonesCrossed(21, 31)).toEqual([30]);
    expect(milestonesCrossed(10, 10)).toEqual([]);
  });
});

describe('выбор скилла на милстоуне (GDD §5.7, §C.1)', () => {
  it('3 скилла из разных категорий, ни одного уже взятого', () => {
    for (let seed = 1; seed < 200; seed++) {
      const o = offerSkills(new Rng(seed), ['dash_cut'], 10);
      expect(o.length).toBe(3);
      expect(o).not.toContain('dash_cut');
      expect(new Set(o.map((id) => SKILLS[id].category)).size).toBe(3);
    }
  });
  it('не предлагает скиллы с offerFrom выше уровня', () => {
    for (let seed = 1; seed < 100; seed++)
      for (const id of offerSkills(new Rng(seed), [], 10)) expect(SKILLS[id].offerFrom).toBeLessThanOrEqual(10);
  });
  it('все реализованные скиллы есть в каталоге', () => {
    for (const id of IMPLEMENTED_SKILLS) expect(SKILLS[id]).toBeDefined();
  });
});
