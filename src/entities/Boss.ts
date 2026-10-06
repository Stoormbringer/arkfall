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
      this.scene.cameras.main.shake(250, 0.01);
      const flash = this.scene.add.circle(this.x, this.y, this.def.radius * 3, 0xe0a62f, 0.5).setDepth(6);
      this.scene.tweens.add({ targets: flash, alpha: 0, scale: 2, duration: 400, onComplete: () => flash.destroy() });
    }
    super.update(ctx);
  }

  protected onStrike(ctx: EnemyContext) {
    if (!this.phase2) return;
    const b = this.def.boss!;
    for (let i = 0; i < b.phase2RingBullets; i++) {
      const a = (Math.PI * 2 * i) / b.phase2RingBullets;
      ctx.shoot(this.x + Math.cos(a) * (this.def.radius + 8), this.y + Math.sin(a) * (this.def.radius + 8), a, b.phase2RingSpeed, Math.round(this.dmg * 0.4), this.def.name);
    }
    for (let i = 0; i < b.phase2Adds; i++) {
      const a = Math.PI / 2 + (i === 0 ? -0.6 : 0.6);
      ctx.spawnAdd?.(this.x + Math.cos(a) * 90, this.y + Math.sin(a) * 90, 'rusher');
    }
  }
}
