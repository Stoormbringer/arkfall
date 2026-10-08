export type AttackDef =
  | { kind: 'lunge'; range: number; windupSec: number; lungeSpeed: number; lungeSec: number; recoverSec: number }
  | { kind: 'shoot'; range: number; keepDistance: number; windupSec: number; projectileSpeed: number; recoverSec: number }
  | { kind: 'slam'; range: number; aoeRadius: number; windupSec: number; recoverSec: number }
  /** Подрывник: подбегает и взрывается; убитый — взрывается после фитиля */
  | { kind: 'explode'; range: number; aoeRadius: number; windupSec: number; deathFuseSec: number }
  /** Призыватель: держит дистанцию, зовёт мелочь, пока живых меньше maxAlive */
  | { kind: 'summon'; range: number; keepDistance: number; windupSec: number; count: number; recoverSec: number; maxAlive: number; summonId: 'rusher' | 'shooter' }
  /** Кружащий стрелок: ходит по орбите и даёт веер снарядов */
  | { kind: 'volley'; range: number; orbitRadius: number; windupSec: number; projectileSpeed: number; bullets: number; spreadDeg: number; recoverSec: number };

export interface EnemyDef {
  name: string;
  role: 'melee' | 'ranged' | 'tank';
  color: string;
  radius: number;
  hp: number;
  dmg: number;
  speed: number;
  attack: AttackDef;
  xpWeight: number;
  /** с какого акта встречается (для валидации состава комнат) */
  fromAct?: number;
  /** не больше N в одной волне (Призыватель) */
  maxPerRoom?: number;
  /** Копейщик: после рывка уязвим — входящий урон ×N в фазе восстановления */
  recoverVulnMult?: number;
  /** Щитоносец: урон с фронта ×N */
  shield?: { frontArcDeg: number; frontDamageMult: number };
  boss?: { phase2At: number; phase2WindupMult: number; phase2RecoverSec: number; phase2AddsOnTransition: number; phase2RingBullets: number; phase2RingSpeed: number; phase2RingDelaySec: number; phase2RingDamageMult: number };
}

export type EnemyId = 'rusher' | 'shooter' | 'tank' | 'bomber' | 'lancer' | 'summoner' | 'shield' | 'orbiter' | 'boss_hammer';

export type SkillCategory = 'melee' | 'ranged' | 'magic' | 'summon' | 'control' | 'defense' | 'mobility';
export type UpgradeSlot = 'damage' | 'cooldown' | 'area' | 'duration' | 'projectiles' | 'charges' | 'unique';

export interface SkillDef {
  name: string;
  category: SkillCategory;
  type: 'active' | 'passive';
  resource: { kind: 'cooldown'; cooldownSec: number } | { kind: 'charges'; charges: number; rechargeSec: number } | { kind: 'none' };
  base: Record<string, number | boolean>;
  upgradeSlots: UpgradeSlot[];
  unique: { name: string; effect: string };
  synergies: string[];
  counters: string[];
  offerFrom: number;
}

export type FacetRarity = 'common' | 'rare' | 'epic';
export type ItemSlot = 'weapon' | 'armor' | 'accessory' | 'artifact';
export interface ItemDef { name: string; slot: ItemSlot; rarity: FacetRarity; mods: Record<string, number>; text: string }
export interface FacetDef {
  name: string;
  rarity: FacetRarity;
  binds: string | null;
  effect: string;
  params: Record<string, number | boolean>;
}
