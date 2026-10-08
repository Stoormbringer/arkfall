import { describe, expect, it } from 'vitest';
import ENEMIES from '../../src/data/enemies.json';
import ROOMS from '../../src/data/rooms.json';
import type { EnemyDef } from '../../src/data/types';
import { telegraphSec } from '../../src/core/formulas';

const defs = Object.entries(ENEMIES).filter(([k]) => !k.startsWith('_')) as [string, EnemyDef][];
const mobs = defs.filter(([, d]) => !d.boss);

describe('бестиарий MVP (GDD §10: 8 врагов)', () => {
  it('8 обычных врагов + босс, у каждого известный вид атаки', () => {
    expect(mobs.length).toBe(8);
    const kinds = new Set(['lunge', 'shoot', 'slam', 'explode', 'summon', 'volley']);
    for (const [, d] of defs) expect(kinds.has(d.attack.kind)).toBe(true);
  });
  it('каждая атака телеграфируется ≥ 0,4 с даже на Тире 10 (§6.7)', () => {
    for (const [, d] of defs) expect(telegraphSec(d.attack.windupSec, 10)).toBeGreaterThanOrEqual(0.4);
  });
  it('состав по актам: доли суммируются в 1, враг не раньше своего акта, в акте 3 — все 8', () => {
    const acts = ROOMS.arena.compositionByAct as Record<string, number>[];
    expect(acts.length).toBe(ROOMS.run.acts);
    acts.forEach((comp, i) => {
      expect(Object.values(comp).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
      for (const id of Object.keys(comp)) expect(((ENEMIES as Record<string, EnemyDef>)[id].fromAct ?? 1)).toBeLessThanOrEqual(i + 1);
    });
    expect(Object.keys(acts[acts.length - 1]).length).toBe(8);
  });
  it('Щитоносец и Копейщик имеют контрмеры: щит спереди, уязвимость после рывка', () => {
    expect(ENEMIES.shield.shield.frontDamageMult).toBeLessThan(0.5);
    expect(ENEMIES.lancer.recoverVulnMult).toBeGreaterThan(1);
    expect(ENEMIES.lancer.attack.recoverSec).toBeGreaterThan(1);
  });
  it('Призыватель ограничен: 1 на волну и потолок живых', () => {
    expect(ENEMIES.summoner.maxPerRoom).toBe(1);
    expect(ENEMIES.summoner.attack.maxAlive).toBeLessThanOrEqual(14);
  });
});
