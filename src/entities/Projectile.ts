import Phaser from 'phaser';

export class Projectile extends Phaser.Physics.Arcade.Image {
  damage = 0;
  source = '';
  /** Рикошет: сколько раз ещё отскочит от стен */
  bounces = 0;
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'bullet');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCircle(6, 0, 0);
    this.setDepth(9);
  }
  fire(x: number, y: number, angle: number, speed: number, damage: number, source: string, bounces = 0) {
    this.enableBody(true, x, y, true, true);
    this.damage = damage;
    this.source = source;
    this.bounces = bounces;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(bounces > 0, 1, 1, bounces > 0);
    this.scene.physics.velocityFromRotation(angle, speed, this.body!.velocity as Phaser.Math.Vector2);
    this.scene.time.delayedCall(2500, () => this.active && this.kill());
  }
  kill() { this.disableBody(true, true); }
}
