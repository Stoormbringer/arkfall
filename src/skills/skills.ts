import Phaser from 'phaser';
import SKILLS from '../data/skills.json';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import { NO_SKILL_MODS, type Mods, type SkillMods } from '../run/mods';

/** Что бой даёт скиллам: нанести урон, оглушить, положить зону на землю */
export interface Battlefield {
  enemies: () => Enemy[];
  damage: (e: Enemy, amount: number, from: Phaser.Math.Vector2, knockback: number, source: string) => boolean; // true = убит
  addZone: (x: number, y: number, radius: number, durationSec: number, dps: number, tickSec: number, slow?: number, opts?: ZoneOpts) => void;
  shootPlayer: (x: number, y: number, angle: number, speed: number, damage: number, onHit?: (e: Enemy, x: number, y: number) => void, bounces?: number) => void;
  /** всплывающий текст над точкой */
  float?: (x: number, y: number, text: string, color: string) => void;
  /** частицы и ударная волна (арена) */
  burst?: (frame: string, x: number, y: number, n: number) => void;
  shockwave?: (x: number, y: number, radius: number, color: number) => void;
  /** прямая видимость (колонны формы комнаты) */
  hasLos?: (x0: number, y0: number, x1: number, y1: number) => boolean;
}

/** Дополнительные эффекты зоны (Руны Шипастой земли) */
export interface ZoneOpts { poisonSec?: number; poisonDps?: number; rootSec?: number }

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
  /** Ответ эхом: сбросить часть отката */
  refund(ms: number) { void ms; }
  /** Прокачка этого скилла (пакет 31) */
  get up(): SkillMods { return this.mods.skill[this.id] ?? NO_SKILL_MODS; }
}

/** Общий откат: readyAt + refund */
abstract class CooldownSkill extends Skill {
  protected readyAt = 0;
  refund(ms: number) { this.readyAt -= ms; }
}

