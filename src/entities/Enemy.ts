import Phaser from 'phaser';
import type { EnemyDef, EnemyId } from '../data/types';
import { enemyDmg, enemyHp, enemyHpHeavy, enemySpd, telegraphSec } from '../core/formulas';
import { SPRITE_SCALE } from '../scenes/BootScene';
import { loadSettings, shake } from '../meta/Settings';

type Phase = 'chase' | 'windup' | 'strike' | 'recover' | 'stunned';

export interface EnemyContext {
  player: Phaser.Physics.Arcade.Sprite;
  shoot: (x: number, y: number, angle: number, speed: number, dmg: number, source: string) => void;
  hitPlayer: (dmg: number, source: string) => void;
  spawnAdd?: (x: number, y: number, id: 'rusher' | 'shooter' | 'lancer' | 'shield') => void;
  /** ближайшая свободная точка комнаты */
  freeNear?: (x: number, y: number, r: number) => { x: number; y: number };
  aliveCount?: () => number;
  /** мгновенный взрыв: урон игроку в радиусе + вспышка */
  blast?: (x: number, y: number, radius: number, dmg: number, source: string) => void;
  /** обход препятствий формы комнаты: желаемый угол → безопасный угол */
  steer?: (x: number, y: number, want: number, r: number, side: 1 | -1) => number;
  hasLos?: (x0: number, y0: number, x1: number, y1: number) => boolean;
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
  /** куда смотрит (для щита) — последний угол на игрока */
  facing = 0;
  /** Ядовитая почва */
  poisonUntil = 0;
  poisonNextTick = 0;
  /** Подрывник: уже взорвался сам — посмертного взрыва не нужно */
  detonated = false;
  private orbitDir: 1 | -1;
  baseScale = 1;
  private lastPose = '';
  /** предпочтительная сторона обхода препятствий — фиксирована, чтобы не дёргаться */
  private avoidSide: 1 | -1;
  private strikeAngle = 0;
  private struck = false;
  protected tele: Phaser.GameObjects.Graphics;
  private hpBar: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, id: EnemyId, def: EnemyDef, tier: number, room: number) {
    super(scene, x, y, 'sprites', `${id}_idle0`);
    this.id = id;
    this.def = def;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    // спрайт 32 px; крупные враги масштабируются под хитбокс
    const k = SPRITE_SCALE * Math.max(1, (def.radius * 2) / 24);
    this.baseScale = k;
    this.setScale(k);
    this.setCircle(def.radius / k, 16 - def.radius / k, 16 - def.radius / k);
    this.play(`${id}_idle`);
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
    this.orbitDir = (Math.round(x + y) & 1) ? 1 : -1;
    this.avoidSide = this.orbitDir;
  }

  /** Урон уязвимому (Копейщик после рывка) */
  get isVulnerable() { return this.phase === 'recover' && !!this.def.recoverVulnMult; }

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
    // отдача формой: короткий «пинок» масштаба
    const k = this.baseScale;
    this.scene.tweens.add({ targets: this, scaleX: k * 1.18, scaleY: k * 0.88, duration: 50, yoyo: true, onComplete: () => this.active && this.setScale(k) });
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
    this.leaveCorpse();
    this.destroy();
  }

  /** Тело остаётся и тает (настройка «Тела врагов»); Подрывник не оставляет — он взрывается */
  private leaveCorpse() {
    if (!loadSettings().corpses || this.def.attack.kind === 'explode' || !this.scene) return;
    const c = this.scene.add.image(this.x, this.y + 4, 'sprites', `${this.id}_idle0`).setScale(this.baseScale).setFlipX(this.flipX)
      .setRotation((this.flipX ? -1 : 1) * Math.PI / 2).setTint(0x6a6470).setAlpha(0.85).setDepth(1);
    this.scene.tweens.add({ targets: c, alpha: 0, duration: 7000, delay: 2500, onComplete: () => c.destroy() });
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
    this.facing = toTarget;

    switch (this.phase) {
      case 'chase': {
        if (atk.kind === 'shoot' || atk.kind === 'summon') {
          // держит дистанцию: отступает, если игрок близко; действует из зоны
          const want = atk.keepDistance;
          const dir = dist < want - 40 ? -1 : dist > want + 40 ? 1 : 0;
          this.scene.physics.velocityFromRotation(toTarget, spd * dir, this.body!.velocity as Phaser.Math.Vector2);
          const canAct = atk.kind !== 'summon' || (ctx.aliveCount?.() ?? 0) < atk.maxAlive;
          if (dist <= atk.range && canAct) this.beginWindup(now, toTarget);
        } else if (atk.kind === 'volley') {
          // орбита: тангенциальный ход + радиальная поправка к нужному кольцу
          const radial = dist > atk.orbitRadius + 30 ? 1 : dist < atk.orbitRadius - 30 ? -1 : 0;
          const tx = Math.cos(toTarget + (Math.PI / 2) * this.orbitDir), ty = Math.sin(toTarget + (Math.PI / 2) * this.orbitDir);
          const v = new Phaser.Math.Vector2(tx * spd + Math.cos(toTarget) * radial * spd * 0.8, ty * spd + Math.sin(toTarget) * radial * spd * 0.8).normalize().scale(spd);
          this.setVelocity(v.x, v.y);
          if (dist <= atk.range) this.beginWindup(now, toTarget);
        } else {
          const go = ctx.steer ? ctx.steer(me.x, me.y, toTarget, this.def.radius, this.avoidSide) : toTarget;
          this.scene.physics.velocityFromRotation(go, spd, this.body!.velocity as Phaser.Math.Vector2);
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
        if (now >= this.phaseUntil) { this.setVelocity(0, 0); this.phase = 'recover'; this.phaseUntil = now + (this.recoverSecOverride ?? ('recoverSec' in atk ? atk.recoverSec : 0)) * 1000; this.onRecover(ctx); }
        break;
      }
      case 'recover': {
        this.setVelocity(0, 0);
        if (this.def.recoverVulnMult) this.setTint(0xffe08a);
        if (now >= this.phaseUntil) { if (this.def.recoverVulnMult) this.clearTint(); this.phase = 'chase'; }
        break;
      }
      case 'stunned': {
        this.setVelocity(0, 0);
        if (now >= this.phaseUntil) { this.clearTint(); this.phase = 'chase'; }
        break;
      }
    }
    // Подрывник взрывается прямо в beginStrike и уничтожает себя — дальше тела нет
    if (!this.active || !this.body) return;
    if (this.pull.lengthSq() > 0 && !this.isBoss && this.def.role !== 'tank') {
      const v = this.body!.velocity as Phaser.Math.Vector2;
      v.add(this.pull);
      this.pull.set(0, 0);
    } else this.pull.set(0, 0);
    this.updatePose();
    this.drawHp();
  }

  /** Кадр по фазе: погоня — шаг, замах/удар — атака, остальное — стойка; смотрим в сторону цели */
  private updatePose() {
    const v = this.body!.velocity as Phaser.Math.Vector2;
    const k = this.baseScale;
    if (this.phase === 'windup' || this.phase === 'strike') {
      this.anims.stop(); this.setFrame(`${this.id}_attack`);
      if (this.phase === 'windup' && this.lastPose !== 'windup') {
        // замах: тело подбирается и отклоняется от цели, к концу замаха — почти в полный рост
        this.scene.tweens.killTweensOf(this);
        this.setScale(k * 0.9, k * 1.08);
        this.scene.tweens.add({ targets: this, scaleX: k * 0.96, scaleY: k * 1.03, duration: Math.max(80, this.windupMs - 60), ease: 'Sine.In' });
      }
      if (this.phase === 'strike' && this.lastPose !== 'strike') {
        // удар: резкий выпад формой к цели и возврат
        this.scene.tweens.killTweensOf(this);
        this.setScale(k * 1.22, k * 0.86);
        this.scene.tweens.add({ targets: this, scaleX: k, scaleY: k, duration: 160, ease: 'Back.Out' });
      }
      this.lastPose = this.phase;
    } else {
      if (this.lastPose === 'windup' || this.lastPose === 'strike') { this.scene.tweens.killTweensOf(this); this.setScale(k); }
      this.lastPose = this.phase;
      const want = v.lengthSq() > 4 ? `${this.id}_walk` : `${this.id}_idle`;
      if (this.anims.currentAnim?.key !== want || !this.anims.isPlaying) this.play(want, true);
    }
    const dx = Math.cos(this.facing);
    if (Math.abs(dx) > 0.2) this.setFlipX(dx < 0);
  }

  private beginWindup(now: number, angle: number) {
    this.phase = 'windup';
    this.phaseUntil = now + this.windupMs;
    this.strikeAngle = angle;
    this.struck = false;
  }

  /** Хук для боссов: вызывается в момент удара */
  protected onStrike(_ctx: EnemyContext) { void _ctx; }
  /** Хук для боссов: удар кончился, начинается восстановление */
  protected onRecover(_ctx: EnemyContext) { void _ctx; }

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
      this.scene.game.events.emit('sfx', 'shot');
      ctx.shoot(me.x, me.y, this.strikeAngle, atk.projectileSpeed, this.dmg, this.def.name);
    } else if (atk.kind === 'volley') {
      this.phaseUntil = now + 50;
      const step = Phaser.Math.DegToRad(atk.spreadDeg);
      for (let i = 0; i < atk.bullets; i++) ctx.shoot(me.x, me.y, this.strikeAngle + step * (i - (atk.bullets - 1) / 2), atk.projectileSpeed, this.dmg, this.def.name);
    } else if (atk.kind === 'summon') {
      this.phaseUntil = now + 100;
      for (let i = 0; i < atk.count; i++) {
        const a = this.facing + Math.PI + (i - (atk.count - 1) / 2) * 0.9;
        ctx.spawnAdd?.(me.x + Math.cos(a) * 44, me.y + Math.sin(a) * 44, atk.summonId);
      }
    } else if (atk.kind === 'explode') {
      // самоподрыв: без зачёта убийства, посмертный взрыв не нужен
      this.detonated = true;
      ctx.blast?.(me.x, me.y, atk.aoeRadius, this.dmg, this.def.name);
      this.die();
      return;
    } else {
      this.phaseUntil = now + 120;
      if (this.def.role === 'tank') { shake(this.scene.cameras.main, 120, this.isBoss ? 0.008 : 0.004); this.scene.game.events.emit('sfx', 'slam'); }
      const target = ctx.player.getCenter();
      if (Phaser.Math.Distance.BetweenPoints(me, target) <= atk.aoeRadius && (!ctx.hasLos || ctx.hasLos(me.x, me.y, target.x, target.y))) ctx.hitPlayer(this.dmg, this.def.name);
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
    } else if (atk.kind === 'volley') {
      const step = Phaser.Math.DegToRad(atk.spreadDeg);
      g.lineStyle(2, 0xff5a3c, 0.5 + 0.5 * progress);
      for (let i = 0; i < atk.bullets; i++) {
        const a = this.strikeAngle + step * (i - (atk.bullets - 1) / 2);
        g.lineBetween(me.x, me.y, me.x + Math.cos(a) * atk.range, me.y + Math.sin(a) * atk.range);
      }
    } else if (atk.kind === 'summon') {
      g.lineStyle(2, 0xb58cff, 0.9);
      g.strokeCircle(me.x, me.y, 44);
      g.fillStyle(0xb58cff, 0.1 + 0.3 * progress).fillCircle(me.x, me.y, 44 * progress);
    } else {
      g.strokeCircle(me.x, me.y, atk.aoeRadius);
      g.fillCircle(me.x, me.y, atk.aoeRadius * progress);
    }
  }

  private drawHp() {
    const g = this.hpBar;
    g.clear();
    if (this.def.shield) {
      // дуга щита спереди — читается, откуда бить нельзя
      const half = Phaser.Math.DegToRad(this.def.shield.frontArcDeg) / 2;
      g.lineStyle(4, 0xdfe8e6, 0.9);
      g.beginPath(); g.arc(this.x, this.y, this.def.radius + 5, this.facing - half, this.facing + half, false); g.strokePath();
    }
    if (this.hp >= this.maxHp) return;
    const w = this.def.radius * 2 + 8, h = 4;
    const x = this.x - w / 2, y = this.y - this.def.radius - 12;
    g.fillStyle(0x000000, 0.6).fillRect(x, y, w, h);
    g.fillStyle(0xff5a3c, 1).fillRect(x, y, w * Math.max(0, this.hp / this.maxHp), h);
  }
}
