import Phaser from 'phaser';
import type { EnemyDef, EnemyId } from '../data/types';
import { Enemy, type EnemyContext } from './Enemy';
import { shake } from '../meta/Settings';

/**
 * Боссы актов. Общее: переход во 2-ю фазу при phase2At HP — вспышка, тряска, подмога один раз.
 * Молот Ковчега (акт 1): тяжёлый слэм; фаза 2 — кольцо снарядов после каждого удара.
 * Костяной жрец (акт 2): кружит на дистанции, веер снарядов; каждые N ударов зовёт скелетов; фаза 2 — телепорт от героя, веер шире, зовёт латников.
 * Страж Бездны (акт 3): рывок через комнату (после — уязвим); фаза 2 — два рывка подряд и кольцо снарядов в конце каждого.
 */
export class Boss extends Enemy {
  protected phase2 = false;
  protected baseWindup: number;
  protected strikes = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, id: EnemyId, def: EnemyDef, tier: number, room: number) {
    super(scene, x, y, id, { ...def, attack: { ...def.attack } }, tier, room); // копия: фаза 2 правит атаку
    this.baseWindup = this.windupMs;
    this.setDepth(9);
  }

  get bossPhase() { return this.phase2 ? 2 : 1; }

  update(ctx: EnemyContext) {
    const b = this.def.boss!;
    if (!this.phase2 && this.hp / this.maxHp <= b.phase2At) {
      this.phase2 = true;
      this.windupMs = this.baseWindup * b.phase2WindupMult;
      this.recoverSecOverride = b.phase2RecoverSec;
      // Подмога — один раз, как событие перехода, а не поток
      for (let i = 0; i < b.phase2AddsOnTransition; i++) {
        const a = Math.PI / 2 + (i === 0 ? -0.7 : 0.7);
        ctx.spawnAdd?.(this.x + Math.cos(a) * 110, this.y + Math.sin(a) * 110, b.addsId);
      }
      shake(this.scene.cameras.main, 250, 0.01);
      const flash = this.scene.add.circle(this.x, this.y, this.def.radius * 3, Number(this.def.color), 0.5).setDepth(6);
      this.scene.tweens.add({ targets: flash, alpha: 0, scale: 2, duration: 400, onComplete: () => flash.destroy() });
      this.scene.game.events.emit('sfx', 'boss_phase');
      this.onPhase2();
    }
    super.update(ctx);
  }

  protected onPhase2() { /* по виду босса */ }

  /** Кольцо снарядов вокруг себя с задержкой-телеграфом (§6.7: читается отдельно от удара) */
  protected ring(ctx: EnemyContext, bullets: number, speed: number, dmgMult: number, delayMs: number) {
    const color = Number(this.def.color);
    const r = this.scene.add.circle(this.x, this.y, this.def.radius + 6, color, 0).setStrokeStyle(2, color, 0.9).setDepth(6);
    this.scene.tweens.add({ targets: r, radius: this.def.radius + 40, duration: delayMs, onUpdate: () => r.setRadius(r.radius), onComplete: () => r.destroy() });
    this.scene.time.delayedCall(delayMs, () => {
      if (!this.active) return;
      const offset = (this.strikes % 2) * (Math.PI / bullets); // чередуем углы, чтобы просветы не повторялись
      for (let i = 0; i < bullets; i++) {
        const a = offset + (Math.PI * 2 * i) / bullets;
        ctx.shoot(this.x + Math.cos(a) * (this.def.radius + 8), this.y + Math.sin(a) * (this.def.radius + 8), a, speed, Math.round(this.dmg * dmgMult), this.def.name);
      }
    });
  }
}

export class BossHammer extends Boss {
  protected onStrike(ctx: EnemyContext) {
    if (!this.phase2) return;
    const b = this.def.boss!;
    this.strikes++;
    this.ring(ctx, b.phase2RingBullets!, b.phase2RingSpeed!, b.phase2RingDamageMult!, b.phase2RingDelaySec! * 1000);
  }
}

export class BossLich extends Boss {
  private blinkReadyAt = 0;

  protected onPhase2() {
    const atk = this.def.attack;
    if (atk.kind === 'volley') atk.bullets = this.def.boss!.phase2Bullets ?? atk.bullets;
  }

  update(ctx: EnemyContext) {
    const b = this.def.boss!;
    const now = this.scene.time.now;
    // фаза 2: герой подошёл — мерцание прочь (с телеграфом в обеих точках)
    if (this.phase2 && this.phase !== 'strike' && this.phase !== 'stunned' && now >= this.blinkReadyAt) {
      const p = ctx.player.getCenter();
      const d = Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y);
      if (d < (b.blinkRange ?? 150)) {
        this.blinkReadyAt = now + (b.blinkCooldownSec ?? 3) * 1000;
        const a = Phaser.Math.Angle.Between(p.x, p.y, this.x, this.y) + (Math.random() - 0.5) * 1.2;
        const dist = b.blinkDistance ?? 300;
        let tx = Phaser.Math.Clamp(this.x + Math.cos(a) * dist, 80, 1200), ty = Phaser.Math.Clamp(this.y + Math.sin(a) * dist, 80, 640);
        const free = ctx.freeNear?.(tx, ty, this.def.radius); if (free) { tx = free.x; ty = free.y; }
        for (const [fx, fy] of [[this.x, this.y], [tx, ty]]) {
          const f = this.scene.add.circle(fx, fy, this.def.radius + 10, 0x9b6bff, 0.45).setDepth(6);
          this.scene.tweens.add({ targets: f, alpha: 0, scale: 1.6, duration: 320, onComplete: () => f.destroy() });
        }
        this.setPosition(tx, ty);
        this.tele.clear();
        this.phase = 'chase'; // замах сбрасывается — после прыжка он начнётся заново
        this.scene.game.events.emit('sfx', 'blink');
      }
    }
    super.update(ctx);
  }

  protected onStrike(ctx: EnemyContext) {
    const b = this.def.boss!;
    this.strikes++;
    if (this.strikes % (b.summonEvery ?? 4) === 0) {
      const id = (this.phase2 ? b.summonIdPhase2 : b.summonIdPhase1) ?? 'lancer';
      for (let i = 0; i < (b.summonCount ?? 2); i++) {
        const a = this.facing + Math.PI + (i - 0.5) * 1.2;
        ctx.spawnAdd?.(this.x + Math.cos(a) * 70, this.y + Math.sin(a) * 70, id);
      }
    }
  }
}

export class BossWarden extends Boss {
  private chained = 0;

  protected onStrike() { this.strikes++; }

  protected onRecover(ctx: EnemyContext) {
    if (!this.phase2) return;
    const b = this.def.boss!;
    this.ring(ctx, b.ringBullets ?? 8, b.ringSpeed ?? 210, b.ringDamageMult ?? 0.35, 350);
    // цепочка рывков: после первого — почти сразу второй
    this.chained++;
    if (this.chained < (b.phase2ChainLunges ?? 2)) this.phaseUntil = this.scene.time.now + 250;
    else this.chained = 0;
  }
}

export function createBoss(scene: Phaser.Scene, x: number, y: number, id: EnemyId, def: EnemyDef, tier: number, room: number): Boss {
  switch (def.boss?.kind) {
    case 'lich': return new BossLich(scene, x, y, id, def, tier, room);
    case 'warden': return new BossWarden(scene, x, y, id, def, tier, room);
    default: return new BossHammer(scene, x, y, id, def, tier, room);
  }
}
