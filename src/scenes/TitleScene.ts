import Phaser from 'phaser';
import { loadProgress, resetProgress, type Progress } from '../meta/Progress';
import { RunState } from '../run/RunState';
import { levelFromXp } from '../meta/Level';
import { SKILLS } from '../meta/skillChoice';

/** Стартовый экран: выбор Тира из открытых, сид, «Нырнуть». */
export class TitleScene extends Phaser.Scene {
  private progress!: Progress;
  private tier = 1;
  private seed = 0;
  private tierText!: Phaser.GameObjects.Text;
  private seedText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;

  constructor() { super('title'); }

  create() {
    this.scene.stop('hud');
    this.progress = loadProgress();
    if (this.progress.pendingMilestones.length) { this.scene.start('skillchoice'); return; }
    this.tier = this.progress.unlockedTier;
    this.seed = Math.floor(Math.random() * 1_000_000);
    const mono = { fontFamily: 'ui-monospace, Menlo, monospace', color: '#e8e4d8' };

    this.add.text(640, 150, 'КОВЧЕГ: БЕЗДНА СЛОЁВ', { ...mono, fontSize: '40px' }).setOrigin(0.5);
    this.add.text(640, 196, 'прототип · этап 1', { ...mono, fontSize: '14px', color: '#6f7890' }).setOrigin(0.5);

    this.tierText = this.add.text(640, 300, '', { ...mono, fontSize: '28px' }).setOrigin(0.5);
    this.add.text(640, 336, '← → — выбрать Тир', { ...mono, fontSize: '13px', color: '#6f7890' }).setOrigin(0.5);
    this.seedText = this.add.text(640, 390, '', { ...mono, fontSize: '14px', color: '#9aa4b8' }).setOrigin(0.5);
    this.add.text(640, 412, 'S — другой сид', { ...mono, fontSize: '13px', color: '#6f7890' }).setOrigin(0.5);

    const btn = this.add.rectangle(640, 490, 260, 56, 0x161a23).setStrokeStyle(2, 0x8fd3ff).setInteractive({ useHandCursor: true });
    this.add.text(640, 490, 'НЫРНУТЬ  (Enter)', { ...mono, fontSize: '20px' }).setOrigin(0.5);
    btn.on('pointerover', () => btn.setFillStyle(0x1f2430));
    btn.on('pointerout', () => btn.setFillStyle(0x161a23));
    btn.on('pointerdown', () => this.dive());

    this.levelText = this.add.text(640, 560, '', { ...mono, fontSize: '15px', color: '#f0c75e', align: 'center' }).setOrigin(0.5);
    this.statsText = this.add.text(640, 610, '', { ...mono, fontSize: '13px', color: '#9aa4b8', align: 'center' }).setOrigin(0.5);
    this.add.text(640, 690, 'Забег: 3 акта × 10 комнат, босс в конце каждого акта. Живой выход после третьего босса открывает следующий Тир. · Ctrl+Shift+Del — сброс прогресса', { ...mono, fontSize: '11px', color: '#6f7890' }).setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.on('keydown-LEFT', () => { this.tier = Math.max(1, this.tier - 1); this.render(); });
    kb.on('keydown-RIGHT', () => { this.tier = Math.min(this.progress.unlockedTier, this.tier + 1); this.render(); });
    kb.on('keydown-S', () => { this.seed = Math.floor(Math.random() * 1_000_000); this.render(); });
    kb.on('keydown-ENTER', () => this.dive());
    kb.on('keydown-DELETE', (e: KeyboardEvent) => { if (e.ctrlKey && e.shiftKey) { this.progress = resetProgress(); this.tier = 1; this.render(); } });
    this.render();
  }

  private render() {
    const p = this.progress;
    this.tierText.setText(`Тир ${this.tier}  ${this.tier < p.unlockedTier ? '→' : p.unlockedTier > 1 ? '' : '(пройди его без смерти, чтобы открыть Тир 2)'}`.trim());
    this.seedText.setText(`сид ${this.seed}`);
    const lv = levelFromXp(p.xp);
    const sk = p.skills.length ? p.skills.map((id) => SKILLS[id]?.name ?? id).join(' · ') : 'пока только клинок и уклонение — первый скилл на 10 уровне';
    this.levelText.setText(`Уровень ${lv.level} · ${Math.floor(lv.into)}/${Math.ceil(lv.need)} опыта\nСкиллы: ${sk}`);
    this.statsText.setText(`Открыто Тиров: ${p.unlockedTier} · Забегов: ${p.runs} · Побед: ${p.wins} · Лучшая комната: ${p.bestRoom}`);
  }

  private dive() {
    this.scene.start('arena', { run: new RunState(this.tier, this.seed, this.progress.skills) });
  }
}