const D = SKILLS.dash_cut;
export class DashCut extends Skill {
  readonly id = 'dash_cut';
  key = 'ПКМ';
  private charges = D.resource.charges;
  get maxCharges() { return D.resource.charges + this.up.charges; }
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
  refund(ms: number) { this.rechargeAt -= ms; }
  get locksControl() { return this.scene.time.now < this.until; }
  get rechargeMs() { return D.resource.rechargeSec * 1000 * this.mods.cooldownMult * this.up.cooldown; }
  view(): SkillView {
    const ready01 = this.charges === this.maxCharges ? 1 : Phaser.Math.Clamp(1 - (this.rechargeAt - this.scene.time.now) / this.rechargeMs, 0, 1);
    return { key: this.key, name: D.name, ready01, charges: this.charges, maxCharges: this.maxCharges };
  }
  tryCast(aim: Phaser.Math.Vector2) {
    const now = this.scene.time.now;
    if (this.charges <= 0 || this.locksControl) return;
    if (this.charges === this.maxCharges) this.rechargeAt = now + this.rechargeMs;
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
    this.scene.game.events.emit('sfx', 'dash');
    this.hit.clear();
    // послеобразы героя вдоль рывка — багровые, тают за 260 мс
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const g = this.scene.add.image(this.start.x + this.dir.x * D.base.length * t, this.start.y + this.dir.y * D.base.length * t, 'sprites', this.player.frame.name)
        .setScale(this.player.scaleX, this.player.scaleY).setFlipX(this.player.flipX).setTint(0xb02030).setAlpha(0.5).setDepth(9);
      this.scene.tweens.add({ targets: g, alpha: 0, duration: 260, delay: i * 40, onComplete: () => g.destroy() });
    }
    this.trail.clear().lineStyle(6, 0xb02030, 0.5).lineBetween(this.start.x, this.start.y, this.start.x + this.dir.x * D.base.length, this.start.y + this.dir.y * D.base.length);
    this.scene.tweens.add({ targets: this.trail, alpha: { from: 1, to: 0 }, duration: 220, onComplete: () => { this.trail.clear(); this.trail.alpha = 1; } });
  }
  update() {
    const now = this.scene.time.now;
    if (this.charges < this.maxCharges && now >= this.rechargeAt) {
      this.charges++;
      if (this.charges < this.maxCharges) this.rechargeAt = now + this.rechargeMs;
    }
    if (!this.locksControl) {
      if (this.dashing) this.endDash();
      return;
    }
    const me = new Phaser.Math.Vector2(this.player.x, this.player.y);
    for (const e of this.field.enemies()) {
      if (this.hit.has(e) || !e.active) continue;
      if (Phaser.Math.Distance.BetweenPoints(me, e) <= e.def.radius + 16 * this.up.area) {
        this.hit.add(e);
        const killed = this.field.damage(e, D.base.damage * this.mods.damageMult * this.up.damage, this.start, 40, D.name);
        if (killed && this.mods.dash.secondWind) this.charges = Math.min(this.maxCharges, this.charges + 1);
      }
    }
  }
  private endDash() {
    this.player.setVelocity(0, 0);
    this.field.burst?.('p_crimson', this.player.x, this.player.y, 6);
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
export class Spark extends CooldownSkill {
  readonly id = 'spark';
  key = 'Q';
  private fx: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene, player: Player, mods: Mods, field: Battlefield) {
    super(scene, player, mods, field);
    this.fx = scene.add.graphics().setDepth(12);
  }
  get cooldownMs() { return S.resource.cooldownSec * 1000 * this.mods.cooldownMult * this.up.cooldown; }
  view(): SkillView {
    return { key: this.key, name: S.name, ready01: Phaser.Math.Clamp(1 - (this.readyAt - this.scene.time.now) / this.cooldownMs, 0, 1) };
  }
  tryCast() {
    const now = this.scene.time.now;
    if (now < this.readyAt) return;
    const alive = this.field.enemies().filter((e) => e.active);
    let from = new Phaser.Math.Vector2(this.player.x, this.player.y);
    let range = 260 * this.up.area;
    const chain: Enemy[] = [];
    const jumps = S.base.jumps + this.mods.spark.extraJumps + this.up.projectiles;
    for (let i = 0; i < jumps; i++) {
      let best: Enemy | null = null, bd = range;
      for (const e of alive) {
        if (chain.includes(e)) continue;
        if (this.field.hasLos && !this.field.hasLos(from.x, from.y, e.x, e.y)) continue;
        const d = Phaser.Math.Distance.BetweenPoints(from, e);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) break;
      chain.push(best);
      from = new Phaser.Math.Vector2(best.x, best.y);
      range = S.base.jumpRange * this.up.area;
    }
    if (!chain.length) return;
    this.readyAt = now + this.cooldownMs;
    this.fx.clear();
    let px = this.player.x, py = this.player.y;
    chain.forEach((e, i) => {
      this.lightning(px, py, e.x, e.y);
      px = e.x; py = e.y;
      const dmg = S.base.damage * (1 - S.base.falloff) ** i * this.mods.damageMult * this.up.damage;
      const last = i === chain.length - 1;
      const killed = this.field.damage(e, dmg, new Phaser.Math.Vector2(this.player.x, this.player.y), 30, S.name);
      if (last && !killed && this.mods.spark.grounding) e.stun(800);
    });
    this.scene.tweens.add({ targets: this.fx, alpha: { from: 1, to: 0 }, duration: 160, onComplete: () => { this.fx.clear(); this.fx.alpha = 1; } });
  }
  /** Ветвистая молния: ломаная со случайным изломом, широкий ореол + яркая сердцевина, искры в узлах */
  private lightning(x0: number, y0: number, x1: number, y1: number) {
    const n = Math.max(3, Math.round(Phaser.Math.Distance.Between(x0, y0, x1, y1) / 22));
    const pts: [number, number][] = [[x0, y0]];
    const nx = -(y1 - y0), ny = x1 - x0, len = Math.hypot(nx, ny) || 1;
    for (let i = 1; i < n; i++) { const t = i / n, j = (Math.random() - 0.5) * 18; pts.push([x0 + (x1 - x0) * t + (nx / len) * j, y0 + (y1 - y0) * t + (ny / len) * j]); }
    pts.push([x1, y1]);
    for (const [w, a, c] of [[7, 0.25, 0x8fd3ff], [3, 0.9, 0xcfefff], [1, 1, 0xffffff]] as const) {
      this.fx.lineStyle(w, c, a);
      for (let i = 1; i < pts.length; i++) this.fx.lineBetween(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    }
    const spark = this.scene.add.image(x1, y1, 'sprites', 'fx_bolt').setScale(1.6).setDepth(12).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: spark, scale: 0.4, alpha: 0, angle: 90, duration: 220, onComplete: () => spark.destroy() });
    this.field.burst?.('p_spark', x1, y1, 3);
  }
}

