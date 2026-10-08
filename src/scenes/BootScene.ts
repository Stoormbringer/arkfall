import Phaser from 'phaser';
import ATLAS from '../data/atlas.json';

/**
 * Графика (G1): один атлас 32 px, собранный tools/sprites/gen.py → public/sprites/atlas.png + src/data/atlas.json.
 * С рендерером атлас грузится как картинка; в headless (тесты под Node) те же кадры заводятся на пустой canvas-текстуре,
 * чтобы спрайты и анимации работали одинаково.
 */
export const CHARS = ['hero', 'rusher', 'shooter', 'tank', 'bomber', 'lancer', 'summoner', 'shield', 'orbiter', 'boss_hammer'] as const;
export const SPRITE_SCALE = 1.5; // 32 px спрайт → 48 px на экране; хитбоксы из формул не меняются

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  preload() {
    if (this.game.renderer) this.load.atlas('sprites', 'sprites/atlas.png', 'sprites/atlas.json');
  }

  create() {
    if (!this.textures.exists('sprites')) {
      // headless: кадры без пикселей
      const tex = this.textures.createCanvas('sprites', ATLAS.meta.size.w, ATLAS.meta.size.h);
      if (tex) for (const [name, f] of Object.entries(ATLAS.frames)) tex.add(name, 0, f.frame.x, f.frame.y, f.frame.w, f.frame.h);
    }
    this.anims.create({ key: 'torch', frames: [{ key: 'sprites', frame: 'torch0' }, { key: 'sprites', frame: 'torch1' }], frameRate: 5, repeat: -1 });
    // радиальное свечение для факелов и героя (ADD-смешивание)
    const g = this.textures.createCanvas('glow', 64, 64);
    if (g) {
      const ctx = g.getContext();
      const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.25)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
      if (this.game.renderer) g.refresh();
    }
    for (const c of CHARS) {
      this.anims.create({ key: `${c}_idle`, frames: [{ key: 'sprites', frame: `${c}_idle0` }, { key: 'sprites', frame: `${c}_idle1` }], frameRate: 2, repeat: -1 });
      this.anims.create({ key: `${c}_walk`, frames: [{ key: 'sprites', frame: `${c}_walk0` }, { key: 'sprites', frame: `${c}_walk1` }], frameRate: 7, repeat: -1 });
    }
    const q = new URLSearchParams(location.search);
    if (q.has('tier') || q.has('seed')) this.scene.start('arena');
    else this.scene.start('title');
  }
}
