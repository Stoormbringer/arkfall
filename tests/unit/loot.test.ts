import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { applyItem, defaultMods } from '../../src/run/mods';
import { ITEMS, keepOnDeath, rarityWeights, rollItem, SLOTS } from '../../src/run/loot';

describe('лут (GDD §H, MVP)', () => {
  it('20 предметов, по 5 на слот, по редкостям 2/2/1 в каждом слоте', () => {
    expect(Object.keys(ITEMS).length).toBe(20);
    for (const slot of SLOTS) {
      const inSlot = Object.values(ITEMS).filter((i) => i.slot === slot);
      expect(inSlot.length).toBe(5);
      expect(inSlot.filter((i) => i.rarity === 'common').length).toBe(2);
      expect(inSlot.filter((i) => i.rarity === 'rare').length).toBe(2);
      expect(inSlot.filter((i) => i.rarity === 'epic').length).toBe(1);
    }
  });
  it('ни один предмет не даёт больше +20 % урона — сила в комбинациях, не в одном предмете', () => {
    for (const i of Object.values(ITEMS)) expect(i.mods.damageMult ?? 1).toBeLessThanOrEqual(1.2);
  });
  it('эпические чаще на высоком Тире', () => {
    expect(rarityWeights(10).epic).toBeGreaterThan(rarityWeights(1).epic);
  });
  it('rollItem уважает исключения и детерминирован', () => {
    const all = Object.keys(ITEMS);
    expect(rollItem(new Rng(3), 1, all)).toBeNull();
    expect(rollItem(new Rng(5), 1)).toBe(rollItem(new Rng(5), 1));
  });
  it('при смерти остаётся лучшая половина', () => {
    const kept = keepOnDeath(['jagged_blade', 'abyss_blade', 'leather_armor', 'reaper_blade', 'wind_boots']);
    expect(kept.length).toBe(3);
    expect(kept).toContain('abyss_blade');
    expect(kept).toContain('reaper_blade');
  });
  it('модификаторы предметов применяются', () => {
    const m = defaultMods();
    applyItem(m, ITEMS.abyss_blade); applyItem(m, ITEMS.ark_carapace); applyItem(m, ITEMS.double_step);
    expect(m.damageMult).toBeCloseTo(1.2);
    expect(m.maxHpDelta).toBe(40);
    expect(m.dodgeChargesBonus).toBe(1);
    expect(m.damageTakenMult).toBeCloseTo(0.9);
  });
});
