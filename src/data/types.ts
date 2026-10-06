export type AttackDef =
  | { kind: 'lunge'; range: number; windupSec: number; lungeSpeed: number; lungeSec: number; recoverSec: number }
  | { kind: 'shoot'; range: number; keepDistance: number; windupSec: number; projectileSpeed: number; recoverSec: number }
  | { kind: 'slam'; range: number; aoeRadius: number; windupSec: number; recoverSec: number };

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
}

export type EnemyId = 'rusher' | 'shooter' | 'tank';

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
export interface FacetDef {
  name: string;
  rarity: FacetRarity;
  binds: string | null;
  effect: string;
  params: Record<string, number | boolean>;
}
