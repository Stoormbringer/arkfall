import Phaser from 'phaser';
import { loadProgress, resetProgress, type Progress } from '../meta/Progress';
import { RunState } from '../run/RunState';
import { levelFromXp } from '../meta/Level';
import { SKILLS } from '../meta/skillChoice';
import { clearRun, loadRun } from '../meta/RunSave';
import { keepOnDeath } from '../run/loot';
import { recordRun } from '../meta/Progress';
import { echoRunTotal } from '../meta/echo';

/** Стартовый экран: выбор Тира из открытых, сид, «Нырнуть». */
export class TitleScene extends Phaser.Scene {
  private progress!: Progress;
  private tier = 1;
  private seed = 0;
  private tierText!: Phaser.GameObjects.Text;
  private seedText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private hasSaved = false;

  constructor() { super('title'); }

  create() {
    this.diving = false;
    if (this.scene.isActive('hud')) this.scene.stop('hud');
    this.progress = loadProgress();
    if (this.progress.pendingMilestones.length) { this.scene.start('skillchoice'); return; }
    this.tier = this.progress.unlockedTier;
    this.seed = Math.floor(Math.random() * 1_000_000);
    const mono = { fontFamily: 'ui-monospace, Menlo, monospace', color: '#e8e4d8' };

    this.add.text(640, 150, 'КОВЧЕГ: БЕСКОНЕЧНАЯ БЕЗДНА', { ...mono, fontSize: '40px' }).setOrigin(0.5);
    this.add.text(640, 196, 'этап графики · G1', { ...mono, fontSize: '14px', color: '#6f7890' }).setOrigin(0.5);

    this.tierText = this.add.text(640, 300, '', { ...mono, fontSize: '28px' }).setOrigin(0.5);
    this.add.text(640, 336, '← → — выбрать Тир', { ...mono, fontSize: '13px', color: '#6f7890' }).setOrigin(0.5);
    this.seedText = this.add.text(640, 390, '', { ...mono, fontSize: '14px', color: '#9aa4b8' }).setOrigin(0.5);
    this.add.text(640, 412, 'S — другой сид', { ...mono, fontSize: '13px', color: '#6f7890' }).setOrigin(0.5);

    const saved = loadRun();
    if (saved) {
      const act = Math.ceil(saved.room / 10), rm = ((saved.room - 1) % 10) + 1;
      const cont = this.add.rectangle(640, 470, 420, 56, 0x161a23).setStrokeStyle(2, 0xf0c75e).setInteractive({ useHandCursor: true });
      this.add.text(640, 462, `ПРОДОЛЖИТЬ ЗАБЕГ  (Enter)`, { ...mono, fontSize: '20px' }).setOrigin(0.5);
      this.add.text(640, 486, `Тир ${saved.tier} · Акт ${act} · Комната ${rm} · Ранг ${saved.rank}`, { ...mono, fontSize: '12px', color: '#f0c75e' }).setOrigin(0.5);
      cont.on('pointerover', () => cont.setFillStyle(0x1f2430)); cont.on('pointerout', () => cont.setFillStyle(0x161a23));
      cont.on('pointerdown', () => this.resumeRun());
      const fresh = this.add.rectangle(640, 528, 420, 36, 0x161a23).setStrokeStyle(1, 0x3a4256).setInteractive({ useHandCursor: true });
      this.add.text(640, 528, 'Новый забег (N) — сохранённый засчитается как смерть', { ...mono, fontSize: '12px', color: '#9aa4b8' }).setOrigin(0.5);
      fresh.on('pointerdown', () => this.dive());
      this.hasSaved = true;
    } else {
      this.hasSaved = false;
      const btn = this.add.rectangle(640, 490, 260, 56, 0x161a23).setStrokeStyle(2, 0x8fd3ff).setInteractive({ useHandCursor: true });
      this.add.text(640, 490, 'НЫРНУТЬ  (Enter)', { ...mono, fontSize: '20px' }).setOrigin(0.5);
      btn.on('pointerover', () => btn.setFillStyle(0x1f2430));
      btn.on('pointerout', () => btn.setFillStyle(0x161a23));
      btn.on('pointerdown', () => this.dive());
    }

    this.levelText = this.add.text(640, 612, '', { ...mono, fontSize: '15px', color: '#f0c75e', align: 'center' }).setOrigin(0.5);
    const gearBtn = this.add.rectangle(520, 570, 220, 36, 0x161a23).setStrokeStyle(1, 0xf0c75e).setInteractive({ useHandCursor: true });
    this.add.text(520, 570, 'Снаряжение  (I)', { ...mono, fontSize: '14px' }).setOrigin(0.5);
    gearBtn.on('pointerdown', () => this.scene.start('gear'));
    const shopBtn = this.add.rectangle(760, 570, 220, 36, 0x161a23).setStrokeStyle(1, 0x8fd3ff).setInteractive({ useHandCursor: true });
    this.add.text(760, 570, 'Лавка Ковчега  (L)', { ...mono, fontSize: '14px' }).setOrigin(0.5);
    shopBtn.on('pointerdown', () => this.scene.start('hubshop'));
    const setBtn = this.add.rectangle(1000, 570, 200, 36, 0x161a23).setStrokeStyle(1, 0x6f7890).setInteractive({ useHandCursor: true });
    this.add.text(1000, 570, 'Настройки  (O)', { ...mono, fontSize: '14px' }).setOrigin(0.5);
    setBtn.on('pointerdown', () => this.scene.start('settings'));
    this.statsText = this.add.text(640, 650, '', { ...mono, fontSize: '13px', color: '#9aa4b8', align: 'center' }).setOrigin(0.5);
    this.add.text(640, 690, 'Забег: 3 акта × 10 комнат, босс в конце каждого акта. Живой выход после третьего босса открывает следующий Тир. · Ctrl+Shift+Del — сброс прогресса', { ...mono, fontSize: '11px', color: '#6f7890' }).setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.on('keydown-LEFT', () => { this.tier = Math.max(1, this.tier - 1); this.render(); });
    kb.on('keydown-RIGHT', () => { this.tier = Math.min(this.progress.unlockedTier, this.tier + 1); this.render(); });
    kb.on('keydown-S', () => { this.seed = Math.floor(Math.random() * 1_000_000); this.render(); });
    kb.on('keydown-ENTER', () => (this.hasSaved ? this.resumeRun() : this.dive()));
    kb.on('keydown-N', () => { if (this.hasSaved) this.dive(); });
    kb.on('keydown-I', () => this.scene.start('gear'));
    kb.on('keydown-L', () => this.scene.start('hubshop'));
    kb.on('keydown-O', () => this.scene.start('settings'));
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
    this.statsText.setText(`Открыто Тиров: ${p.unlockedTier} · Забегов: ${p.runs} · Побед: ${p.wins} · Лучшая комната: ${p.bestRoom} · Предметов: ${p.inventory.length} · Эхо: ${p.echo}`);
  }

  private resumeRun() {
    if (this.diving) return;
    const saved = loadRun();
    if (!saved) return this.dive();
    this.diving = true;
    this.scene.start('arena', { run: RunState.fromSave(saved) });
  }

  private diving = false;
  private dive() {
    if (this.diving) return;
    this.diving = true;
    // GDD §5.5: удаление сохранённого забега = смерть (лучшая половина добычи едет домой)
    const saved = loadRun();
    if (saved) { this.progress = recordRun(this.progress, saved.tier, saved.room, false, saved.xp, keepOnDeath(saved.backpack), echoRunTotal(saved.echo ?? 0, false)); clearRun(); }
    for (const k of ['arena', 'hud', 'facet', 'door', 'pause', 'summary']) if (this.scene.isActive(k) || this.scene.isPaused(k)) this.scene.stop(k);
    this.scene.start('arena', { run: new RunState(this.tier, this.seed, this.progress.skills, this.progress.equipped) });
  }
}
