import Phaser from 'phaser';
import { DOORS, type DoorReward } from '../run/doors';
import { backdrop, heading, hex, mono, panel, UI } from '../ui/theme';

export interface DoorSceneData { doors: DoorReward[] }

/** Выбор двери после зачистки комнаты. Результат: game.events 'door-chosen' (reward). */
export class DoorScene extends Phaser.Scene {
  constructor() { super('door'); }

  create(data: DoorSceneData) {
    const W = 1280, H = 720;
    backdrop(this, 0.82);
    heading(this, 100, 'ПУТЬ', data.doors.length === 1 ? 'Впереди — логово босса' : 'Куда дальше?');
    this.add.text(W / 2, 188, 'Клик по двери или клавиши 1 / 2 / 3', mono(13, UI.dim)).setOrigin(0.5);

    const w = 280, h = 220, gap = 40;
    const x0 = W / 2 - (w * data.doors.length + gap * (data.doors.length - 1)) / 2 + w / 2;
    data.doors.forEach((reward, i) => {
      const d = DOORS[reward];
      const cx = x0 + i * (w + gap), cy = H / 2 + 20;
      panel(this, cx, cy, w, h, d.color);
      const card = this.add.rectangle(cx, cy, w - 12, h - 12, 0xffffff, 0).setInteractive({ useHandCursor: true });
      // арка двери
      const arch = this.add.graphics();
      arch.fillStyle(d.color, 0.18).fillRoundedRect(cx - 34, cy - 100, 68, 56, { tl: 34, tr: 34, bl: 0, br: 0 });
      arch.lineStyle(2, d.color, 0.9).strokeRoundedRect(cx - 34, cy - 100, 68, 56, { tl: 34, tr: 34, bl: 0, br: 0 });
      this.add.text(cx, cy - 66, `${i + 1}`, mono(13, UI.dim)).setOrigin(0.5);
      this.add.text(cx, cy - 30, d.name, mono(21, hex(d.color))).setOrigin(0.5);
      this.add.text(cx, cy + 28, d.hint, mono(13, UI.text, { wordWrap: { width: w - 36 }, align: 'center' })).setOrigin(0.5);
      card.on('pointerover', () => card.setFillStyle(0xffffff, 0.05));
      card.on('pointerout', () => card.setFillStyle(0xffffff, 0));
      const pick = () => { this.game.events.emit('door-chosen', reward); this.scene.stop(); };
      card.on('pointerdown', pick);
      this.input.keyboard!.once(`keydown-${['ONE', 'TWO', 'THREE'][i]}`, pick);
    });
  }
}
