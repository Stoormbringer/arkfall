import Phaser from 'phaser';

export class Projectile extends Phaser.Physics.Arcade.Image {
  damage = 0;
  source = '';
  /** Рикошет: сколько раз ещё отскочит от стен */
  bounces = 0;
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'sprites', 'bullet_enemy');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCircle(6, 10, 10);
    this.setDepth(9);
  }
  fire(x: number, y: number, angle: number, speed: number, damage: number, source: string, bounces = 0) {
    this.enableBody(true, x, y, true, true);
    this.damage = damage;
    this.source = source;
    this.bounces = bounces;
    this.setFrame(source === 'player' ? 'bullet_player' : 'bullet_enemy').setScale(1.4).setBlendMode(Phaser.BlendModes.ADD);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(bounces > 0, 1, 1, bounces > 0);
    this.scene.physics.velocityFromRotation(angle, speed, this.body!.velocity as Phaser.Math.Vector2);
    this.scene.time.delayedCall(2500, () => this.active && this.kill());
  }
  kill() { this.disableBody(true, true); }
}