// ---------- Осколочный выстрел ----------
const SH = SKILLS.shard_shot;
export class ShardShot extends CooldownSkill {
  readonly id = 'shard_shot';
  key = 'E';
  get cooldownMs() { return SH.resource.cooldownSec * 1000 * this.mods.cooldownMult * this.up.cooldown; }
  view(): SkillView { return { key: this.key, name: SH.name, ready01: Phaser.Math.Clamp(1 - (this.readyAt - this.scene.time.now) / this.cooldownMs, 0, 1) }; }
  tryCast(aim: Phaser.Math.Vector2) {
    const now = this.scene.time.now;
    if (now < this.readyAt) return;
    this.readyAt = now + this.cooldownMs;
    const a = Phaser.Math.Angle.Between(this.player.x, this.player.y, aim.x, aim.y);
    this.scene.game.events.emit('sfx', 'shot');
    const dm = this.mods.damageMult * this.up.damage;
    const b = this.mods.shardShot.bounces;
    const shards = SH.base.shards + this.up.projectiles;
    const split = (x: number, y: number, a0: number, dmg: number, again: boolean) => {
      const spread = Phaser.Math.DegToRad(SH.base.spreadDeg) * this.up.area;
      for (let i = 0; i < shards; i++) {
        const sa = a0 + spread * (i - (shards - 1) / 2);
        // Жадные осколки: каждый осколок делится ещё раз (один раз), урон ×0,5
        const onHit = again ? (_e: Enemy, hx: number, hy: number) => split(hx, hy, sa, dmg * this.mods.shardShot.splitDamageMult, false) : undefined;
        this.field.shootPlayer(x, y, sa, SH.base.speed * 1.1, dmg, onHit, b);
      }
    };
    this.field.shootPlayer(this.player.x, this.player.y, a, SH.base.speed, SH.base.damage * dm, (_e, x, y) => split(x, y, a, SH.base.shardDamage * dm, this.mods.shardShot.splitAgain), b);
  }
}

