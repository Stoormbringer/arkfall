import Phaser from 'phaser';
import ENEMIES from '../data/enemies.json';
import ROOMS from '../data/rooms.json';
import type { EnemyDef, EnemyId } from '../data/types';
import { enemyCount } from '../core/formulas';
import { Rng } from '../core/rng';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';

export interface TtkSample { role: EnemyId; sec: number; hits: number }

export interface ArenaState {
  tier: number;
  room: number;
  seed: number;
  kills: number;
  ttkSamples: TtkSample[];
  alive: number;
  cleared: boolean;
  dead: boolean;
  killer: string;
  hp: number;
  maxHp: number;
  dodge01: number;
}

const ROOM = ROOMS.arena;

export class ArenaScene extends Phaser.Scene {
  state!: ArenaState;
  private player!: Player;
  private enemies!: Phaser.GameObjects.Group;
  private bullets!: Phaser.Physics.Arcade.Group;
  private rng!: Rng;
  private keys!: Record<'W' | 'A' | 'S' | 'D' | 'UP' | 'LEFT' | 'DOWN' | 'RIGHT' | 'SPACE' | 'SHIFT' | 'R', Phaser.Input.Keyboard.Key>;
  private advancing = false;
  private pendingSpawns = 0;

  constructor() { super('arena'); }

  init(data: Partial<ArenaState>) {
    const q = new URLSearchParams(location.search);
    this.state = {
      tier: data.tier ?? Number(q.get('tier') ?? 1),
      room: data.room ?? Number(q.get('room') ?? 1),
      seed: data.seed ?? Number(q.get('seed') ?? Date.now() % 1_000_000),
      kills: data.kills ?? 0,
      ttkSamples: data.ttkSamples ?? [],
      alive: 0, cleared: false, dead: false, killer: '', hp: 0, maxHp: 1, dodge01: 1,
    };
    this.rng = new Rng(this.state.seed * 31 + this.state.room);
    this.advancing = false;
    this.pendingSpawns = 0;
  }

  create() {
    const { width, height, wall } = ROOM;
    this.physics.world.setBounds(wall, wall, width - wall * 2, height - wall * 2);
    this.add.tileSprite(0, 0, width, height, 'floor').setOrigin(0).setDepth(0);
    this.add.rectangle(width / 2, height / 2, width - wall * 2, height - wall * 2).setStrokeStyle(3, 0x2d3444).setDepth(1);

    this.player = new Player(this, width / 2, height / 2);
    this.enemies = this.add.group({ runChildUpdate: false });
    this.bullets = this.physics.add.group({ classType: Projectile, maxSize: 200, runChildUpdate: false });

    this.physics.add.overlap(this.player, this.bullets, (_p, b) => {
      const bullet = b as Projectile;
      if (!bullet.active) return;
      bullet.kill();
      this.hitPlayer(bullet.damage, bullet.source);
    });
    this.physics.add.collider(this.enemies, this.enemies);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT,SPACE,SHIFT,R') as typeof this.keys;
    this.input.mouse?.disableContextMenu();

    this.spawnWave();
    this.emitState();
  }

  update() {
    if (this.state.dead) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.scene.restart({ tier: this.state.tier, room: 1, seed: this.state.seed + 1 });
      return;
    }

    const move = new Phaser.Math.Vector2(
      (this.keys.D.isDown || this.keys.RIGHT.isDown ? 1 : 0) - (this.keys.A.isDown || this.keys.LEFT.isDown ? 1 : 0),
      (this.keys.S.isDown || this.keys.DOWN.isDown ? 1 : 0) - (this.keys.W.isDown || this.keys.UP.isDown ? 1 : 0),
    ).normalize();
    const ptr = this.input.activePointer;
    const aim = new Phaser.Math.Vector2(ptr.worldX, ptr.worldY);
    const dodge = Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || Phaser.Input.Keyboard.JustDown(this.keys.SHIFT);

    const strike = this.player.handleInput({ move, aim, attack: ptr.leftButtonDown(), dodge });
    if (strike) this.resolveMelee(strike);

    const ctx = {
      player: this.player,
      shoot: (x: number, y: number, a: number, s: number, d: number, src: string) => {
        const b = this.bullets.get(x, y) as Projectile | null;
        b?.fire(x, y, a, s, d, src);
      },
      hitPlayer: (d: number, src: string) => this.hitPlayer(d, src),
    };
    for (const e of this.enemies.getChildren() as Enemy[]) e.update(ctx);

