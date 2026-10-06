import { describe, expect, it } from 'vitest';
import SKILLS_RAW from '../../src/data/skills.json';
import FACETS_RAW from '../../src/data/facets.json';
import F from '../../src/data/formulas.json';
import type { FacetDef, SkillDef } from '../../src/data/types';

const SKILLS = Object.fromEntries(Object.entries(SKILLS_RAW).filter(([k]) => !k.startsWith('_'))) as Record<string, SkillDef>;
const FACETS = Object.fromEntries(Object.entries(FACETS_RAW).filter(([k]) => !k.startsWith('_'))) as Record<string, FacetDef>;

describe('правила каталога скиллов (GDD §C)', () => {
  it('у каждого скилла ≥ 3 синергии, и все они существуют', () => {
    for (const [id, s] of Object.entries(SKILLS)) {
      expect(s.synergies.length, id).toBeGreaterThanOrEqual(3);
      for (const t of s.synergies) expect(SKILLS[t], `${id} → ${t}`).toBeDefined();
      expect(s.synergies, id).not.toContain(id);
    }
  });
  it('у каждого скилла ≥ 1 контрмера', () => {
    for (const [id, s] of Object.entries(SKILLS)) expect(s.counters.length, id).toBeGreaterThanOrEqual(1);
  });
  it('синергии симметричны хотя бы в одну сторону для каждой пары', () => {
    for (const [id, s] of Object.entries(SKILLS))
      for (const t of s.synergies) expect(SKILLS[t].synergies.includes(id) || s.synergies.includes(t), `${id}↔${t}`).toBe(true);
  });
  it('на первом милстоуне доступно ≥ 3 разных категорий', () => {
    const cats = new Set(Object.values(SKILLS).filter((s) => s.offerFrom <= F.milestones.skillLevels[0]).map((s) => s.category));
    expect(cats.size).toBeGreaterThanOrEqual(F.milestones.offerCount);
  });
  it('все слоты улучшений описаны в схеме', () => {
    for (const [id, s] of Object.entries(SKILLS))
      for (const slot of s.upgradeSlots) expect(F.upgradeSlots[slot], `${id}:${slot}`).toBeDefined();
  });
});

describe('правила каталога Граней (GDD §C.4)', () => {
  it('привязанные Грани ссылаются на существующие скиллы', () => {
    for (const [id, f] of Object.entries(FACETS)) if (f.binds) expect(SKILLS[f.binds], id).toBeDefined();
  });
  it('у каждого скилла ≥ 2 привязанные Грани', () => {
    for (const id of Object.keys(SKILLS))
      expect(Object.values(FACETS).filter((f) => f.binds === id).length, id).toBeGreaterThanOrEqual(2);
  });
  it('диких Граней достаточно, чтобы третий слот не повторялся за акт', () => {
    expect(Object.values(FACETS).filter((f) => f.binds === null).length).toBeGreaterThanOrEqual(8);
  });
  it('редкости распределены: обычных больше, чем редких, редких больше, чем эпических', () => {
    const n = (r: FacetDef['rarity']) => Object.values(FACETS).filter((f) => f.rarity === r).length;
    expect(n('common')).toBeGreaterThan(n('rare'));
    expect(n('rare')).toBeGreaterThan(n('epic'));
  });
});
