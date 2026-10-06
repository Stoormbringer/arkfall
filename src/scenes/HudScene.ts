import Phaser from 'phaser';
import { ttkTarget } from '../core/formulas';
import type { ArenaState, TtkSample } from './ArenaScene';
import ENEMIES from '../data/enemies.json';

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const fmtRole = (role: keyof typeof ENEMIES, xs: TtkSample[]) =>
  xs.length ? `${ENEMIES[role].name} ${median(xs.map((x) => x.sec)).toFixed(2)} с / ${median(xs.map((x) => x.hits)).toFixed(0)} уд. (n=${xs.length})` : `${ENEMIES[role].name} —`;

export class HudScene extends Phaser.Scene {
  private hpBar!: Phaser.GameObjects.Graphics;
  private info!: Phaser.GameObjects.Text;
  private debug!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;

  constructor() { super('hud'); }

  create() {
    const style = { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '14px', color: '#e8e4d8' };
    this.hpBar = this.add.graphics();
    this.info = this.add.text(24, 48, '', style);
    this.debug = this.add.text(1256, 24, '', { ...style, color: '#9aa4b8', align: 'right' }).setOrigin(1, 0);
    this.banner = this.add.text(640, 330, '', { ...style, fontSize: '28px', align: 'center' }).setOrigin(0.5);
    this.add.text(640, 696, 'WASD — движение · ЛКМ — удар · Space/Shift — уклонение · R — заново после смерти', { ...style, color: '#6f7890', fontSize: '12px' }).setOrigin(0.5, 1);

    this.game.events.on('arena-state', (s: ArenaState) => this.render(s));
  }

  private render(s: ArenaState) {
    const g = this.hpBar;
    g.clear();
    g.fillStyle(0x000000, 0.55).fillRect(24, 24, 260, 16);
    g.fillStyle(0xe0553a, 1).fillRect(24, 24, 260 * Math.max(0, s.hp / s.maxHp), 16);
    g.fillStyle(0x000000, 0.55).fillRect(24, 42, 120, 4);
    g.fillStyle(0x8fd3ff, 1).fillRect(24, 42, 120 * s.dodge01, 4);

    this.info.setText(`Тир ${s.tier} · Комната ${s.room} · Враги ${s.alive} · Убито ${s.kills}`);

    const by = (r: TtkSample['role']) => s.ttkSamples.filter((x) => x.role === r);
    const common = s.ttkSamples.filter((x) => x.role !== 'tank');
    const med = median(common.map((x) => x.sec));
    const tankMed = median(by('tank').map((x) => x.sec));
    const band = (v: number, t: { min: number; max: number }, k: number) => (k ? (v >= t.min && v <= t.max ? '✓' : `✗ цель ${t.min}–${t.max}`) : '');
    this.debug.setText([
      `сид ${s.seed}`,
      `TTK обычных ${med.toFixed(2)} с (n=${common.length}) ${band(med, ttkTarget.common, common.length)} · танк ${band(tankMed, ttkTarget.tank, by('tank').length)}`,
      fmtRole('rusher', by('rusher')),
      fmtRole('shooter', by('shooter')),
      fmtRole('tank', by('tank')),
    ]);

    if (s.dead) this.banner.setText(`Убит: ${s.killer}\n\nR — новый забег`);
    else if (s.cleared) this.banner.setText('Комната пройдена');
    else this.banner.setText('');
  }
}
