import Phaser from 'phaser';
import P from '../data/player.json';

export interface PlayerInput {
  move: Phaser.Math.Vector2;   // нормализованный вектор движения
  aim: Phaser.Math.Vector2;    // мировая точка прицела
  attack: boolean;
  dodge: boolean;
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  hp = P.hp;
  readonly maxHp = P.hp;
  invulnUntil = 0;
  dodgeUntil = 0;
  dodgeReadyAt = 0;
  attackReadyAt = 0;
  lastHitBy = '';
  private dodgeDir = new Phaser.Math.Vector2();
  private swing: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCircle(P.radius, 0, 0);
    this.setCollideWorldBounds(true);
    this.setDepth(10);
    this.invulnUntil = scene.time.now + P.spawnInvulnSec * 1000;
    this.swing = scene.add.graphics().setDepth(11);
  }

  get isInvulnerable() { return this.scene.time.now < this.invulnUntil; }
  get isDodging() { return this.scene.time.now < this.dodgeUntil; }
  get dodgeCooldown01() {
    const total = P.dodge.cooldownSec * 1000;
    return Phaser.Math.Clamp(1 - (this.dodgeReadyAt - this.scene.time.now) / total, 0, 1);
  }

  /** Возвращает параметры удара, если атака состоялась */
  handleInput(input: PlayerInput): { angle: number; radius: number; arcRad: number; damage: number; knockback: number } | null {
    const now = this.scene.time.now;

    if (input.dodge && now >= this.dodgeReadyAt && !this.isDodging) {
      const dir = input.move.lengthSq() > 0 ? input.move.clone() : input.aim.clone().subtract(new Phaser.Math.Vector2(this.x, this.y)).normalize();
      this.dodgeDir.copy(dir);
      this.dodgeUntil = now + P.dodge.durationSec * 1000;
      this.invulnUntil = Math.max(this.invulnUntil, now + P.dodge.iframesSec * 1000);
      this.dodgeReadyAt = now + P.dodge.cooldownSec * 1000;
    }

    if (this.isDodging) {
      this.setVelocity(this.dodgeDir.x * P.dodge.speed, this.dodgeDir.y * P.dodge.speed);
    } else {
      this.setVelocity(input.move.x * P.speed, input.move.y * P.speed);
    }
    this.setAlpha(this.isInvulnerable ? 0.55 : 1);

    if (input.attack && now >= this.attackReadyAt && !this.isDodging) {
      this.attackReadyAt = now + P.weapon.cooldownSec * 1000;
      const c = this.getCenter();
      const angle = Phaser.Math.Angle.Between(c.x, c.y, input.aim.x, input.aim.y);
      const arcRad = Phaser.Math.DegToRad(P.weapon.arcDeg);
      this.drawSwing(angle, arcRad);
      return { angle, radius: P.weapon.radius, arcRad, damage: P.weapon.damage, knockback: P.weapon.knockback };
    }
    return null;
  }

  takeDamage(amount: number, source: string): boolean {
    if (this.isInvulnerable) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.lastHitBy = source;
    this.invulnUntil = this.scene.time.now + 350; // короткая защита от стаков урона
    this.scene.cameras.main.shake(80, 0.004);
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => this.clearTint());
    return true;
  }

  private drawSwing(angle: number, arcRad: number) {
    const c = this.getCenter();
    this.swing.clear();
    this.swing.fillStyle(0xf5f1e6, 0.5);
    this.swing.slice(c.x, c.y, P.weapon.radius, angle - arcRad / 2, angle + arcRad / 2, false);
    this.swing.fillPath();
    this.scene.tweens.add({ targets: this.swing, alpha: { from: 1, to: 0 }, duration: 110, onComplete: () => { this.swing.clear(); this.swing.alpha = 1; } });
  }
}
