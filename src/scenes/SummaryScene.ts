import Phaser from 'phaser';
import { facetDef } from '../run/mods';
import type { RunState } from '../run/RunState';
import type { Progress } from '../meta/Progress';
import { levelFromXp } from '../meta/Level';
import { ITEMS } from '../run/loot';

export interface SummaryData { run: RunState; won: boolean; killer: string; progress: Progress; unlockedNew: boolean; loot: string[] }

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
      `Опыт: +${Math.round(d.won ? d.run.xp * 1.3 : d.run.xp)}${d.won ? ' (с бонусом завершения +30 %)' : ''} → уровень ${levelFromXp(d.progress.xp).level}` + (d.progress.pendingMilestones.length ? `  · новый скилл ждёт в хабе` : ''),
      '',
      'Руны забега:',
      d.run.facets.length ? d.run.facets.map((id) => '  ' + facetDef(id).name).join('\n') : '  —',
      '',
      d.won ? 'Добыча (вся):' : `Добыча (лучшая половина из ${d.run.backpack.length}):`,
      d.loot.length ? d.loot.map((id) => '  ' + ITEMS[id].name).join('\n') : '  —',
    ];
    this.add.text(640, 210, lines.join('\n'), { ...mono, fontSize: '15px', align: 'center', lineSpacing: 4 }).setOrigin(0.5, 0);

    this.add.text(640, 640, 'Enter или клик — в хаб', { ...mono, fontSize: '18px' }).setOrigin(0.5);
    const toHub = () => {
      for (const k of ['arena', 'hud', 'facet', 'door', 'pause']) if (this.scene.isActive(k) || this.scene.isPaused(k)) this.scene.stop(k);
      this.scene.start('title');
    };
    this.input.keyboard!.once('keydown-ENTER', toHub);
    this.input.once('pointerdown', toHub);
  }
}
