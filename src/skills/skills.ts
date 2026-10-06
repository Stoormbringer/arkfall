import Phaser from 'phaser';
import SKILLS from '../data/skills.json';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { Mods } from '../run/mods';

/** Что бой даёт скиллам: нанести урон, оглушить, положить зону на землю */
export interface Battlefield {
  enemies: () => Enemy[];
  damage: (e: Enemy, amount: number, from: Phaser.Math.Vector2, knockback: number, source: string) => boolean; // true = убит
  addZone: (x: number, y: number, radius: number, durationSec: number, dps: number, tickSec: number, slow?: number) => void;
  shootPlayer: (x: number, y: number, angle: number, speed: number, damage: number, onHit?: (e: Enemy, x: number, y: number) => void) => void;
}

export interface SkillView { key: string; name: string; ready01: number; charges?: number; maxCharges?: number }

export abstract class Skill {
  abstract readonly id: string;
  abstract key: string;
  constructor(protected scene: Phaser.Scene, protected player: Player, protected mods: Mods, protected field: Battlefield) {}
  abstract view(): SkillView;
  abstract tryCast(aim: Phaser.Math.Vector2): void;
  update(dt: number) { void dt; }
  /** Скилл блокирует обычное управление (рывок) */
  get locksControl() { return false; }
}

const D = SKILLS.dash_cut;
export class DashCut extends Skill {
  readonly id = 'dash_cut';
  key = 'ПКМ';
  private charges = D.resource.charges;
  private rechargeAt = 0;
  private until = 0;
  private dir = new Phaser.Math.Vector2();
  private start = new Phaser.Math.Vector2();
  private hit = new Set<Enemy>();
  private dashing = false;
  private trail: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, player: Player, mods: Mods, field: Battlefield) {
    super(scene, player, mods, field);
    this.trail = scene.add.graphics().setDepth(7);
  }
  get locksControl() { return this.scene.time.now < this.until; }
  get rechargeMs() { return D.resource.rechargeSec * 1000 * this.mods.cooldownMult; }
  view(): SkillView {
    const ready01 = this.charges === D.resource.charges ? 1 : Phaser.Math.Clamp(1 - (this.rechargeAt - this.scene.time.now) / this.rechargeMs, 0, 1);
    return { key: this.key, name: D.name, ready01, charges: this.charges, maxCharges: D.resource.charges };
  }
  tryCast(aim: Phaser.Math.Vector2) {
    const now = this.scene.time.now;
    if (this.charges <= 0 || this.locksControl) return;
    if (this.charges === D.resource.charges) this.rechargeAt = now + this.rechargeMs;
    this.charges--;
    const durationMs = 200;
    this.until = now + durationMs;
    this.dashing = true;
    this.start.set(this.player.x, this.player.y);
    this.dir.copy(aim).subtract(this.start).normalize();
    if (this.dir.lengthSq() === 0) this.dir.set(1, 0);
    const speed = D.base.length / (durationMs / 1000);
    this.player.setVelocity(this.dir.x * speed, this.dir.y * speed);
    this.player.grantInvuln(D.base.iframesSec * 1000);
    this.hit.clear();
    this.trail.clear().lineStyle(6, 0xf5f1e6, 0.6).lineBetween(this.start.x, this.start.y, this.start.x + this.dir.x * D.base.length, this.start.y + this.dir.y * D.base.length);
    this.scene.tweens.add({ targets: this.trail, alpha: { from: 1, to: 0 }, duration: 220, onComplete: () => { this.trail.clear(); this.trail.alpha = 1; } });
  }
  update() {
    const now = this.scene.time.now;
    if (this.charges < D.resource.charges && now >= this.rechargeAt) {
      this.charges++;
      if (this.charges < D.resource.charges) this.rechargeAt = now + this.rechargeMs;
    }
    if (!this.locksControl) {
      if (this.dashing) this.endDash();
      return;
    }
    const me = new Phaser.Math.Vector2(this.player.x, this.player.y);
    for (const e of this.field.enemies()) {
      if (this.hit.has(e) || !e.active) continue;
      if (Phaser.Math.Distance.BetweenPoints(me, e) <= e.def.radius + 16) {
        this.hit.add(e);
        const killed = this.field.damage(e, D.base.damage * this.mods.damageMult, this.start, 40, D.name);
        if (killed && this.mods.dash.secondWind) this.charges = Math.min(D.resource.charges, this.charges + 1);
      }
    }
  }
  private endDash() {
    this.player.setVelocity(0, 0);
    if (this.mods.dash.ashTrail) {
      const steps = 4;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        this.field.addZone(this.start.x + this.dir.x * D.base.length * t, this.start.y + this.dir.y * D.base.length * t, 28, 2, 16, 0.5);
      }
    }
    this.dashing = false;
  }
}