    this.state.alive = this.enemies.countActive(true);
    if (this.state.alive === 0 && this.pendingSpawns === 0 && !this.advancing) this.onRoomCleared();
    this.emitState();
  }

  private emitState() {
    this.state.hp = this.player.hp;
    this.state.maxHp = this.player.maxHp;
    this.state.dodge01 = this.player.dodgeCooldown01;
    this.game.events.emit('arena-state', this.state);
  }

  private resolveMelee(s: { angle: number; radius: number; arcRad: number; damage: number; knockback: number }) {
    const c = new Phaser.Math.Vector2(this.player.x, this.player.y);
    for (const e of [...(this.enemies.getChildren() as Enemy[])]) {
      if (!e.active) continue;
      const ec = e.getCenter();
      const d = Phaser.Math.Distance.BetweenPoints(c, ec) - e.def.radius;
      if (d > s.radius) continue;
      const diff = Math.abs(Phaser.Math.Angle.Wrap(Phaser.Math.Angle.BetweenPoints(c, ec) - s.angle));
      if (diff > s.arcRad / 2) continue;
      const killed = e.takeDamage(s.damage, c, s.knockback);
      if (killed) {
        this.state.kills++;
        if (e.firstHitAt !== null) this.state.ttkSamples.push({ role: e.id, sec: (this.time.now - e.firstHitAt) / 1000, hits: e.hitsTaken });
      }
    }
  }

  private hitPlayer(dmg: number, source: string) {
    if (this.state.dead) return;
    if (!this.player.takeDamage(dmg, source)) return;
    if (this.player.hp <= 0) {
      this.state.dead = true;
      this.state.killer = source;
      this.player.setVelocity(0, 0);
      for (const e of this.enemies.getChildren() as Enemy[]) e.setVelocity(0, 0);
    }
  }

  private spawnWave() {
    const n = enemyCount(ROOM.baseCount, this.state.tier, this.state.room);
    const maxRanged = Math.floor(n * ROOM.maxRangedShare);
    let ranged = 0;
    const center = new Phaser.Math.Vector2(this.player.x, this.player.y);
    for (let i = 0; i < n; i++) {
      let id = this.rng.pick<EnemyId>(ROOM.composition);
      if (id === 'shooter' && ranged >= maxRanged) id = 'rusher';
      if (id === 'shooter') ranged++;
      const pos = this.spawnPoint(center);
      this.pendingSpawns++;
      this.telegraphSpawn(pos, () => {
        this.pendingSpawns--;
        const def = ENEMIES[id] as EnemyDef;
        this.enemies.add(new Enemy(this, pos.x, pos.y, id, def, this.state.tier, this.state.room));
      });
    }
  }

  /** Точка появления: у края, не ближе 260 px к игроку */
  private spawnPoint(center: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const { width, height, wall } = ROOM;
    for (let tries = 0; tries < 20; tries++) {
      const side = Math.floor(this.rng.range(0, 4));
      const t = this.rng.range(0.1, 0.9);
      const p = side === 0 ? new Phaser.Math.Vector2(wall + 40, wall + t * (height - wall * 2))
        : side === 1 ? new Phaser.Math.Vector2(width - wall - 40, wall + t * (height - wall * 2))
        : side === 2 ? new Phaser.Math.Vector2(wall + t * (width - wall * 2), wall + 40)
        : new Phaser.Math.Vector2(wall + t * (width - wall * 2), height - wall - 40);
      if (Phaser.Math.Distance.BetweenPoints(p, center) > 260) return p;
    }
    return new Phaser.Math.Vector2(wall + 40, wall + 40);
  }

  private telegraphSpawn(p: Phaser.Math.Vector2, onDone: () => void) {
    const ring = this.add.circle(p.x, p.y, 4, 0x8fd3ff, 0).setStrokeStyle(2, 0x8fd3ff, 0.9).setDepth(4);
    this.tweens.add({ targets: ring, radius: 26, duration: ROOM.spawnTelegraphSec * 1000, ease: 'Quad.Out',
      onUpdate: () => ring.setRadius(ring.radius),
      onComplete: () => { ring.destroy(); onDone(); } });
  }

  private onRoomCleared() {
    this.advancing = true;
    this.state.cleared = true;
    this.time.delayedCall(ROOM.clearDelaySec * 1000, () =>
      this.scene.restart({ ...this.state, room: this.state.room + 1 }));
  }
}
