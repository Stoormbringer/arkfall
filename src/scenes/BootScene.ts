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

    g.destroy();
    // Прямой вход по ?tier=/?seed= — для тестов и быстрой проверки; иначе хаб
    const q = new URLSearchParams(location.search);
    if (q.has('tier') || q.has('seed')) this.scene.start('arena');
    else this.scene.start('title');
  }
}