const S = SKILLS.spark;
export class Spark extends Skill {
  readonly id = 'spark';
  key = 'Q';
  private readyAt = 0;
  private fx: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene, player: Player, mods: Mods, field: Battlefield) {
    super(scene, player, mods, field);
    this.fx = scene.add.graphics().setDepth(12);
  }
  get cooldownMs() { return S.resource.cooldownSec * 1000 * this.mods.cooldownMult; }
  view(): SkillView {
    return { key: this.key, name: S.name, ready01: Phaser.Math.Clamp(1 - (this.readyAt - this.scene.time.now) / this.cooldownMs, 0, 1) };
  }
  tryCast() {
    const now = this.scene.time.now;
    if (now < this.readyAt) return;
    const alive = this.field.enemies().filter((e) => e.active);
    let from = new Phaser.Math.Vector2(this.player.x, this.player.y);
    let range = 260;
    const chain: Enemy[] = [];
    const jumps = S.base.jumps + this.mods.spark.extraJumps;
    for (let i = 0; i < jumps; i++) {
      let best: Enemy | null = null, bd = range;
      for (const e of alive) {
        if (chain.includes(e)) continue;
        const d = Phaser.Math.Distance.BetweenPoints(from, e);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) break;
      chain.push(best);
      from = new Phaser.Math.Vector2(best.x, best.y);
      range = S.base.jumpRange;
    }
    if (!chain.length) return;
    this.readyAt = now + this.cooldownMs;
    this.fx.clear().lineStyle(3, 0x8fd3ff, 0.95);
    let px = this.player.x, py = this.player.y;
    chain.forEach((e, i) => {
      this.fx.lineBetween(px, py, e.x, e.y);
      px = e.x; py = e.y;
      const dmg = S.base.damage * (1 - S.base.falloff) ** i * this.mods.damageMult;
      const last = i === chain.length - 1;
      const killed = this.field.damage(e, dmg, new Phaser.Math.Vector2(this.player.x, this.player.y), 30, S.name);
      if (last && !killed && this.mods.spark.grounding) e.stun(800);
    });
    this.scene.tweens.add({ targets: this.fx, alpha: { from: 1, to: 0 }, duration: 160, onComplete: () => { this.fx.clear(); this.fx.alpha = 1; } });
  }
}

// ---------- Осколочный выстрел ----------
const SH = SKILLS.shard_shot;
export class ShardShot extends Skill {
  readonly id = 'shard_shot';
  key = 'E';
  private readyAt = 0;
  get cooldownMs() { return SH.resource.cooldownSec * 1000 * this.mods.cooldownMult; }
  view(): SkillView { return { key: this.key, name: SH.name, ready01: Phaser.Math.Clamp(1 - (this.readyAt - this.scene.time.now) / this.cooldownMs, 0, 1) }; }
  tryCast(aim: Phaser.Math.Vector2) {
    const now = this.scene.time.now;
    if (now < this.readyAt) return;
    this.readyAt = now + this.cooldownMs;
    const a = Phaser.Math.Angle.Between(this.player.x, this.player.y, aim.x, aim.y);
    const dm = this.mods.damageMult;
    this.field.shootPlayer(this.player.x, this.player.y, a, SH.base.speed, SH.base.damage * dm, (_e, x, y) => {
      const spread = Phaser.Math.DegToRad(SH.base.spreadDeg);
      for (let i = 0; i < SH.base.shards; i++) {
        const sa = a + spread * (i - (SH.base.shards - 1) / 2);
        this.field.shootPlayer(x, y, sa, SH.base.speed * 1.1, SH.base.shardDamage * dm);
      }
    });
  }
}

// ---------- Гравитационный колодец ----------
const G = SKILLS.gravity_well;
export class GravityWell extends Skill {
  readonly id = 'gravity_well';
  key = 'R';
  private readyAt = 0;
  private center: Phaser.Math.Vector2 | null = null;
  private until = 0;
  private gfx: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene, player: Player, mods: Mods, field: Battlefield) {
    super(scene, player, mods, field);
    this.gfx = scene.add.graphics().setDepth(4);
  }
  get cooldownMs() { return G.resource.cooldownSec * 1000 * this.mods.cooldownMult; }
  view(): SkillView { return { key: this.key, name: G.name, ready01: Phaser.Math.Clamp(1 - (this.readyAt - this.scene.time.now) / this.cooldownMs, 0, 1) }; }
  tryCast(aim: Phaser.Math.Vector2) {
    const now = this.scene.time.now;
    if (now < this.readyAt) return;
    this.readyAt = now + this.cooldownMs;
    this.center = aim.clone();
    this.until = now + G.base.durationSec * 1000;
  }
  update() {
    if (!this.center) return;
    const now = this.scene.time.now;
    if (now >= this.until) { this.center = null; this.gfx.clear(); return; }
    const p = 1 - (this.until - now) / (G.base.durationSec * 1000);
    this.gfx.clear().lineStyle(2, 0xb58cff, 0.8).strokeCircle(this.center.x, this.center.y, G.base.radius * (1 - 0.3 * p));
    this.gfx.fillStyle(0xb58cff, 0.08).fillCircle(this.center.x, this.center.y, G.base.radius);
    for (const e of this.field.enemies()) {
      if (!e.active) continue;
      const d = Phaser.Math.Distance.BetweenPoints(this.center, e);
      if (d > G.base.radius || d < 8) continue;
      const strength = 420 * (1 - d / G.base.radius) + 80;
      e.pull.set((this.center.x - e.x) / d * strength, (this.center.y - e.y) / d * strength);
    }
  }
}

