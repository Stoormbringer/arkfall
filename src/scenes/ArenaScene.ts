import Phaser from 'phaser';
import ENEMIES from '../data/enemies.json';
import ROOMS from '../data/rooms.json';
import F from '../data/formulas.json';
import type { EnemyDef, EnemyId } from '../data/types';
import { enemyCount } from '../core/formulas';
import { Rng } from '../core/rng';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { RunState } from '../run/RunState';
import { offerFacets } from '../run/facetOffer';
import { DashCut, MVP_SKILLS, Spark, type Battlefield, type Skill, type SkillView } from '../skills/skills';

export interface ArenaSnapshot {
  tier: number; room: number; seed: number; kills: number; alive: number;
  cleared: boolean; dead: boolean; killer: string;
  hp: number; maxHp: number; dodgeCharges: number; dodgeMax: number; dodge01: number;
  rhythm: number; rank: number; shards: number; nextRankAt: number;
  skills: SkillView[]; facets: string[];
  ttkSamples: { role: string; sec: number; hits: number }[];
}

interface Zone { x: number; y: number; r: number; until: number; nextTick: number; dps: number; tickSec: number; gfx: Phaser.GameObjects.Arc }

const ROOM = ROOMS.arena;

export class ArenaScene extends Phaser.Scene {
  run!: RunState;
  private player!: Player;
  private enemies!: Phaser.GameObjects.Group;
  private bullets!: Phaser.Physics.Arcade.Group;
  private rng!: Rng;
  private keys!: Record<'W' | 'A' | 'S' | 'D' | 'UP' | 'LEFT' | 'DOWN' | 'RIGHT' | 'SPACE' | 'SHIFT' | 'R' | 'Q', Phaser.Input.Keyboard.Key>;
  private skills: Skill[] = [];
  private zones: Zone[] = [];
  private advancing = false;
  private pendingSpawns = 0;
  private cleared = false;
  private dead = false;
  private killer = '';
  private choosing = false;
  private currentOffer: string[] = [];

  constructor() { super('arena'); }

  init(data: { run?: RunState }) {
    if (data.run) this.run = data.run;
    else {
      const q = new URLSearchParams(location.search);
      this.run = new RunState(Number(q.get('tier') ?? 1), Number(q.get('seed') ?? Date.now() % 1_000_000), MVP_SKILLS);
      this.run.room = Number(q.get('room') ?? 1);
    }
    this.rng = new Rng(this.run.seed * 31 + this.run.room);
    this.advancing = false; this.pendingSpawns = 0; this.cleared = false; this.dead = false; this.killer = ''; this.choosing = false;
    this.zones = [];
  }

