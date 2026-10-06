import FACETS from '../data/facets.json';
import type { FacetDef, ItemDef } from '../data/types';

/** Агрегированные эффекты взятых Рун. Скиллы и бой читают только этот объект. */
export interface Mods {
  damageMult: number;
  cooldownMult: number;
  maxHpDelta: number;
  dodgeChargesBonus: number;
  shardMult: number;
  healPerKill: number;
  lifesteal: number;
  regenMult: number;
  executeBelow: number;
  lastBreath: boolean;
  lastBreathUsed: boolean;
  echoOfPain: boolean;
  echoOfPainArmed: boolean;
  dash: { ashTrail: boolean; secondWind: boolean };
  spark: { extraJumps: number; grounding: boolean };
  rhythm: { decaySec: number };
  // экипировка (GDD §H)
  moveSpeedMult: number;
  meleeRadiusMult: number;
  attackSpeedMult: number;
  damageTakenMult: number;
  xpMult: number;
  enemyWindupMult: number;
  knockbackMult: number;
}

export const defaultMods = (): Mods => ({
  damageMult: 1, cooldownMult: 1, maxHpDelta: 0, dodgeChargesBonus: 0, shardMult: 1,
  healPerKill: 0, lifesteal: 0, regenMult: 1, executeBelow: 0, lastBreath: false, lastBreathUsed: false,
  echoOfPain: false, echoOfPainArmed: false,
  dash: { ashTrail: false, secondWind: false },
  spark: { extraJumps: 0, grounding: false },
  rhythm: { decaySec: 1 },
  moveSpeedMult: 1, meleeRadiusMult: 1, attackSpeedMult: 1, damageTakenMult: 1, xpMult: 1, enemyWindupMult: 1, knockbackMult: 1,
});

/** Экипированный предмет: множители перемножаются, плоские бонусы складываются */
export function applyItem(m: Mods, item: ItemDef): void {
  for (const [k, v] of Object.entries(item.mods)) {
    switch (k) {
      case 'maxHpDelta': m.maxHpDelta += v; break;
      case 'dodgeChargesBonus': m.dodgeChargesBonus += v; break;
      case 'healPerKill': m.healPerKill += v; break;
      case 'lifesteal': m.lifesteal += v; break;
      case 'executeBelow': m.executeBelow = Math.max(m.executeBelow, v); break;
      case 'damageMult': case 'cooldownMult': case 'shardMult': case 'regenMult': case 'moveSpeedMult': case 'meleeRadiusMult':
      case 'attackSpeedMult': case 'damageTakenMult': case 'xpMult': case 'enemyWindupMult': case 'knockbackMult':
        (m as unknown as Record<string, number>)[k] *= v; break;
    }
  }
}

/** Руны, у которых есть реализация в коде. Остальные не попадают в предложение. */
export const IMPLEMENTED_FACETS = [
  'ash_trail', 'second_wind', 'overload', 'grounding', 'metronome',
  'reserve', 'shard_catcher', 'blood_on_blade', 'echo_of_pain', 'silence',
  'glass_fury', 'brittle_enemies', 'last_breath', 'thirst', 'breather',
] as const;

export type FacetId = keyof typeof FACETS;

export function facetDef(id: string): FacetDef {
  return (FACETS as unknown as Record<string, FacetDef>)[id];
}

export function applyFacet(m: Mods, id: string): void {
  const p = facetDef(id).params as Record<string, number | boolean>;
  switch (id) {
    case 'ash_trail': m.dash.ashTrail = true; break;
    case 'second_wind': m.dash.secondWind = true; break;
    case 'overload': m.spark.extraJumps += p.jumps as number; break;
    case 'grounding': m.spark.grounding = true; break;
    case 'metronome': m.rhythm.decaySec = p.decaySec as number; break;
    case 'reserve': m.dodgeChargesBonus += p.dodgeCharges as number; break;
    case 'shard_catcher': m.shardMult *= p.shardMult as number; break;
    case 'blood_on_blade': m.healPerKill += p.healPerKill as number; break;
    case 'echo_of_pain': m.echoOfPain = true; break;
    case 'silence': m.cooldownMult *= p.cooldownMult as number; break;
    case 'glass_fury': m.damageMult *= p.damageMult as number; m.maxHpDelta += p.maxHp as number; break;
    case 'brittle_enemies': m.executeBelow = Math.max(m.executeBelow, p.executeBelow as number); break;
    case 'last_breath': m.lastBreath = true; break;
    case 'thirst': m.lifesteal += p.lifesteal as number; break;
    case 'breather': m.regenMult *= p.regenMult as number; break;
  }
}
