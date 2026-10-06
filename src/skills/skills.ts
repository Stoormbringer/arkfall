import Phaser from 'phaser';
import SKILLS from '../data/skills.json';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { Mods } from '../run/mods';

/** Что бой даёт скиллам: нанести урон, оглушить, положить зону на землю */
export interface Battlefield {
  enemies: () => Enemy[];
  damage: (e: Enemy, amount: number, from: Phaser.Math.Vector2, knockback: number, source: string) => boolean; // true = убит
  addZone: (x: number, y: number, radius: number, durationSec: number, dps: number, tickSec: number) => void;
}

export interface SkillView { key: string; name: string; ready01: number; charges?: number; maxCharges?: number }

export abstract class Skill {
  abstract readonly id: string;
  abstract readonly key: string;
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
  readonly key = 'ПКМ';
  private charges = D.resource.charges;
  private rechargeAt = 0;
  private until = 0;
  private dir = new Phaser.Math.Vector2();
  private start = new Phaser.Math.Vector2();
  private hit = new Set<Enemy>();
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
      if (this.until && now >= this.until && now < this.until + 20) this.endDash();
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
    this.until = 0;
  }
}

const S = SKILLS.spark;
export class Spark extends Skill {
  readonly id = 'spark';
  readonly key = 'Q';
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

export const MVP_SKILLS = ['dash_cut', 'spark', 'blood_rhythm'];
