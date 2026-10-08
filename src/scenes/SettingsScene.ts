import Phaser from 'phaser';
import { backdrop, heading } from '../ui/theme';
import { loadSettings, saveSettings, type Settings } from '../meta/Settings';

export interface SettingsData { fromArena?: boolean }

/** Настройки игры: из хаба (O) и из меню паузы (O). Esc — назад. */
export class SettingsScene extends Phaser.Scene {
  private s!: Settings;
  private layer!: Phaser.GameObjects.Container;
  private fromArena = false;
  constructor() { super('settings'); }

  create(data: SettingsData) {
    this.s = loadSettings();
    this.fromArena = !!data?.fromArena;
    const mono = { fontFamily: 'ui-monospace, Menlo, monospace', color: '#e8e4d8' };
    backdrop(this, this.fromArena ? 0.94 : 1);
    heading(this, 90, 'НАСТРОЙКИ', 'Как ощущается бой');
    this.add.text(640, 156, 'Клик или клавиша в скобках · Esc — назад', { ...mono, fontSize: '13px', color: '#6f7890' }).setOrigin(0.5);
    this.layer = this.add.container(0, 0);
    const kb = this.input.keyboard!;
    kb.on('keydown-ONE', () => this.toggle('shake')); kb.on('keydown-TWO', () => this.toggle('flash'));
    kb.on('keydown-THREE', () => this.cycleParticles()); kb.on('keydown-FOUR', () => this.toggle('corpses'));
    kb.once('keydown-ESC', () => this.close());
    this.render();
  }

  private close() {
    this.scene.stop();
    if (this.fromArena) this.game.events.emit('settings-closed'); else this.scene.start('title');
  }
  private toggle(k: 'shake' | 'flash' | 'corpses') { this.s = saveSettings({ ...this.s, [k]: !this.s[k] }); this.render(); }
  private cycleParticles() {
    const order: Settings['particles'][] = ['full', 'low', 'off'];
    this.s = saveSettings({ ...this.s, particles: order[(order.indexOf(this.s.particles) + 1) % order.length] });
    this.render();
  }

  private render() {
    this.layer.removeAll(true);
    const mono = { fontFamily: 'ui-monospace, Menlo, monospace', color: '#e8e4d8' };
    const rows: [string, string, string, () => void][] = [
      ['1', 'Тряска камеры', this.s.shake ? 'вкл' : 'выкл', () => this.toggle('shake')],
      ['2', 'Вспышка экрана при уроне', this.s.flash ? 'вкл' : 'выкл', () => this.toggle('flash')],
      ['3', 'Частицы', { full: 'полные', low: 'меньше', off: 'выкл' }[this.s.particles], () => this.cycleParticles()],
      ['4', 'Тела врагов', this.s.corpses ? 'остаются и тают' : 'исчезают', () => this.toggle('corpses')],
    ];
    rows.forEach(([key, label, value, fn], i) => {
      const y = 240 + i * 70;
      const btn = this.add.rectangle(640, y, 560, 54, 0x161a23).setStrokeStyle(1, 0x3a4256).setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setFillStyle(0x1f2430)); btn.on('pointerout', () => btn.setFillStyle(0x161a23)); btn.on('pointerdown', fn);
      this.layer.add(btn);
      this.layer.add(this.add.text(380, y, `(${key})  ${label}`, { ...mono, fontSize: '17px' }).setOrigin(0, 0.5));
      this.layer.add(this.add.text(900, y, value, { ...mono, fontSize: '17px', color: '#8fd3ff' }).setOrigin(1, 0.5));
    });
    this.layer.add(this.add.text(640, 560, 'Сохраняется сразу. Тряска и вспышки — только ощущение, на бой не влияют', { ...mono, fontSize: '12px', color: '#6f7890' }).setOrigin(0.5));
  }
}
