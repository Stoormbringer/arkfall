import Phaser from 'phaser';

/**
 * Меню паузы поверх арены (арена стоит вместе со своим временем).
 * События: resume-arena · open-gear · exit-to-hub
 */
export class PauseScene extends Phaser.Scene {
  private keys!: Record<'ESC' | 'P' | 'I' | 'Q' | 'O', Phaser.Input.Keyboard.Key>;
  private actions!: Record<'ESC' | 'P' | 'I' | 'Q' | 'O', () => void>;
  private done = false;
  constructor() { super('pause'); }
  create() {
    this.done = false;
    const mono = { fontFamily: 'ui-monospace, Menlo, monospace', color: '#e8e4d8' };
    this.add.rectangle(640, 360, 1280, 720, 0x05070b, 0.6);
    this.add.text(640, 220, 'ПАУЗА', { ...mono, fontSize: '13px', color: '#9aa4b8', letterSpacing: 6 }).setOrigin(0.5);
    const items: [string, string, () => void][] = [
      ['Продолжить', 'Esc / P', () => this.emitAnd('resume-arena')],
      ['Снаряжение', 'I', () => this.emitAnd('open-gear')],
      ['Настройки', 'O · тряска, вспышки, частицы', () => this.emitAnd('open-settings')],
      ['Выйти в хаб', 'Q · забег сохранится с начала комнаты', () => this.emitAnd('exit-to-hub')],
    ];
    items.forEach(([label, hint, fn], i) => {
      const y = 270 + i * 66;
      const btn = this.add.rectangle(640, y, 420, 54, 0x161a23).setStrokeStyle(1, 0x3a4256).setInteractive({ useHandCursor: true });
      this.add.text(640, y - 8, label, { ...mono, fontSize: '20px' }).setOrigin(0.5);
      this.add.text(640, y + 16, hint, { ...mono, fontSize: '11px', color: '#6f7890' }).setOrigin(0.5);
      btn.on('pointerover', () => btn.setFillStyle(0x1f2430));
      btn.on('pointerout', () => btn.setFillStyle(0x161a23));
      btn.on('pointerdown', fn);
    });
    // Клавиши опрашиваются в update (JustDown), а не через once-события: событие, пришедшее в кадр создания сцены
    // или перехваченное другой сценой, не теряется, и повторное нажатие не требуется
    this.keys = this.input.keyboard!.addKeys('ESC,P,I,Q,O') as typeof this.keys;
    this.actions = { ESC: items[0][2], P: items[0][2], I: items[1][2], O: items[2][2], Q: items[3][2] };
  }
  update() {
    if (this.done) return;
    for (const k of ['I', 'O', 'Q', 'ESC', 'P'] as const) if (Phaser.Input.Keyboard.JustDown(this.keys[k])) { this.actions[k](); return; }
  }
  private emitAnd(ev: string) {
    if (this.done) return;
    this.done = true;
    this.scene.stop();
    this.game.events.emit(ev);
  }
}
