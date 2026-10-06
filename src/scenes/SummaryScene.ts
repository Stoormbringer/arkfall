import Phaser from 'phaser';
import { facetDef } from '../run/mods';
import type { RunState } from '../run/RunState';
import type { Progress } from '../meta/Progress';

export interface SummaryData { run: RunState; won: boolean; killer: string; progress: Progress; unlockedNew: boolean }

/** Экран итогов забега (GDD §2 шаг 10). */
export class SummaryScene extends Phaser.Scene {
  constructor() { super('summary'); }

  create(d: SummaryData) {
    this.add.rectangle(640, 360, 1280, 720, 0x05070b, 0.9);
    const mono = { fontFamily: 'ui-monospace, Menlo, monospace', color: '#e8e4d8' };
    const title = d.won ? 'БЕЗДНА ПРОЙДЕНА' : `УБИТ: ${d.killer}`;
    this.add.text(640, 120, title, { ...mono, fontSize: '36px', color: d.won ? '#f0c75e' : '#e0553a' }).setOrigin(0.5);
    if (d.unlockedNew) this.add.text(640, 168, `Открыт Тир ${d.progress.unlockedTier}`, { ...mono, fontSize: '20px', color: '#8fd3ff' }).setOrigin(0.5);

    const common = d.run.ttkSamples.filter((x) => x.role !== 'tank' && x.role !== 'boss_hammer').map((x) => x.sec).sort((a, b) => a - b);
    const med = common.length ? common[Math.floor(common.length / 2)] : 0;
    const lines = [
      `Тир ${d.run.tier} · сид ${d.run.seed}`,
      `Комнат пройдено: ${d.won ? d.run.room : d.run.room - 1} · Убито: ${d.run.kills} · Ранг: ${d.run.rank}`,
      `TTK обычных (медиана): ${med.toFixed(2)} с`,
      '',
      'Грани забега:',
      d.run.facets.length ? d.run.facets.map((id) => '  ' + facetDef(id).name).join('\n') : '  —',
    ];
    this.add.text(640, 240, lines.join('\n'), { ...mono, fontSize: '16px', align: 'center', lineSpacing: 6 }).setOrigin(0.5, 0);

    this.add.text(640, 640, 'Enter — в хаб', { ...mono, fontSize: '18px' }).setOrigin(0.5);
    this.input.keyboard!.once('keydown-ENTER', () => { this.scene.stop('arena'); this.scene.stop('hud'); this.scene.start('title'); });
  }
}