  create() {
    const { width, height, wall } = ROOM;
    this.physics.world.setBounds(wall, wall, width - wall * 2, height - wall * 2);
    this.add.tileSprite(0, 0, width, height, 'floor').setOrigin(0).setDepth(0);
    this.add.rectangle(width / 2, height / 2, width - wall * 2, height - wall * 2).setStrokeStyle(3, 0x2d3444).setDepth(1);

    this.player = new Player(this, width / 2, height / 2, this.run.mods, this.run.hp ?? undefined);
    this.player.hasRhythm = this.run.skills.includes('blood_rhythm');
    this.enemies = this.add.group();
    this.bullets = this.physics.add.group({ classType: Projectile, maxSize: 200 });

    const field: Battlefield = {
      enemies: () => this.enemies.getChildren() as Enemy[],
      damage: (e, amount, from, kb, source) => this.damageEnemy(e, amount, from, kb, source),
      addZone: (x, y, r, dur, dps, tick) => this.addZone(x, y, r, dur, dps, tick),
    };
    this.skills = [];
    if (this.run.skills.includes('dash_cut')) this.skills.push(new DashCut(this, this.player, this.run.mods, field));
    if (this.run.skills.includes('spark')) this.skills.push(new Spark(this, this.player, this.run.mods, field));

    this.physics.add.overlap(this.player, this.bullets, (_p, b) => {
      const bullet = b as Projectile;
      if (!bullet.active) return;
      bullet.kill();
      this.hitPlayer(bullet.damage, bullet.source);
    });
    this.physics.add.collider(this.enemies, this.enemies);

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT,SPACE,SHIFT,R,Q') as typeof this.keys;
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown() && !this.dead && !this.choosing) this.skills.find((s) => s.id === 'dash_cut')?.tryCast(new Phaser.Math.Vector2(p.worldX, p.worldY));
    });

    this.game.events.off('facet-chosen').off('facet-reroll');
    this.game.events.on('facet-chosen', (id: string) => this.onFacetChosen(id));
    this.game.events.on('facet-reroll', () => this.onFacetReroll());

    this.spawnWave();
    this.emit();
  }

  update(_t: number, deltaMs: number) {
    if (this.dead) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.scene.restart({ run: new RunState(this.run.tier, this.run.seed + 1, MVP_SKILLS) });
      return;
    }
    if (this.choosing) return;

    const move = new Phaser.Math.Vector2(
      (this.keys.D.isDown || this.keys.RIGHT.isDown ? 1 : 0) - (this.keys.A.isDown || this.keys.LEFT.isDown ? 1 : 0),
      (this.keys.S.isDown || this.keys.DOWN.isDown ? 1 : 0) - (this.keys.W.isDown || this.keys.UP.isDown ? 1 : 0),
    ).normalize();
    const ptr = this.input.activePointer;
    const aim = new Phaser.Math.Vector2(ptr.worldX, ptr.worldY);
    const dodge = Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || Phaser.Input.Keyboard.JustDown(this.keys.SHIFT);
    const locked = this.skills.some((s) => s.locksControl);

    const strike = this.player.handleInput({ move, aim, attack: ptr.leftButtonDown(), dodge }, locked);
    if (strike) this.resolveMelee(strike);
    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) this.skills.find((s) => s.id === 'spark')?.tryCast(aim);
    for (const s of this.skills) s.update(deltaMs / 1000);
    this.updateZones();

    const ctx = {
      player: this.player,
      shoot: (x: number, y: number, a: number, sp: number, d: number, src: string) => (this.bullets.get(x, y) as Projectile | null)?.fire(x, y, a, sp, d, src),
      hitPlayer: (d: number, src: string) => this.hitPlayer(d, src),
    };
    for (const e of this.enemies.getChildren() as Enemy[]) e.update(ctx);

    const alive = this.enemies.countActive(true);
    if (alive === 0 && this.pendingSpawns === 0 && !this.advancing) this.onRoomCleared();
    this.emit();
  }

  // ---------- урон ----------

  /** Единая точка урона по врагу: модификаторы, добивание, TTK, Осколки, лечение за убийство */
  private damageEnemy(e: Enemy, amount: number, from: Phaser.Math.Vector2, knockback: number, source: string): boolean {
    if (!e.active) return false;
    e.lastHitBy = source;
    let killed = e.takeDamage(amount, from, knockback);
    if (!killed && this.run.mods.executeBelow > 0 && e.hp / e.maxHp < this.run.mods.executeBelow) { e.die(); killed = true; }
    if (killed) {
      this.run.kills++;
      if (e.firstHitAt !== null) this.run.ttkSamples.push({ role: e.id, sec: (this.time.now - e.firstHitAt) / 1000, hits: e.hitsTaken });
      this.run.addShards(F.shards.mob);
      if (this.run.mods.healPerKill) this.player.heal(this.run.mods.healPerKill);
    }
    return killed;
  }

  private resolveMelee(s: { angle: number; radius: number; arcRad: number; damage: number; knockback: number }) {
    const c = new Phaser.Math.Vector2(this.player.x, this.player.y);
    let hitAny = false;
    for (const e of [...(this.enemies.getChildren() as Enemy[])]) {
      if (!e.active) continue;
      const d = Phaser.Math.Distance.BetweenPoints(c, e) - e.def.radius;
      if (d > s.radius) continue;
      const diff = Math.abs(Phaser.Math.Angle.Wrap(Phaser.Math.Angle.BetweenPoints(c, e) - s.angle));
      if (diff > s.arcRad / 2) continue;
      hitAny = true;
      this.damageEnemy(e, s.damage, c, s.knockback, 'Дуговой клинок');
    }
    if (hitAny) this.player.onMeleeHit();
  }

  private hitPlayer(dmg: number, source: string) {
    if (this.dead) return;
    if (!this.player.takeDamage(dmg, source)) return;
    if (this.player.hp <= 0) {
      if (this.run.mods.lastBreath && !this.run.mods.lastBreathUsed) {
        this.run.mods.lastBreathUsed = true;
        this.player.hp = 30;
        this.player.grantInvuln(2000);
        return;
      }
      this.dead = true;
      this.killer = source;
      this.player.setVelocity(0, 0);
      for (const e of this.enemies.getChildren() as Enemy[]) e.setVelocity(0, 0);
    }
  }

  // ---------- зоны (Шлейф пепла и будущие) ----------

  private addZone(x: number, y: number, r: number, durationSec: number, dps: number, tickSec: number) {
    const gfx = this.add.circle(x, y, r, 0xff7a3c, 0.22).setStrokeStyle(1, 0xff7a3c, 0.6).setDepth(3);
    this.zones.push({ x, y, r, until: this.time.now + durationSec * 1000, nextTick: this.time.now, dps, tickSec, gfx });
  }

  private updateZones() {
    const now = this.time.now;
    this.zones = this.zones.filter((z) => {
      if (now >= z.until) { z.gfx.destroy(); return false; }
      if (now >= z.nextTick) {
        z.nextTick = now + z.tickSec * 1000;
        const from = new Phaser.Math.Vector2(z.x, z.y);
        for (const e of [...(this.enemies.getChildren() as Enemy[])])
          if (e.active && Phaser.Math.Distance.BetweenPoints(from, e) <= z.r + e.def.radius) this.damageEnemy(e, z.dps * z.tickSec * this.run.mods.damageMult, from, 0, 'Шлейф пепла');
      }
      return true;
    });
  }

  // ---------- волны и комнаты ----------

  private spawnWave() {
    const n = enemyCount(ROOM.baseCount, this.run.tier, this.run.room);
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
        this.enemies.add(new Enemy(this, pos.x, pos.y, id, ENEMIES[id] as EnemyDef, this.run.tier, this.run.room));
      });
    }
  }

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
      onUpdate: () => ring.setRadius(ring.radius), onComplete: () => { ring.destroy(); onDone(); } });
  }

  private onRoomCleared() {
    this.advancing = true;
    this.cleared = true;
    this.run.hp = this.player.hp;
    this.time.delayedCall(ROOM.clearDelaySec * 1000 * 0.5, () => this.nextStep());
  }

  /** После комнаты: сначала все накопленные выборы Граней, затем следующая комната */
  private nextStep() {
    if (this.run.pendingOffers > 0) {
      this.choosing = true;
      this.player.setVelocity(0, 0);
      this.currentOffer = offerFacets(this.rng, { ownedSkills: this.run.skills, ownedFacets: this.run.facets, rank: this.run.rank });
      if (this.currentOffer.length === 0) { this.run.pendingOffers = 0; this.nextStep(); return; }
      this.scene.launch('facet', { offer: this.currentOffer, rerollsLeft: this.run.rerollsLeft, rank: this.run.rank });
      this.emit();
      return;
    }
    this.run.onRoomAdvance();
    this.scene.restart({ run: this.run });
  }

  private onFacetChosen(id: string) {
    if (!this.choosing) return;
    this.run.takeFacet(id);
    this.choosing = false;
    this.player.maxHp = Math.max(1, 100 + this.run.mods.maxHpDelta);
    this.player.hp = Math.min(this.player.hp, this.player.maxHp);
    this.player.dodgeMax = 1 + this.run.mods.dodgeChargesBonus;
    this.run.hp = this.player.hp;
    this.time.delayedCall(200, () => this.nextStep());
  }

  private onFacetReroll() {
    if (!this.choosing || this.run.rerollsLeft <= 0) return;
    this.run.rerollsLeft--;
    this.choosing = false;
    this.nextStep();
  }

  private emit() {
    const snap: ArenaSnapshot = {
      tier: this.run.tier, room: this.run.room, seed: this.run.seed, kills: this.run.kills,
      alive: this.enemies.countActive(true), cleared: this.cleared, dead: this.dead, killer: this.killer,
      hp: this.player.hp, maxHp: this.player.maxHp, dodgeCharges: this.player.dodgeCharges, dodgeMax: this.player.dodgeMax, dodge01: this.player.dodgeCooldown01,
      rhythm: this.player.rhythmStacks, rank: this.run.rank, shards: this.run.shards, nextRankAt: this.run.nextRankAt,
      skills: this.skills.map((s) => s.view()), facets: this.run.facets, ttkSamples: this.run.ttkSamples,
    };
    this.game.events.emit('arena-state', snap);
    (globalThis as unknown as { __arkfall?: ArenaSnapshot }).__arkfall = snap; // для e2e-тестов
  }
}
