import Phaser from 'phaser';
import { backdrop, button, heading, UI } from '../ui/theme';

/**
 * Меню паузы поверх арены (арена стоит вместе со своим временем).
 * События: resume-arena · open-gear · open-settings · exit-to-hub
 */
export class PauseScene extends Phaser.Scene {
  private keys!: Record<'ESC' | 'P' | 'I' | 'Q' | 'O', Phaser.Input.Keyboard.Key>;
  private actions!: Record<'ESC' | 'P' | 'I' | 'Q' | 'O', () => void>;
  private done = false;
  constructor() { super('pause'); }
  create() {
    this.done = false;
    backdrop(this, 0.7);
    heading(this, 170, 'ПАУЗА', 'Бездна ждёт', UI.dim);
    const items: [string, string, number, () => void][] = [
      ['Продолжить', 'Esc / P', UI.iceHex, () => this.emitAnd('resume-arena')],
      ['Снаряжение', 'I', UI.goldHex, () => this.emitAnd('open-gear')],
      ['Настройки', 'O · тряска, вспышки, частицы', UI.stoneHi, () => this.emitAnd('open-settings')],
      ['Выйти в хаб', 'Q · забег сохранится с начала комнаты', UI.crimsonHex, () => this.emitAnd('exit-to-hub')],
    ];
    items.forEach(([label, hint, accent, fn], i) => button(this, 640, 290 + i * 70, 440, 58, label, { accent, hint, size: 19, onClick: fn }));
    // Клавиши опрашиваются в update (JustDown), а не через once-события: событие не теряется
    this.keys = this.input.keyboard!.addKeys('ESC,P,I,Q,O') as typeof this.keys;
    this.actions = { ESC: items[0][3], P: items[0][3], I: items[1][3], O: items[2][3], Q: items[3][3] };
  }
  update() {
    if (this.done) return;
    for (const k of ['I', 'O', 'Q', 'ESC', 'P'] as const) if (Phaser.Input.Keyboard.JustDown(this.keys[k])) { this.actions[k](); return; }
  }
  private emitAnd(ev: string) {
    if (this.done) return;
    this.done = true;
    this.game.events.emit('sfx', 'ui');
    this.scene.stop();
    this.game.events.emit(ev);
  }
}
