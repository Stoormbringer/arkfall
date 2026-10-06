import Phaser from 'phaser';
import ENEMIES from '../data/enemies.json';
import { ttkTarget } from '../core/formulas';
import { facetDef } from '../run/mods';
import type { ArenaSnapshot } from './ArenaScene';

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
type Sample = ArenaSnapshot['ttkSamples'][number];
const fmtRole = (role: keyof typeof ENEMIES, xs: Sample[]) =>
  xs.length ? `${ENEMIES[role].name} ${median(xs.map((x) => x.sec)).toFixed(2)} с / ${median(xs.map((x) => x.hits)).toFixed(0)} уд. (n=${xs.length})` : `${ENEMIES[role].name} —`;

export class HudScene extends Phaser.Scene {
  private bars!: Phaser.GameObjects.Graphics;
  private info!: Phaser.GameObjects.Text;
  private skillsText!: Phaser.GameObjects.Text;
  private facetsText!: Phaser.GameObjects.Text;
  private debug!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;

  constructor() { super('hud'); }

  create() {
    const style = { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '14px', color: '#e8e4d8' };
    this.bars = this.add.graphics();
    this.info = this.add.text(24, 48, '', style);
    this.skillsText = this.add.text(24, 72, '', { ...style, color: '#c9d1e0' });
    this.facetsText = this.add.text(24, 696, '', { ...style, fontSize: '12px', color: '#9aa4b8' }).setOrigin(0, 1);
    this.debug = this.add.text(1256, 24, '', { ...style, color: '#9aa4b8', align: 'right' }).setOrigin(1, 0);
    this.banner = this.add.text(640, 330, '', { ...style, fontSize: '28px', align: 'center' }).setOrigin(0.5);
    this.add.text(640, 696, 'WASD — движение · ЛКМ — удар · ПКМ — рывок · Q — разряд · Space — уклонение · R — заново', { ...style, color: '#6f7890', fontSize: '12px' }).setOrigin(0.5, 1);
    this.game.events.on('arena-state', (s: ArenaSnapshot) => this.render(s));
  }

  private render(s: ArenaSnapshot) {
    const g = this.bars;
    g.clear();
    // HP
    g.fillStyle(0x000000, 0.55).fillRect(24, 24, 260, 16);
    g.fillStyle(0xe0553a, 1).fillRect(24, 24, 260 * Math.max(0, s.hp / s.maxHp), 16);
    // заряды уклонения
    for (let i = 0; i < s.dodgeMax; i++) {
      const full = i < s.dodgeCharges;
      g.fillStyle(0x000000, 0.55).fillRect(24 + i * 44, 42, 40, 4);
      g.fillStyle(0x8fd3ff, 1).fillRect(24 + i * 44, 42, 40 * (full ? 1 : i === s.dodgeCharges ? s.dodge01 : 0), 4);
    }
    // Ранг
    g.fillStyle(0x000000, 0.55).fillRect(510, 24, 260, 10);
    g.fillStyle(0xf0c75e, 1).fillRect(510, 24, 260 * Math.min(1, s.shards / s.nextRankAt), 10);

    this.info.setText(`Тир ${s.tier} · Комната ${s.room} · Враги ${s.alive} · Убито ${s.kills}      Ранг ${s.rank}  ${Math.floor(s.shards)}/${Math.ceil(s.nextRankAt)} осколков`);
    const sk = s.skills.map((v) => `${v.key} ${v.name} ${v.charges !== undefined ? '●'.repeat(v.charges) + '○'.repeat((v.maxCharges ?? 0) - v.charges) : v.ready01 >= 1 ? '✓' : Math.round(v.ready01 * 100) + '%'}`);
    if (s.rhythm > 0 || s.skills.length) sk.push(`Ритм ${'|'.repeat(s.rhythm)}${'.'.repeat(5 - s.rhythm)}`);
    this.skillsText.setText(sk.join('    '));
    this.facetsText.setText(s.facets.length ? 'Грани: ' + s.facets.map((id) => facetDef(id).name).join(' · ') : '');

    const by = (r: string) => s.ttkSamples.filter((x) => x.role === r);
    const common = s.ttkSamples.filter((x) => x.role !== 'tank');
    const med = median(common.map((x) => x.sec));
    const tankMed = median(by('tank').map((x) => x.sec));
    const band = (v: number, t: { min: number; max: number }, k: number) => (k ? (v >= t.min && v <= t.max ? '✓' : `✗ цель ${t.min}–${t.max}`) : '');
    this.debug.setText([
      `сид ${s.seed}`,
      `TTK обычных ${med.toFixed(2)} с (n=${common.length}) ${band(med, ttkTarget.common, common.length)} · танк ${band(tankMed, ttkTarget.tank, by('tank').length)}`,
      fmtRole('rusher', by('rusher')), fmtRole('shooter', by('shooter')), fmtRole('tank', by('tank')),
    ]);

    if (s.dead) this.banner.setText(`Убит: ${s.killer}\n\nR — новый забег`);
    else if (s.cleared) this.banner.setText('Комната пройдена');
    else this.banner.setText('');
  }
}
