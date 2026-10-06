import Phaser from 'phaser';
import ENEMIES from '../data/enemies.json';
import P from '../data/player.json';

/** Этап 0: вся графика программная. Спрайты заменяются на арт без изменения логики. */
export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  create() {
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    const circle = (key: string, r: number, color: number, ring?: number) => {
      g.clear();
      g.fillStyle(color, 1).fillCircle(r + 2, r + 2, r);
      if (ring !== undefined) g.lineStyle(2, ring, 1).strokeCircle(r + 2, r + 2, r - 1);
      g.generateTexture(key, r * 2 + 4, r * 2 + 4);
    };

    circle('player', P.radius, 0xf5f1e6, 0x8fd3ff);
    circle('bullet', 6, 0xffb36b);
    for (const [id, def] of Object.entries(ENEMIES)) circle(`enemy-${id}`, def.radius, Number(def.color), 0x1a1d26);

    // Пол арены: тёмная сетка, читаемая на фоне телеграфов
    g.clear();
    g.fillStyle(0x161a23, 1).fillRect(0, 0, 64, 64);
    g.lineStyle(1, 0x1f2430, 1).strokeRect(0, 0, 64, 64);
    g.generateTexture('floor', 64, 64);

    g.destroy();
    this.scene.start('arena');
    this.scene.launch('hud');
  }
}
