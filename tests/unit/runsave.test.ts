import { describe, expect, it } from 'vitest';
import { RunState } from '../../src/run/RunState';

describe('сохранение забега (GDD §5.5)', () => {
  it('забег восстанавливается без потерь, моды пересобираются из экипировки и Рун', () => {
    const r = new RunState(2, 777, ['dash_cut', 'spark'], { weapon: 'abyss_blade' });
    r.room = 13; r.kills = 140; r.xp = 9000; r.hp = 42; r.rank = 5; r.shards = 10;
    r.takeFacet('glass_fury'); r.addShards(999); r.backpack.push('wind_boots'); r.nextDoor = 'heal';
    r.mods.lastBreathUsed = true; r.addGold(123); r.spendGold(23);
    const b = RunState.fromSave(JSON.parse(JSON.stringify(r.toSave())));
    expect(b.room).toBe(13); expect(b.hp).toBe(42); expect(b.rank).toBe(r.rank); expect(b.pendingOffers).toBe(r.pendingOffers);
    expect(b.facets).toEqual(['glass_fury']); expect(b.backpack).toEqual(['wind_boots']); expect(b.nextDoor).toBe('heal');
    expect(b.mods.damageMult).toBeCloseTo(1.2 * 1.25);
    expect(b.mods.lastBreathUsed).toBe(true);
    expect(b.gold).toBe(100); expect(b.goldEarned).toBe(123);
  });
  it('смена экипировки в забеге пересобирает моды, сохраняя Руны', () => {
    const r = new RunState(1, 1, [], { weapon: 'jagged_blade' });
    r.takeFacet('silence');
    expect(r.mods.damageMult).toBeCloseTo(1.1);
    r.equipped = { weapon: 'abyss_blade', armor: 'leather_armor' };
    r.rebuildMods();
    expect(r.mods.damageMult).toBeCloseTo(1.2);
    expect(r.mods.maxHpDelta).toBe(15);
    expect(r.mods.cooldownMult).toBeCloseTo(0.9);
  });
});