// ---------- Гравитационный колодец ----------
const G = SKILLS.gravity_well;
export class GravityWell extends CooldownSkill {
  readonly id = 'gravity_well';
  key = 'R';
  private center: Phaser.Math.Vector2 | null = null;
  private until = 0;
  private gfx: Phaser.GameObjects.Graphics;
  private swirl: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  constructor(scene: Phaser.Scene, player: Player, mods: Mods, field: Battlefield) {
    super(scene, player, mods, field);
    this.gfx = scene.add.graphics().setDepth(4);
  }
  get cooldownMs() { return Math.max(1000, (G.resource.cooldownSec + this.mods.well.cooldownBonusSec) * 1000) * this.mods.cooldownMult * this.up.cooldown; }
  get durationMs() { return (G.base.durationSec + this.mods.well.durationBonusSec) * 1000 * this.up.duration; }
  get radius() { return G.base.radius * this.up.area; }
  view(): SkillView { return { key: this.key, name: G.name, ready01: Phaser.Math.Clamp(1 - (this.readyAt - this.scene.time.now) / this.cooldownMs, 0, 1) }; }
  tryCast(aim: Phaser.Math.Vector2) {
    const now = this.scene.time.now;
    if (now < this.readyAt) return;
    this.readyAt = now + this.cooldownMs;
    this.center = aim.clone();
    this.until = now + this.durationMs;
    // воронка: частицы с края летят в центр
    this.swirl?.destroy();
    const R = this.radius;
    this.swirl = this.scene.add.particles(aim.x, aim.y, 'sprites', {
      frame: ['p_magic', 'p_spark'], lifespan: 500, speed: { min: 180, max: 260 }, scale: { start: 1.4, end: 0.2 }, alpha: { start: 0.9, end: 0 }, frequency: 18, quantity: 2,
      emitZone: { type: 'edge' as const, source: new Phaser.Geom.Circle(0, 0, R), quantity: 32 }, moveToX: 0, moveToY: 0,
    }).setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
  }
  update() {
    if (!this.center) return;
    const now = this.scene.time.now;
    if (now >= this.until) {
      // Сжатие: взрыв в конце тяги
      if (this.mods.well.burstDamage > 0) {
        const c = this.center;
        const flash = this.scene.add.circle(c.x, c.y, G.base.radius, 0xb58cff, 0.35).setDepth(6);
        this.scene.tweens.add({ targets: flash, alpha: 0, duration: 220, onComplete: () => flash.destroy() });
        for (const e of [...this.field.enemies()]) if (e.active && Phaser.Math.Distance.BetweenPoints(c, e) <= G.base.radius + e.def.radius) this.field.damage(e, this.mods.well.burstDamage * this.mods.damageMult, c, 120, 'Сжатие');
      }
      this.center = null; this.gfx.clear(); this.swirl?.stop(); const sw = this.swirl; this.scene.time.delayedCall(600, () => sw?.destroy()); this.swirl = null; return;
    }
    const p = 1 - (this.until - now) / this.durationMs;
    const R = this.radius;
    this.gfx.clear().lineStyle(2, 0xb58cff, 0.8).strokeCircle(this.center.x, this.center.y, R * (1 - 0.3 * p));
    this.gfx.fillStyle(0xb58cff, 0.08).fillCircle(this.center.x, this.center.y, R);
    for (const e of this.field.enemies()) {
      if (!e.active) continue;
      const d = Phaser.Math.Distance.BetweenPoints(this.center, e);
      if (d > R || d < 8) continue;
      const strength = 420 * (1 - d / R) + 80;
      e.pull.set((this.center.x - e.x) / d * strength, (this.center.y - e.y) / d * strength);
    }
  }
}

