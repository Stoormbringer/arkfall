import type { Rng } from '../core/rng';

import F from '../data/formulas.json';

/** Награды за дверями (GDD §2 шаг 3). */
export type DoorReward = 'shards' | 'heal' | 'facet' | 'elite' | 'boss' | 'shop';

export interface DoorDef { reward: DoorReward; name: string; hint: string; color: number }

export const DOORS: Record<DoorReward, DoorDef> = {
  shards: { reward: 'shards', name: 'Сокровищница', hint: '+15 Осколков после зачистки', color: 0xf0c75e },
  heal:   { reward: 'heal',   name: 'Купель', hint: '+30 HP на входе', color: 0x7fd48a },
  facet:  { reward: 'facet',  name: 'Алтарь', hint: 'Руна после зачистки', color: 0xb58cff },
  elite:  { reward: 'elite',  name: 'Логово элиты', hint: 'Врагов ×1,5 и они крепче. Награда: Осколки и Руна', color: 0xe0553a },
  boss:   { reward: 'boss',   name: 'Логово босса', hint: 'Босс акта', color: 0xe0a62f },
  shop:   { reward: 'shop',   name: 'Торговец', hint: 'После зачистки — лавка: предметы, лечение, реролл Руны. За золото', color: 0x8fd3ff },
};

const WEIGHTS: Record<Exclude<DoorReward, 'boss'>, number> = { shards: 35, heal: 25, facet: 25, elite: 15, shop: 20 };

export interface DoorInput { nextRoomIsBoss: boolean; hp01: number; rank: number; nextRoom?: number }

/** 2 двери (30 % — 3), без повторов; лечение весит больше при низком HP; элита не раньше Ранга 1; Торговец не раньше комнаты shop.fromRoom. */
export function offerDoors(rng: Rng, input: DoorInput): DoorReward[] {
  if (input.nextRoomIsBoss) return ['boss'];
  const count = rng.next() < 0.3 ? 3 : 2;
  let pool: Record<string, number> = { ...WEIGHTS };
  if (input.hp01 < 0.4) pool.heal *= 2.5;
  if (input.hp01 > 0.9) pool.heal *= 0.3;
  if (input.rank < 1) delete pool.elite;
  if ((input.nextRoom ?? Infinity) < F.shop.fromRoom) delete pool.shop;
  const out: DoorReward[] = [];
  while (out.length < count && Object.keys(pool).length) {
    const pick = rng.pick<DoorReward>(pool);
    out.push(pick);
    const { [pick]: _drop, ...rest } = pool; void _drop;
    pool = rest;
  }
  return out;
}

/** Эффект элитной комнаты на статы и количество */
export const ELITE_ROOM = { countMult: 1.5, hpMult: 1.3, shardsBonus: 20 };
export const SHARDS_DOOR_BONUS = 15;
export const HEAL_DOOR_HP = 30;
