import Phaser from 'phaser';
import { DOORS, type DoorReward } from '../run/doors';

export interface DoorSceneData { doors: DoorReward[] }

/** Выбор двери после зачистки комнаты. Результат: game.events 'door-chosen' (reward). */
export class DoorScene extends Phaser.Scene {
  constructor() { super('door'); }

  create(data: DoorSceneData) {
    const W = 1280, H = 720;
    this.add.rectangle(W / 2, H / 2, W, H, 0x0b0a05, 0.78);
    const mono = { fontFamily: 'ui-monospace, Menlo, monospace', color: '#e8e4d8' };
    this.add.text(W / 2, 114, 'ПУТЬ', { ...mono, fontSize: '13px', color: '#f0c75e', letterSpacing: 6 }).setOrigin(0.5);
    this.add.text(W / 2, 150, data.doors.length === 1 ? 'Впереди — логово босса' : 'Куда дальше?', { ...mono, fontSize: '28px' }).setOrigin(0.5);
    this.add.text(W / 2, 188, 'Клик по двери или клавиши 1 / 2 / 3', { ...mono, fontSize: '14px', color: '#6f7890' }).setOrigin(0.5);

    const w = 280, h = 220, gap = 40;
    const x0 = W / 2 - (w * data.doors.length + gap * (data.doors.length - 1)) / 2 + w / 2;
    data.doors.forEach((reward, i) => {
      const d = DOORS[reward];
      const cx = x0 + i * (w + gap), cy = H / 2 + 20;
      const hex = '#' + d.color.toString(16).padStart(6, '0');
      const card = this.add.rectangle(cx, cy, w, h, 0x161a23).setStrokeStyle(2, d.color).setInteractive({ useHandCursor: true });
      this.add.rectangle(cx, cy - h / 2 + 6, w - 4, 10, d.color, 0.9);
      this.add.text(cx, cy - 70, `${i + 1}`, { ...mono, fontSize: '14px', color: '#6f7890' }).setOrigin(0.5);
      this.add.text(cx, cy - 36, d.name, { ...mono, fontSize: '22px', color: hex }).setOrigin(0.5);
      this.add.text(cx, cy + 20, d.hint, { ...mono, fontSize: '14px', wordWrap: { width: w - 36 }, align: 'center' }).setOrigin(0.5);
      card.on('pointerover', () => card.setFillStyle(0x1f2430));
      card.on('pointerout', () => card.setFillStyle(0x161a23));
      const pick = () => { this.game.events.emit('door-chosen', reward); this.scene.stop(); };
      card.on('pointerdown', pick);
      this.input.keyboard!.once(`keydown-${['ONE', 'TWO', 'THREE'][i]}`, pick);
    });
  }
}