// ---------- Барьер-кольцо ----------
const B = SKILLS.barrier;
export class Barrier extends CooldownSkill {
  readonly id = 'barrier';
  key = 'F';
  absorbLeft = 0;
  private absorbed = 0;
  private gfx: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene, player: Player, mods: Mods, field: Battlefield) {
    super(scene, player, mods, field);
    this.gfx = scene.add.graphics().setDepth(11);
  }
  get active() { return this.absorbLeft > 0; }
  get cooldownMs() { return B.resource.cooldownSec * 1000 * this.mods.cooldownMult * this.up.cooldown; }
  view(): SkillView { return { key: this.key, name: B.name, ready01: this.active ? 1 : Phaser.Math.Clamp(1 - (this.readyAt - this.scene.time.now) / this.cooldownMs, 0, 1) }; }
  tryCast() {
    const now = this.scene.time.now;
    if (now < this.readyAt || this.active) return;
    this.readyAt = now + this.cooldownMs;
    this.absorbLeft = B.base.absorb * this.up.duration;
    this.absorbed = 0;
  }
  /** Возвращает урон, дошедший до игрока */
  absorb(amount: number): number {
    if (!this.active) return amount;
    const taken = Math.min(this.absorbLeft, amount);
    this.absorbLeft -= taken;
    this.absorbed += taken;
    if (this.absorbLeft <= 0) this.burst();
    return amount - taken;
  }
  private burst() {
    const c = new Phaser.Math.Vector2(this.player.x, this.player.y);
    const flash = this.scene.add.circle(c.x, c.y, B.base.burstRadius * this.up.area, 0x8fd3ff, 0.25).setDepth(6);
    this.scene.tweens.add({ targets: flash, alpha: 0, duration: 220, onComplete: () => flash.destroy() });
    this.field.shockwave?.(c.x, c.y, B.base.burstRadius * this.up.area, 0x8fd3ff);
    for (const e of [...this.field.enemies()])
      if (e.active && Phaser.Math.Distance.BetweenPoints(c, e) <= B.base.burstRadius * this.up.area + e.def.radius && (!this.field.hasLos || this.field.hasLos(c.x, c.y, e.x, e.y))) this.field.damage(e, (B.base.burstDamage + this.absorbed * this.mods.barrier.absorbToBurst) * this.mods.damageMult * this.up.damage, c, 160, B.name);
    this.gfx.clear();
  }
  update() {
    this.gfx.clear();
    // Мгновенный: срабатывает сам при низком HP, с собственным откатом
    if (!this.active && this.mods.barrier.autoAtHp > 0 && this.player.hp / this.player.maxHp <= this.mods.barrier.autoAtHp && this.scene.time.now >= this.readyAt) {
      this.readyAt = this.scene.time.now + this.mods.barrier.autoCooldownSec * 1000 * this.mods.cooldownMult;
      this.absorbLeft = B.base.absorb; this.absorbed = 0;
      this.field.float?.(this.player.x, this.player.y - 30, 'барьер!', '#8fd3ff');
    }
    if (!this.active) return;
    this.gfx.lineStyle(3, 0x8fd3ff, 0.5 + 0.5 * (this.absorbLeft / B.base.absorb)).strokeCircle(this.player.x, this.player.y, 26);
  }
}

// ---------- Шипастая земля ----------
const SP = SKILLS.spike_ground;
export class SpikeGround extends CooldownSkill {
  readonly id = 'spike_ground';
  key = 'E';
  get cooldownMs() { return SP.resource.cooldownSec * 1000 * this.mods.cooldownMult * this.up.cooldown; }
  view(): SkillView { return { key: this.key, name: SP.name, ready01: Phaser.Math.Clamp(1 - (this.readyAt - this.scene.time.now) / this.cooldownMs, 0, 1) }; }
  tryCast(aim: Phaser.Math.Vector2) {
    const now = this.scene.time.now;
    if (now < this.readyAt) return;
    this.readyAt = now + this.cooldownMs;
    const sp = this.mods.spike;
    this.field.addZone(aim.x, aim.y, SP.base.radius * this.up.area, SP.base.durationSec * this.up.duration, SP.base.damage * this.up.damage / SP.base.tickSec, SP.base.tickSec, 1 - SP.base.slow,
      { poisonSec: sp.poisonSec, poisonDps: sp.poisonDps, rootSec: sp.rootSec });
  }
}

