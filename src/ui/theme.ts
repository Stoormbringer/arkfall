import Phaser from 'phaser';

/** Единый скин UI (G4): камень и багрянец. Все экраны рисуют панели и кнопки только отсюда. */
export const UI = {
  font: 'ui-monospace, Menlo, monospace',
  bg: 0x0b0a0c, panel: 0x1b171d, panelHi: 0x272028, stone: 0x3a333c, stoneHi: 0x5a515c,
  text: '#e8e4d8', dim: '#8a8292', gold: '#d6ae3c', crimson: '#b2202c', ice: '#8fd3ff',
  goldHex: 0xd6ae3c, crimsonHex: 0xb2202c, iceHex: 0x8fd3ff,
  rarity: { common: 0x9aa4b8, rare: 0x6fb7ff, epic: 0xd38bff } as Record<string, number>,
};

export const mono = (size: number, color = UI.text, extra: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.Types.GameObjects.Text.TextStyle =>
  ({ fontFamily: UI.font, fontSize: `${size}px`, color, ...extra });

export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

/** Каменная панель: тёмная заливка, двойная рамка, уголки */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, accent = UI.stoneHi, alpha = 1): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(UI.panel, alpha).fillRect(-w / 2, -h / 2, w, h);
  g.lineStyle(2, UI.stone, 1).strokeRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4);
  g.lineStyle(1, accent, 0.9).strokeRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12);
  // уголки
  g.fillStyle(accent, 1);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    g.fillRect(sx * (w / 2 - 10) - 3, sy * (h / 2 - 10) - 3, 6, 6);
  }
  c.add(g);
  return c;
}

export interface ButtonOpts { accent?: number; hint?: string; size?: number; onClick?: () => void; disabled?: boolean }

/** Кнопка-плита с подсветкой при наведении */
export function button(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, o: ButtonOpts = {}): Phaser.GameObjects.Container {
  const accent = o.disabled ? UI.stone : (o.accent ?? UI.stoneHi);
  const c = scene.add.container(x, y);
  const bg = scene.add.rectangle(0, 0, w, h, UI.panel).setStrokeStyle(2, accent);
  const inner = scene.add.rectangle(0, 0, w - 8, h - 8).setStrokeStyle(1, accent, 0.45);
  const t = scene.add.text(0, o.hint ? -8 : 0, label, mono(o.size ?? 18, o.disabled ? UI.dim : UI.text)).setOrigin(0.5);
  c.add([bg, inner, t]);
  if (o.hint) c.add(scene.add.text(0, 14, o.hint, mono(11, UI.dim)).setOrigin(0.5));
  if (!o.disabled && o.onClick) {
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(UI.panelHi));
    bg.on('pointerout', () => bg.setFillStyle(UI.panel));
    bg.on('pointerdown', o.onClick);
  }
  return c;
}

/** Заголовок экрана: надпись-кикер над заголовком и багровая черта */
export function heading(scene: Phaser.Scene, y: number, kicker: string, title: string, accent = UI.gold) {
  scene.add.text(640, y, kicker, mono(12, accent, { letterSpacing: 6 })).setOrigin(0.5);
  scene.add.text(640, y + 34, title, mono(28)).setOrigin(0.5);
  const g = scene.add.graphics();
  g.lineStyle(1, UI.crimsonHex, 0.8).lineBetween(560, y + 58, 720, y + 58);
  g.fillStyle(UI.crimsonHex, 1).fillRect(637, y + 55, 6, 6);
}

/** Фон экрана: тёмный камень с виньеткой */
export function backdrop(scene: Phaser.Scene, alpha = 1) {
  scene.add.rectangle(640, 360, 1280, 720, UI.bg, alpha);
  const g = scene.add.graphics();
  for (let i = 0; i < 5; i++) g.lineStyle(40, 0x000000, 0.08 * (5 - i)).strokeRect(20 + i * 20, 20 + i * 20, 1240 - i * 40, 680 - i * 40);
}
