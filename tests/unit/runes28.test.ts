import { describe, expect, it } from 'vitest';
import FACETS from '../../src/data/facets.json';
import { applyFacet, defaultMods, facetDef, IMPLEMENTED_FACETS, UNIMPLEMENTED_FACETS } from '../../src/run/mods';
import { IMPLEMENTED_SKILLS } from '../../src/meta/skillChoice';
import { offerFacets } from '../../src/run/facetOffer';
import { Rng } from '../../src/core/rng';

describe('Руны и скиллы MVP (пакет 28)', () => {
  it('все 10 скиллов реализованы; все Руны каталога либо реализованы, либо названы в списке причин', () => {
    expect(IMPLEMENTED_SKILLS.length).toBe(10);
    const all = Object.keys(FACETS).filter((k) => !k.startsWith('_'));
    for (const id of all) expect((IMPLEMENTED_FACETS as readonly string[]).includes(id) || id in UNIMPLEMENTED_FACETS, id).toBe(true);
    expect(IMPLEMENTED_FACETS.length).toBe(all.length - Object.keys(UNIMPLEMENTED_FACETS).length);
  });
  it('каждая новая Руна меняет моды (ни одна не пустышка)', () => {
    const base = JSON.stringify(defaultMods());
    for (const id of ['ricochet', 'greedy_shards', 'long_pull', 'compression', 'wide_window', 'echo_answer', 'loyalty', 'twin', 'crescendo', 'spiked_barrier', 'instant_barrier', 'poison_soil', 'roots', 'heaviness', 'rift', 'shield_breaker']) {
      const m = defaultMods(); applyFacet(m, id);
      expect(JSON.stringify(m), id).not.toBe(base);
    }
  });
  it('числа из каталога доезжают до модов', () => {
    const m = defaultMods();
    for (const id of ['long_pull', 'twin', 'heaviness', 'instant_barrier', 'poison_soil', 'shield_breaker']) applyFacet(m, id);
    expect(m.well.durationBonusSec).toBe(1); expect(m.well.cooldownBonusSec).toBe(-1);
    expect(m.phantom.count).toBe(2); expect(m.phantom.damageMult).toBeCloseTo(0.7);
    expect(m.echoStrike.windupBonusSec).toBeCloseTo(0.2); expect(m.echoStrike.damageMult).toBeCloseTo(1.6);
    expect(m.barrier.autoAtHp).toBeCloseTo(0.3); expect(m.barrier.autoCooldownSec).toBe(20);
    expect(m.spike.poisonSec).toBe(3); expect(m.spike.poisonDps).toBe(5);
    expect(m.shieldDamageMult).toBe(2);
  });
  it('Руны новых скиллов предлагаются их владельцам', () => {
    let seenBound = 0;
    for (let s = 1; s < 60; s++) {
      const offer = offerFacets(new Rng(s), { ownedSkills: ['echo_strike', 'phantom_blade', 'riposte'], ownedFacets: [], rank: 5 });
      for (const id of offer) if (['echo_strike', 'phantom_blade', 'riposte'].includes(facetDef(id).binds ?? '')) seenBound++;
    }
    expect(seenBound).toBeGreaterThan(40);
  });
});
