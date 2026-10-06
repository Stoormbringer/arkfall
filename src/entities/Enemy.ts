import Phaser from 'phaser';
import type { EnemyDef, EnemyId } from '../data/types';
import { enemyDmg, enemyHp, enemyHpHeavy, enemySpd, telegraphSec } from '../core/formulas';

type Phase = 'chase' | 'windup' | 'strike' | 'recover' | 'stunned';

export interface EnemyContext {
  player: Phaser.Physics.Arcade.Sprite;
  shoot: (x: number, y: number, angle: number, speed: number, dmg: number, source: string) => void;
  hitPlayer: (dmg: number, source: string) => void;
  spawnAdd?: (x: number, y: number, id: 'rusher' | 'shooter') => void;
  aliveCount?: () => number;
}

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  readonly id: EnemyId;
  readonly def: EnemyDef;
  hp: number;
  readonly maxHp: number;
  readonly dmg: number;
  readonly speed: number;
  windupMs: number;
  recoverSecOverride: number | null = null;
  readonly isBoss: boolean;
  phase: Phase = 'chase';
  phaseUntil = 0;
  firstHitAt: number | null = null; // для TTK
  hitsTaken = 0;
  lastHitBy = ''; // источник последнего урона (для аналитики убийств)
  slowUntil = 0;
  slowMult = 1;
  /** внешняя сила (тяга колодца), прибавляется к скорости на этот кадр */
  pull = new Phaser.Math.Vector2();
  private strikeAngle = 0;
  private struck = false;
  private tele: Phaser.GameObjects.Graphics;
  private hpBar: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, id: EnemyId, def: EnemyDef, tier: number, room: number) {
    super(scene, x, y, `enemy-${id}`);
    this.id = id;
    this.def = def;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCircle(def.radius, 0, 0);
    this.setCollideWorldBounds(true);
    this.setDepth(8);
    this.maxHp = Math.round(def.role === 'tank' ? enemyHpHeavy(def.hp, tier, room) : enemyHp(def.hp, tier, room));
    this.hp = this.maxHp;
    this.dmg = Math.round(enemyDmg(def.dmg, tier, room));
    this.speed = enemySpd(def.speed, tier);
    this.windupMs = telegraphSec(def.attack.windupSec, tier) * 1000;
    this.isBoss = !!def.boss;
    this.tele = scene.add.graphics().setDepth(5);
    this.hpBar = scene.add.graphics().setDepth(12);
  }

  takeDamage(amount: number, knockFrom: Phaser.Math.Vector2, knockback: number): boolean {
    const now = this.scene.time.now;
    if (this.firstHitAt === null) this.firstHitAt = now;
    this.hitsTaken++;
    this.hp -= amount;
    const dir = new Phaser.Math.Vector2(this.x, this.y).subtract(knockFrom).normalize();
    const kb = this.def.role === 'tank' ? knockback * 0.25 : knockback;
    this.setVelocity(dir.x * kb, dir.y * kb);
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => this.active && this.clearTint());
    if (this.hp <= 0) { this.die(); return true; }
    return false;
  }

  stun(ms: number) {
    if (!this.active) return;
    this.tele.clear();
    this.phase = 'stunned';
    this.phaseUntil = this.scene.time.now + ms;
    this.setVelocity(0, 0);
    this.setTint(0xa0c8ff);
  }

  die() {
    this.tele.destroy();
    this.hpBar.destroy();
    this.destroy();
  }

  applySlow(mult: number, ms: number) {
    this.slowMult = Math.min(this.slowMult, mult);
    this.slowUntil = Math.max(this.slowUntil, this.scene.time.now + ms);
  }

  update(ctx: EnemyContext) {
    if (!this.active) return;
    const now = this.scene.time.now;
    if (now >= this.slowUntil) this.slowMult = 1;
    const me = this.getCenter();
    const target = ctx.player.getCenter();
    const dist = Phaser.Math.Distance.BetweenPoints(me, target);
    const toTarget = Phaser.Math.Angle.BetweenPoints(me, target);
    const atk = this.def.attack;
    const spd = this.speed * this.slowMult;

    switch (this.phase) {
      case 'chase': {
        if (atk.kind === 'shoot') {
          // держит дистанцию: отступает, если игрок близко; стреляет из зоны
          const want = atk.keepDistance;
          const dir = dist < want - 40 ? -1 : dist > want + 40 ? 1 : 0;
          this.scene.physics.velocityFromRotation(toTarget, spd * dir, this.body!.velocity as Phaser.Math.Vector2);
          if (dist <= atk.range) this.beginWindup(now, toTarget);
        } else {
          this.scene.physics.velocityFromRotation(toTarget, spd, this.body!.velocity as Phaser.Math.Vector2);
          if (dist <= atk.range) this.beginWindup(now, toTarget);
        }
        break;
      }
      case 'windup': {
        this.setVelocity(0, 0);
        const p = Phaser.Math.Clamp(1 - (this.phaseUntil - now) / this.windupMs, 0, 1);
        this.drawTelegraph(p);
        if (now >= this.phaseUntil) this.beginStrike(now, ctx);
        break;
      }
      case 'strike': {
        if (atk.kind === 'lunge') {
          const r = this.def.radius + 14;
          if (!this.struck && Phaser.Math.Distance.BetweenPoints(this.getCenter(), target) < r + 12) {
            this.struck = true;
            ctx.hitPlayer(this.dmg, this.def.name);
          }
        }
        if (now >= this.phaseUntil) { this.setVelocity(0, 0); this.phase = 'recover'; this.phaseUntil = now + (this.recoverSecOverride ?? atk.recoverSec) * 1000; }
        break;
      }
      case 'recover': {
        this.setVelocity(0, 0);
        if (now >= this.phaseUntil) this.phase = 'chase';
        break;
      }
      case 'stunned': {
        this.setVelocity(0, 0);
        if (now >= this.phaseUntil) { this.clearTint(); this.phase = 'chase'; }
        break;
      }
    }
    if (this.pull.lengthSq() > 0 && !this.isBoss && this.def.role !== 'tank') {
      const v = this.body!.velocity as Phaser.Math.Vector2;
      v.add(this.pull);
      this.pull.set(0, 0);
    } else this.pull.set(0, 0);
    this.drawHp();
  }

  private beginWindup(now: number, angle: number) {
    this.phase = 'windup';
    this.phaseUntil = now + this.windupMs;
    this.strikeAngle = angle;
    this.struck = false;
  }

  /** Хук для боссов: вызывается в момент удара */
  protected onStrike(_ctx: EnemyContext) { void _ctx; }

  private beginStrike(now: number, ctx: EnemyContext) {
    this.onStrike(ctx);
    this.tele.clear();
    const atk = this.def.attack;
    const me = this.getCenter();
    this.phase = 'strike';
    if (atk.kind === 'lunge') {
      this.phaseUntil = now + atk.lungeSec * 1000;
      this.scene.physics.velocityFromRotation(this.strikeAngle, atk.lungeSpeed, this.body!.velocity as Phaser.Math.Vector2);
    } else if (atk.kind === 'shoot') {
      this.phaseUntil = now + 50;
      ctx.shoot(me.x, me.y, this.strikeAngle, atk.projectileSpeed, this.dmg, this.def.name);
    } else {
      this.phaseUntil = now + 120;
      const target = ctx.player.getCenter();
      if (Phaser.Math.Distance.BetweenPoints(me, target) <= atk.aoeRadius) ctx.hitPlayer(this.dmg, this.def.name);
      const flash = this.scene.add.circle(me.x, me.y, atk.aoeRadius, 0xffd27a, 0.45).setDepth(6);
      this.scene.tweens.add({ targets: flash, alpha: 0, duration: 180, onComplete: () => flash.destroy() });
    }
  }

  /** Телеграф: контур сразу, заливка растёт по мере завершения замаха (§6.7) */
  private drawTelegraph(progress: number) {
    const atk = this.def.attack;
    const me = this.getCenter();
    const g = this.tele;
    g.clear();
    g.lineStyle(2, 0xff5a3c, 0.9);
    g.fillStyle(0xff5a3c, 0.12 + 0.3 * progress);
    if (atk.kind === 'lunge') {
      const len = atk.range + 30, w = this.def.radius + 10;
      const a = this.strikeAngle;
      const px = Math.cos(a + Math.PI / 2) * w, py = Math.sin(a + Math.PI / 2) * w;
      const ex = me.x + Math.cos(a) * len, ey = me.y + Math.sin(a) * len;
      g.beginPath();
      g.moveTo(me.x + px, me.y + py); g.lineTo(ex + px, ey + py); g.lineTo(ex - px, ey - py); g.lineTo(me.x - px, me.y - py);
      g.closePath(); g.fillPath(); g.strokePath();
    } else if (atk.kind === 'shoot') {
      const ex = me.x + Math.cos(this.strikeAngle) * atk.range, ey = me.y + Math.sin(this.strikeAngle) * atk.range;
      g.lineStyle(2, 0xff5a3c, 0.5 + 0.5 * progress);
      g.lineBetween(me.x, me.y, ex, ey);
    } else {
      g.strokeCircle(me.x, me.y, atk.aoeRadius);
      g.fillCircle(me.x, me.y, atk.aoeRadius * progress);
    }
  }

  private drawHp() {
    const g = this.hpBar;
    g.clear();
    if (this.hp >= this.maxHp) return;
    const w = this.def.radius * 2 + 8, h = 4;
    const x = this.x - w / 2, y = this.y - this.def.radius - 12;
    g.fillStyle(0x000000, 0.6).fillRect(x, y, w, h);
    g.fillStyle(0xff5a3c, 1).fillRect(x, y, w * Math.max(0, this.hp / this.maxHp), h);
  }
}
