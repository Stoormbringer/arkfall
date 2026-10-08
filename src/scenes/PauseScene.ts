import Phaser from 'phaser';

/**
 * Меню паузы поверх арены (арена стоит вместе со своим временем).
 * События: resume-arena · open-gear · exit-to-hub
 */
export class PauseScene extends Phaser.Scene {
  constructor() { super('pause'); }
  create() {
    const mono = { fontFamily: 'ui-monospace, Menlo, monospace', color: '#e8e4d8' };
    this.add.rectangle(640, 360, 1280, 720, 0x05070b, 0.6);
    this.add.text(640, 220, 'ПАУЗА', { ...mono, fontSize: '13px', color: '#9aa4b8', letterSpacing: 6 }).setOrigin(0.5);
    const items: [string, string, () => void][] = [
      ['Продолжить', 'Esc / P', () => this.emitAnd('resume-arena')],
      ['Снаряжение', 'I', () => this.emitAnd('open-gear')],
      ['Выйти в хаб', 'Q · забег сохранится с начала комнаты', () => this.emitAnd('exit-to-hub')],
    ];
    items.forEach(([label, hint, fn], i) => {
      const y = 290 + i * 70;
      const btn = this.add.rectangle(640, y, 420, 54, 0x161a23).setStrokeStyle(1, 0x3a4256).setInteractive({ useHandCursor: true });
      this.add.text(640, y - 8, label, { ...mono, fontSize: '20px' }).setOrigin(0.5);
      this.add.text(640, y + 16, hint, { ...mono, fontSize: '11px', color: '#6f7890' }).setOrigin(0.5);
      btn.on('pointerover', () => btn.setFillStyle(0x1f2430));
      btn.on('pointerout', () => btn.setFillStyle(0x161a23));
      btn.on('pointerdown', fn);
    });
    const kb = this.input.keyboard!;
    kb.once('keydown-ESC', items[0][2]); kb.once('keydown-P', items[0][2]);
    kb.once('keydown-I', items[1][2]); kb.once('keydown-Q', items[2][2]);
  }
  private emitAnd(ev: string) { this.scene.stop(); this.game.events.emit(ev); }
}
