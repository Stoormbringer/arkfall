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
  rhythm: { decaySec: number; pierceAtMax: boolean };
  // Руны скиллов пакета 28
  shardShot: { bounces: number; splitAgain: boolean; splitDamageMult: number };
  well: { durationBonusSec: number; cooldownBonusSec: number; burstDamage: number };
  riposte: { windowSec: number | null; cooldownRefundSec: number };
  phantom: { permanent: boolean; damageOverride: number | null; count: number; damageMult: number };
  barrier: { absorbToBurst: number; autoAtHp: number; autoCooldownSec: number };
  spike: { poisonSec: number; poisonDps: number; rootSec: number };
  echoStrike: { windupBonusSec: number; damageMult: number; waveLength: number; waveDamage: number };
  /** Ломатель щитов: множитель фронтального урона по Щитоносцу ×N */
  shieldDamageMult: number;
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
  rhythm: { decaySec: 1, pierceAtMax: false },
  shardShot: { bounces: 0, splitAgain: false, splitDamageMult: 1 },
  well: { durationBonusSec: 0, cooldownBonusSec: 0, burstDamage: 0 },
  riposte: { windowSec: null, cooldownRefundSec: 0 },
  phantom: { permanent: false, damageOverride: null, count: 1, damageMult: 1 },
  barrier: { absorbToBurst: 0, autoAtHp: 0, autoCooldownSec: 0 },
  spike: { poisonSec: 0, poisonDps: 0, rootSec: 0 },
  echoStrike: { windupBonusSec: 0, damageMult: 1, waveLength: 0, waveDamage: 0 },
  shieldDamageMult: 1,
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
  // пакет 28
  'ricochet', 'greedy_shards', 'long_pull', 'compression', 'wide_window', 'echo_answer', 'loyalty', 'twin',
  'crescendo', 'spiked_barrier', 'instant_barrier', 'poison_soil', 'roots', 'heaviness', 'rift', 'shield_breaker',
] as const;
/** Руны из каталога, у которых пока нет механики в бою (и причина) */
export const UNIMPLEMENTED_FACETS: Record<string, string> = { magnet: 'подбора с пола нет — золото и Осколки летят в кошелёк сразу' };

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
    case 'ricochet': m.shardShot.bounces += p.bounces as number; break;
    case 'greedy_shards': m.shardShot.splitAgain = true; m.shardShot.splitDamageMult *= p.damageMult as number; break;
    case 'long_pull': m.well.durationBonusSec += p.durationSec as number; m.well.cooldownBonusSec += p.cooldownSec as number; break;
    case 'compression': m.well.burstDamage += p.damage as number; break;
    case 'wide_window': m.riposte.windowSec = p.windowSec as number; break;
    case 'echo_answer': m.riposte.cooldownRefundSec += p.cooldownRefundSec as number; break;
    case 'loyalty': m.phantom.permanent = true; m.phantom.damageOverride = p.damage as number; break;
    case 'twin': m.phantom.count = p.count as number; m.phantom.damageMult *= p.damageMult as number; break;
    case 'crescendo': m.rhythm.pierceAtMax = true; break;
    case 'spiked_barrier': m.barrier.absorbToBurst += p.absorbToBurst as number; break;
    case 'instant_barrier': m.barrier.autoAtHp = p.autoAtHp as number; m.barrier.autoCooldownSec = p.cooldownSec as number; break;
    case 'poison_soil': m.spike.poisonSec = p.poisonSec as number; m.spike.poisonDps += p.poisonDps as number; break;
    case 'roots': m.spike.rootSec = p.rootSec as number; break;
    case 'heaviness': m.echoStrike.windupBonusSec += p.windupSec as number; m.echoStrike.damageMult *= p.damageMult as number; break;
    case 'rift': m.echoStrike.waveLength = p.waveLength as number; m.echoStrike.waveDamage += p.damage as number; break;
    case 'shield_breaker': m.shieldDamageMult *= p.shieldDamageMult as number; break;
  }
}