// ---------- Барьер-кольцо ----------
const B = SKILLS.barrier;
export class Barrier extends Skill {
  readonly id = 'barrier';
  key = 'F';
  private readyAt = 0;
  absorbLeft = 0;
  private gfx: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene, player: Player, mods: Mods, field: Battlefield) {
    super(scene, player, mods, field);
    this.gfx = scene.add.graphics().setDepth(11);
  }
  get active() { return this.absorbLeft > 0; }
  get cooldownMs() { return B.resource.cooldownSec * 1000 * this.mods.cooldownMult; }
  view(): SkillView { return { key: this.key, name: B.name, ready01: this.active ? 1 : Phaser.Math.Clamp(1 - (this.readyAt - this.scene.time.now) / this.cooldownMs, 0, 1) }; }
  tryCast() {
    const now = this.scene.time.now;
    if (now < this.readyAt || this.active) return;
    this.readyAt = now + this.cooldownMs;
    this.absorbLeft = B.base.absorb;
  }
  /** Возвращает урон, дошедший до игрока */
  absorb(amount: number): number {
    if (!this.active) return amount;
    const taken = Math.min(this.absorbLeft, amount);
    this.absorbLeft -= taken;
    if (this.absorbLeft <= 0) this.burst();
    return amount - taken;
  }
  private burst() {
    const c = new Phaser.Math.Vector2(this.player.x, this.player.y);
    const flash = this.scene.add.circle(c.x, c.y, B.base.burstRadius, 0x8fd3ff, 0.4).setDepth(6);
    this.scene.tweens.add({ targets: flash, alpha: 0, duration: 220, onComplete: () => flash.destroy() });
    for (const e of [...this.field.enemies()])
      if (e.active && Phaser.Math.Distance.BetweenPoints(c, e) <= B.base.burstRadius + e.def.radius) this.field.damage(e, B.base.burstDamage * this.mods.damageMult, c, 160, B.name);
    this.gfx.clear();
  }
  update() {
    this.gfx.clear();
    if (!this.active) return;
    this.gfx.lineStyle(3, 0x8fd3ff, 0.5 + 0.5 * (this.absorbLeft / B.base.absorb)).strokeCircle(this.player.x, this.player.y, 26);
  }
}

// ---------- Шипастая земля ----------
const SP = SKILLS.spike_ground;
export class SpikeGround extends Skill {
  readonly id = 'spike_ground';
  key = 'E';
  private readyAt = 0;
  get cooldownMs() { return SP.resource.cooldownSec * 1000 * this.mods.cooldownMult; }
  view(): SkillView { return { key: this.key, name: SP.name, ready01: Phaser.Math.Clamp(1 - (this.readyAt - this.scene.time.now) / this.cooldownMs, 0, 1) }; }
  tryCast(aim: Phaser.Math.Vector2) {
    const now = this.scene.time.now;
    if (now < this.readyAt) return;
    this.readyAt = now + this.cooldownMs;
    this.field.addZone(aim.x, aim.y, SP.base.radius, SP.base.durationSec, SP.base.damage / SP.base.tickSec, SP.base.tickSec, 1 - SP.base.slow);
  }
}

/** Фабрика: id скилла → экземпляр; пассивы (blood_rhythm) обрабатываются игроком */
export function createSkill(id: string, scene: Phaser.Scene, player: Player, mods: Mods, field: Battlefield): Skill | null {
  switch (id) {
    case 'dash_cut': return new DashCut(scene, player, mods, field);
    case 'spark': return new Spark(scene, player, mods, field);
    case 'shard_shot': return new ShardShot(scene, player, mods, field);
    case 'gravity_well': return new GravityWell(scene, player, mods, field);
    case 'barrier': return new Barrier(scene, player, mods, field);
    case 'spike_ground': return new SpikeGround(scene, player, mods, field);
    default: return null;
  }
}

/** Раскладка: мобильность — ПКМ, остальные активные — Q, E, R, F в порядке получения */
export function assignKeys(skills: Skill[]): void {
  const keys = ['Q', 'E', 'R', 'F'];
  let i = 0;
  for (const s of skills) {
    if (s.id === 'dash_cut') { (s as { key: string }).key = 'ПКМ'; continue; }
    (s as { key: string }).key = keys[i++] ?? '—';
  }
}

export const MVP_SKILLS = ['dash_cut', 'spark', 'blood_rhythm'];
