import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { offerFacets } from '../../src/run/facetOffer';
import { applyFacet, defaultMods, facetDef, IMPLEMENTED_FACETS } from '../../src/run/mods';

const skills = ['dash_cut', 'spark', 'blood_rhythm'];

describe('предложение Граней (GDD §C.4)', () => {
  it('даёт 3 разные Грани: 2 привязанные к скиллам игрока + 1 дикая', () => {
    for (let seed = 1; seed < 200; seed++) {
      const o = offerFacets(new Rng(seed), { ownedSkills: skills, ownedFacets: [], rank: 1 });
      expect(new Set(o).size).toBe(3);
      const bound = o.filter((id) => facetDef(id).binds !== null);
      expect(bound.length).toBe(2);
      for (const id of bound) expect(skills).toContain(facetDef(id).binds);
    }
  });
  it('не предлагает уже взятые Грани', () => {
    const owned = ['ash_trail', 'overload', 'reserve'];
    for (let seed = 1; seed < 100; seed++)
      for (const id of offerFacets(new Rng(seed), { ownedSkills: skills, ownedFacets: owned, rank: 2 })) expect(owned).not.toContain(id);
  });
  it('эпические Грани не выпадают до Ранга 4', () => {
    for (let seed = 1; seed < 300; seed++)
      for (const id of offerFacets(new Rng(seed), { ownedSkills: skills, ownedFacets: [], rank: 3 })) expect(facetDef(id).rarity).not.toBe('epic');
  });
  it('детерминировано по сиду', () => {
    const a = offerFacets(new Rng(42), { ownedSkills: skills, ownedFacets: [], rank: 1 });
    const b = offerFacets(new Rng(42), { ownedSkills: skills, ownedFacets: [], rank: 1 });
    expect(a).toEqual(b);
  });
  it('все реализованные Грани существуют в facets.json и применяются без ошибок', () => {
    const m = defaultMods();
    for (const id of IMPLEMENTED_FACETS) { expect(facetDef(id)).toBeDefined(); applyFacet(m, id); }
    expect(m.damageMult).toBeCloseTo(1.25);
    expect(m.cooldownMult).toBeCloseTo(0.9);
    expect(m.spark.extraJumps).toBe(2);
  });
});

describe('стартовая Грань (GDD §2 шаг 2)', () => {
  it('3 разные дикие Грани, без эпических', async () => {
    const { offerStartFacets } = await import('../../src/run/facetOffer');
    for (let seed = 1; seed < 100; seed++) {
      const o = offerStartFacets(new Rng(seed));
      expect(new Set(o).size).toBe(3);
      for (const id of o) { expect(facetDef(id).binds).toBeNull(); expect(facetDef(id).rarity).not.toBe('epic'); }
    }
  });
});
