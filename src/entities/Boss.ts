import Phaser from 'phaser';
import type { EnemyDef, EnemyId } from '../data/types';
import { Enemy, type EnemyContext } from './Enemy';

/**
 * Молот Ковчега — босс-заглушка пакета 3. Две фазы:
 * 1) тяжёлый удар по кругу (как Молот, но крупнее и медленнее);
 * 2) ниже 50 % HP: замах короче, каждый удар выпускает кольцо снарядов и зовёт 2 Рвущихся.
 */
export class Boss extends Enemy {
  private phase2 = false;
  private baseWindup: number;
  private strikes = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, id: EnemyId, def: EnemyDef, tier: number, room: number) {
    super(scene, x, y, id, def, tier, room);
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
        ctx.spawnAdd?.(this.x + Math.cos(a) * 110, this.y + Math.sin(a) * 110, 'rusher');
      }
      this.scene.cameras.main.shake(250, 0.01);
      const flash = this.scene.add.circle(this.x, this.y, this.def.radius * 3, 0xe0a62f, 0.5).setDepth(6);
      this.scene.tweens.add({ targets: flash, alpha: 0, scale: 2, duration: 400, onComplete: () => flash.destroy() });
    }
    super.update(ctx);
  }

  protected onStrike(ctx: EnemyContext) {
    if (!this.phase2) return;
    const b = this.def.boss!;
    this.strikes++;

    // Кольцо — отдельная угроза с собственным телеграфом и задержкой (§6.7: читается отдельно от удара)
    const delay = b.phase2RingDelaySec * 1000;
    const ring = this.scene.add.circle(this.x, this.y, this.def.radius + 6, 0xe0a62f, 0).setStrokeStyle(2, 0xe0a62f, 0.9).setDepth(6);
    this.scene.tweens.add({ targets: ring, radius: this.def.radius + 40, duration: delay, onUpdate: () => ring.setRadius(ring.radius), onComplete: () => ring.destroy() });
    this.scene.time.delayedCall(delay, () => {
      if (!this.active) return;
      const offset = (this.strikes % 2) * (Math.PI / b.phase2RingBullets); // чередуем углы, чтобы просветы не повторялись
      for (let i = 0; i < b.phase2RingBullets; i++) {
        const a = offset + (Math.PI * 2 * i) / b.phase2RingBullets;
        ctx.shoot(this.x + Math.cos(a) * (this.def.radius + 8), this.y + Math.sin(a) * (this.def.radius + 8), a, b.phase2RingSpeed, Math.round(this.dmg * b.phase2RingDamageMult), this.def.name);
      }
    });

  }
}
