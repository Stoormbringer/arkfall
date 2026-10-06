import Phaser from 'phaser';
import ENEMIES from '../data/enemies.json';
import P from '../data/player.json';

/**
 * Этап 0–1: вся графика программная. Текстуры рисуются на canvas-текстурах напрямую,
 * без Graphics.generateTexture — это работает и в WebGL, и в headless (тесты под Node).
 */
export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  create() {
    const circle = (key: string, r: number, color: number, ring?: number) => {
      const size = r * 2 + 4;
      const tex = this.textures.createCanvas(key, size, size);
      if (!tex) return;
      const ctx = tex.getContext();
      ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
      ctx.beginPath(); ctx.arc(r + 2, r + 2, r, 0, Math.PI * 2); ctx.fill();
      if (ring !== undefined) {
        ctx.strokeStyle = '#' + ring.toString(16).padStart(6, '0');
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(r + 2, r + 2, r - 1, 0, Math.PI * 2); ctx.stroke();
      }
      if (this.game.renderer) tex.refresh(); // в headless рендерера нет
    };

    circle('player', P.radius, 0xf5f1e6, 0x8fd3ff);
    circle('bullet', 6, 0xffb36b);
    for (const [id, def] of Object.entries(ENEMIES)) circle(`enemy-${id}`, def.radius, Number(def.color), 0x1a1d26);

    const q = new URLSearchParams(location.search);
    if (q.has('tier') || q.has('seed')) this.scene.start('arena');
    else this.scene.start('title');
  }
}
