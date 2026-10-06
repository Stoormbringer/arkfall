import Phaser from 'phaser';
import { ttkTarget } from '../core/formulas';
import type { ArenaState } from './ArenaScene';

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

    const n = s.ttkSamples.length;
    const avg = n ? s.ttkSamples.reduce((a, b) => a + b, 0) / n : 0;
    const inBand = avg >= ttkTarget.min && avg <= ttkTarget.max;
    this.debug.setText([
      `сид ${s.seed}`,
      `TTK средн. ${avg.toFixed(2)} с (n=${n}) ${n ? (inBand ? '✓ в коридоре' : '✗ вне 0,6–1,5') : ''}`,
    ]);

    if (s.dead) this.banner.setText(`Убит: ${s.killer}\n\nR — новый забег`);
    else if (s.cleared) this.banner.setText('Комната пройдена');
    else this.banner.setText('');
  }
}