// ---------- Эхо-удар ----------
const ES = SKILLS.echo_strike;
export class EchoStrike extends CooldownSkill {
  readonly id = 'echo_strike';
  key = 'R';
  private windupUntil = 0;
  private aim = new Phaser.Math.Vector2();
  private gfx: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene, player: Player, mods: Mods, field: Battlefield) {
    super(scene, player, mods, field);
    this.gfx = scene.add.graphics().setDepth(12);
  }
  get cooldownMs() { return ES.resource.cooldownSec * 1000 * this.mods.cooldownMult * this.up.cooldown; }
  get radius() { return ES_RADIUS * this.up.area; }
  get windupMs() { return (ES.base.windupSec + this.mods.echoStrike.windupBonusSec) * 1000; }
  get locksControl() { return this.scene.time.now < this.windupUntil; }
  view(): SkillView { return { key: this.key, name: ES.name, ready01: Phaser.Math.Clamp(1 - (this.readyAt - this.scene.time.now) / this.cooldownMs, 0, 1) }; }
  tryCast(aim: Phaser.Math.Vector2) {
    const now = this.scene.time.now;
    if (now < this.readyAt || this.locksControl) return;
    this.readyAt = now + this.cooldownMs;
    this.windupUntil = now + this.windupMs;
    this.aim.copy(aim);
    this.player.setVelocity(0, 0);
  }
  update() {
    const now = this.scene.time.now;
    if (this.windupUntil === 0) return;
    if (now < this.windupUntil) {
      this.player.setVelocity(0, 0);
      const p = 1 - (this.windupUntil - now) / this.windupMs;
      this.gfx.clear().lineStyle(2, 0xf5f1e6, 0.9).strokeCircle(this.player.x, this.player.y, this.radius).fillStyle(0xf5f1e6, 0.08 + 0.25 * p).fillCircle(this.player.x, this.player.y, this.radius * p);
      return;
    }
    this.windupUntil = 0;
    this.strike();
  }
  private strike() {
    const c = new Phaser.Math.Vector2(this.player.x, this.player.y);
    const stacks = this.player.rhythmStacks;
    const dmg = ES.base.damage * (1 + ES.base.rhythmBonusPerStack * stacks) * this.mods.damageMult * this.mods.echoStrike.damageMult * this.up.damage;
    if (ES.base.consumesRhythm) this.player.rhythmStacks = 0;
    const flash = this.scene.add.circle(c.x, c.y, this.radius, 0xf5f1e6, 0.25).setDepth(6);
    this.scene.tweens.add({ targets: flash, alpha: 0, duration: 200, onComplete: () => flash.destroy() });
    this.field.shockwave?.(c.x, c.y, this.radius, 0xf0c75e);
    this.field.burst?.('p_steel', c.x, c.y, 12);
    for (const e of [...this.field.enemies()]) {
      if (!e.active || Phaser.Math.Distance.BetweenPoints(c, e) > this.radius + e.def.radius) continue;
      if (this.field.hasLos && !this.field.hasLos(c.x, c.y, e.x, e.y)) continue;
      const killed = this.field.damage(e, dmg, c, 180, ES.name);
      if (!killed) e.stun(ES.base.stunSec * 1000 * this.up.duration);
    }
    // Разлом: волна по направлению прицела
    const w = this.mods.echoStrike;
    if (w.waveLength > 0) {
      const a = Phaser.Math.Angle.BetweenPoints(c, this.aim);
      const ex = c.x + Math.cos(a) * w.waveLength, ey = c.y + Math.sin(a) * w.waveLength;
      this.gfx.clear().lineStyle(8, 0xf0c75e, 0.7).lineBetween(c.x, c.y, ex, ey);
      const line = new Phaser.Geom.Line(c.x, c.y, ex, ey);
      for (const e of [...this.field.enemies()]) {
        if (!e.active) continue;
        const p = Phaser.Geom.Line.GetNearestPoint(line, e, new Phaser.Geom.Point());
        const t = Phaser.Math.Distance.Between(c.x, c.y, p.x, p.y) / w.waveLength;
        if (t <= 1 && Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y) <= 30 + e.def.radius) this.field.damage(e, w.waveDamage * this.mods.damageMult, c, 60, 'Разлом');
      }
    }
    this.scene.tweens.add({ targets: this.gfx, alpha: { from: 1, to: 0 }, duration: 220, onComplete: () => { this.gfx.clear(); this.gfx.alpha = 1; } });
  }
}
const ES_RADIUS = 100;

