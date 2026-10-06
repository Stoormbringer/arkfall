import Phaser from 'phaser';

/** Прозрачная сцена поверх арены: арена стоит на паузе вместе со своим временем и телеграфами. */
export class PauseScene extends Phaser.Scene {
  constructor() { super('pause'); }
  create() {
    this.add.rectangle(640, 360, 1280, 720, 0x05070b, 0.45);
    const resume = () => { this.scene.stop(); this.game.events.emit('resume-arena'); };
    this.input.keyboard!.once('keydown-ESC', resume);
    this.input.keyboard!.once('keydown-P', resume);
  }
}
