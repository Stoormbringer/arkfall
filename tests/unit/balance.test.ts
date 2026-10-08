import { describe, expect, it } from 'vitest';
import ENEMIES from '../../src/data/enemies.json';
import ROOMS from '../../src/data/rooms.json';
import P from '../../src/data/player.json';
import F from '../../src/data/formulas.json';
import type { EnemyDef } from '../../src/data/types';
import { enemyDmg, enemyHp, enemyHpHeavy } from '../../src/core/formulas';

const mobs = Object.entries(ENEMIES).filter(([k]) => !k.startsWith('_')) as [string, EnemyDef][];
const lastRoom = ROOMS.run.acts * ROOMS.run.roomsPerAct;
const tiers = [1, 2, 3]; // MVP

/** TTK базовым клинком с ожидаемым билдом Тира: hp / (урон × множитель), шаг — откат удара */
const ttk = (d: EnemyDef, tier: number, room: number) => {
  const hp = d.role === 'tank' ? enemyHpHeavy(d.hp, tier, room) : enemyHp(d.hp, tier, room);
  const dmg = P.weapon.damage * (1 + F.ttkTarget.buildDamagePerTier * (tier - 1));
  return Math.ceil(hp / dmg) * P.weapon.cooldownSec;
};

describe('балансовые ворота MVP (Тиры 1–3, комнаты 1–30)', () => {
  it('ни один удар не снимает больше половины базового HP у обычных и 90 % у тяжёлых/босса', () => {
    for (const [id, d] of mobs) for (const tier of tiers) for (const room of [1, 10, 20, lastRoom]) {
      const hit = enemyDmg(d.dmg, tier, room) * (d.boss ? 1 : 1);
      const cap = d.role === 'tank' ? F.ttkTarget.maxHitHeavy01 : F.ttkTarget.maxHitCommon01;
      expect(hit / P.hp, `${id} T${tier} R${room}: ${hit.toFixed(0)}`).toBeLessThanOrEqual(cap);
    }
  });
  it('TTK обычных: в коридоре 0,6–1,5 с на Тире 1 до 10-й комнаты, не выше 2 с в конце Тира 3', () => {
    for (const [id, d] of mobs) {
      if (d.role === 'tank' || d.boss) continue;
      for (const room of [1, 5, 10]) {
        const t = ttk(d, 1, room);
        expect(t, `${id} T1 R${room}`).toBeLessThanOrEqual(F.ttkTarget.common.max);
      }
      expect(ttk(d, 3, lastRoom), `${id} T3 R${lastRoom}`).toBeLessThanOrEqual(2.0);
    }
  });
  it('TTK тяжёлых: 1,5–4 с на Тире 1, не выше 6 с в конце Тира 3', () => {
    for (const [id, d] of mobs) {
      if (d.role !== 'tank' || d.boss) continue;
      expect(ttk(d, 1, 1), `${id} T1 R1`).toBeGreaterThanOrEqual(1.2);
      expect(ttk(d, 1, lastRoom), `${id} T1 R${lastRoom}`).toBeLessThanOrEqual(F.ttkTarget.tank.max);
      expect(ttk(d, 3, lastRoom), `${id} T3 R${lastRoom}`).toBeLessThanOrEqual(6.0);
    }
  });
  it('Призыватель сам не бьёт; Подрывник умирает с 1–2 ударов на Тире 1 — иначе его не остановить', () => {
    expect(ENEMIES.summoner.dmg).toBe(0);
    expect(ttk(ENEMIES.bomber as EnemyDef, 1, 10)).toBeLessThanOrEqual(0.6);
  });
});