// ---------- Призрачный клинок ----------
const PB = SKILLS.phantom_blade;
interface Blade { nextAttackAt: number; gfx: Phaser.GameObjects.Rectangle }
export class PhantomBlade extends CooldownSkill {
  readonly id = 'phantom_blade';
  key = 'F';
  private blades: Blade[] = [];
  private until = 0;
  private fx: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene, player: Player, mods: Mods, field: Battlefield) {
    super(scene, player, mods, field);
    this.fx = scene.add.graphics().setDepth(12);
  }
  get active() { return this.blades.length > 0; }
  get cooldownMs() { return PB.resource.cooldownSec * 1000 * this.mods.cooldownMult * this.up.cooldown; }
  /** урон клинка: база (или Верность) × Двойник × половина бонуса оружия */
  get bladeDamage() {
    const base = this.mods.phantom.damageOverride ?? PB.base.damage;
    return base * this.mods.phantom.damageMult * this.up.damage * (1 + (this.mods.damageMult - 1) * PB.base.inheritWeaponBonus);
  }
  view(): SkillView { return { key: this.key, name: PB.name, ready01: this.active ? 1 : Phaser.Math.Clamp(1 - (this.readyAt - this.scene.time.now) / this.cooldownMs, 0, 1) }; }
  tryCast() {
    const now = this.scene.time.now;
    if (now < this.readyAt || this.active) return;
    this.readyAt = now + this.cooldownMs;
    this.until = this.mods.phantom.permanent ? Infinity : now + PB.base.durationSec * 1000 * this.up.duration;
    for (let i = 0; i < this.mods.phantom.count + this.up.projectiles; i++)
      this.blades.push({ nextAttackAt: now + PB.base.attackSec * 1000 * (0.5 + i * 0.5), gfx: this.scene.add.rectangle(this.player.x, this.player.y, 6, 22, 0xd8d0ff, 0.9).setDepth(11) });
  }
  update() {
    if (!this.active) return;
    const now = this.scene.time.now;
    if (now >= this.until) { this.dismiss(); return; }
    const alive = this.field.enemies().filter((e) => e.active);
    this.blades.forEach((b, i) => {
      const a = now / 600 + (i * Math.PI * 2) / this.blades.length;
      b.gfx.setPosition(this.player.x + Math.cos(a) * 42, this.player.y + Math.sin(a) * 42).setRotation(a + Math.PI / 2);
      if (now < b.nextAttackAt) return;
      let best: Enemy | null = null, bd = PB_RANGE;
      for (const e of alive) { const d = Phaser.Math.Distance.BetweenPoints(this.player, e); if (d < bd) { bd = d; best = e; } }
      if (!best) return;
      b.nextAttackAt = now + PB.base.attackSec * 1000;
      this.fx.lineStyle(2, 0xd8d0ff, 0.9).lineBetween(b.gfx.x, b.gfx.y, best.x, best.y);
      this.scene.tweens.add({ targets: this.fx, alpha: { from: 1, to: 0 }, duration: 120, onComplete: () => { this.fx.clear(); this.fx.alpha = 1; } });
      this.field.damage(best, this.bladeDamage, new Phaser.Math.Vector2(b.gfx.x, b.gfx.y), 30, PB.name);
    });
  }
  private dismiss() { for (const b of this.blades) b.gfx.destroy(); this.blades = []; }
}
const PB_RANGE = 150;

/** Фабрика: id скилла → экземпляр; пассивы (blood_rhythm, riposte) обрабатываются игроком и ареной */
export function createSkill(id: string, scene: Phaser.Scene, player: Player, mods: Mods, field: Battlefield): Skill | null {
  switch (id) {
    case 'dash_cut': return new DashCut(scene, player, mods, field);
    case 'spark': return new Spark(scene, player, mods, field);
    case 'shard_shot': return new ShardShot(scene, player, mods, field);
    case 'gravity_well': return new GravityWell(scene, player, mods, field);
    case 'barrier': return new Barrier(scene, player, mods, field);
    case 'spike_ground': return new SpikeGround(scene, player, mods, field);
    case 'echo_strike': return new EchoStrike(scene, player, mods, field);
    case 'phantom_blade': return new PhantomBlade(scene, player, mods, field);
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
