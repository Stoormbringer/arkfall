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
