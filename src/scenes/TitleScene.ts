import Phaser from 'phaser';
import { loadProgress, resetProgress, type Progress } from '../meta/Progress';
import { RunState } from '../run/RunState';
import { levelFromXp } from '../meta/Level';
import { SKILLS } from '../meta/skillChoice';
import { clearRun, loadRun } from '../meta/RunSave';
import { keepOnDeath } from '../run/loot';
import { recordRun } from '../meta/Progress';
import { echoRunTotal } from '../meta/echo';
import { backdrop, button, mono, panel, UI } from '../ui/theme';
import { heroGrowth, upgradePointsFree } from '../meta/hero';

/** Стартовый экран: выбор Тира из открытых, сид, «Нырнуть». */
export class TitleScene extends Phaser.Scene {
  private progress!: Progress;
  private tier = 1;
  private seed = 0;
  private tierText!: Phaser.GameObjects.Text;
  private seedText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;
  private tierHint!: Phaser.GameObjects.Text;
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
    backdrop(this);

    // левая колонна — герой в свете факелов
    if (this.game.renderer) {
      panel(this, 250, 390, 340, 440, UI.stone);
      const t1 = this.add.sprite(130, 190, 'sprites', 'torch0').setScale(2).setDepth(3); t1.play('torch');
      const t2 = this.add.sprite(370, 190, 'sprites', 'torch0').setScale(2).setDepth(3); t2.play('torch');
      for (const x of [130, 370]) {
        const glow = this.add.image(x, 205, 'glow').setScale(3.4).setTint(0xffa040).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: glow, alpha: { from: 0.28, to: 0.42 }, duration: 420, yoyo: true, repeat: -1 });
      }
      const hero = this.add.sprite(250, 400, 'sprites', 'hero_idle0').setScale(7);
      hero.play('hero_idle');
      this.add.image(250, 430, 'glow').setScale(5).setTint(0x9fc8ff).setAlpha(0.18).setBlendMode(Phaser.BlendModes.ADD);
    }

    this.add.text(640, 70, 'КОВЧЕГ', mono(13, UI.gold, { letterSpacing: 10 })).setOrigin(0.5);
    this.add.text(640, 108, 'БЕСКОНЕЧНАЯ БЕЗДНА', mono(40)).setOrigin(0.5);
    const line = this.add.graphics(); line.lineStyle(1, UI.crimsonHex, 0.8).lineBetween(480, 140, 800, 140); line.fillStyle(UI.crimsonHex, 1).fillRect(637, 137, 6, 6);
    this.add.text(640, 158, 'этап графики · G4', mono(12, UI.dim)).setOrigin(0.5);

    // правая колонна — забег
    const cx = 830;
    panel(this, cx, 390, 700, 440, UI.stoneHi);
    this.tierText = this.add.text(cx, 220, '', mono(26)).setOrigin(0.5);
    this.tierHint = this.add.text(cx, 250, '', mono(12, UI.dim)).setOrigin(0.5);
    this.seedText = this.add.text(cx, 282, '', mono(13, UI.dim)).setOrigin(0.5);

    const saved = loadRun();
    if (saved) {
      const act = Math.ceil(saved.room / 10), rm = ((saved.room - 1) % 10) + 1;
      button(this, cx, 345, 480, 62, 'ПРОДОЛЖИТЬ ЗАБЕГ   (Enter)', { accent: UI.goldHex, hint: `Тир ${saved.tier} · Акт ${act} · Комната ${rm} · Ранг ${saved.rank}`, size: 20, onClick: () => this.resumeRun() });
      button(this, cx, 405, 480, 40, 'Новый забег   (N)', { accent: UI.stoneHi, hint: 'сохранённый засчитается как смерть', size: 13, onClick: () => this.dive() });
      this.hasSaved = true;
    } else {
      this.hasSaved = false;
      button(this, cx, 360, 480, 70, 'НЫРНУТЬ   (Enter)', { accent: UI.crimsonHex, size: 24, onClick: () => this.dive() });
    }

    const row = 470;
    const free = upgradePointsFree(this.progress);
    button(this, cx - 240, row, 150, 42, 'Снаряжение', { accent: UI.goldHex, hint: 'I', size: 13, onClick: () => this.scene.start('gear') });
    button(this, cx - 80, row, 150, 42, free > 0 ? `Прокачка (+${free})` : 'Прокачка', { accent: free > 0 ? UI.crimsonHex : UI.iceHex, hint: 'U', size: 13, onClick: () => this.scene.start('upgrade') });
    button(this, cx + 80, row, 150, 42, 'Лавка Ковчега', { accent: UI.iceHex, hint: 'L', size: 13, onClick: () => this.scene.start('hubshop') });
    button(this, cx + 240, row, 150, 42, 'Настройки', { accent: UI.stoneHi, hint: 'O', size: 13, onClick: () => this.scene.start('settings') });

    this.levelText = this.add.text(cx, 530, '', mono(14, UI.gold, { align: 'center', lineSpacing: 4 })).setOrigin(0.5, 0);
    this.statsText = this.add.text(cx, 578, '', mono(12, UI.dim, { align: 'center', wordWrap: { width: 640 } })).setOrigin(0.5, 0);
    this.add.text(640, 660, '3 акта × 10 комнат, босс в конце каждого акта. Живой выход после третьего босса открывает следующий Тир.', mono(11, UI.dim)).setOrigin(0.5);
    this.add.text(640, 684, '← → — Тир · S — другой сид · Ctrl+Shift+Del — сброс прогресса', mono(11, UI.dim)).setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.on('keydown-LEFT', () => { this.tier = Math.max(1, this.tier - 1); this.render(); });
    kb.on('keydown-RIGHT', () => { this.tier = Math.min(this.progress.unlockedTier, this.tier + 1); this.render(); });
    kb.on('keydown-S', () => { this.seed = Math.floor(Math.random() * 1_000_000); this.render(); });
    kb.on('keydown-ENTER', () => (this.hasSaved ? this.resumeRun() : this.dive()));
    kb.on('keydown-N', () => { if (this.hasSaved) this.dive(); });
    kb.on('keydown-I', () => this.scene.start('gear'));
    kb.on('keydown-L', () => this.scene.start('hubshop'));
    kb.on('keydown-O', () => this.scene.start('settings'));
    kb.on('keydown-U', () => this.scene.start('upgrade'));
    kb.on('keydown-DELETE', (e: KeyboardEvent) => { if (e.ctrlKey && e.shiftKey) { this.progress = resetProgress(); this.tier = 1; this.render(); } });
    this.render();
  }

  private render() {
    const p = this.progress;
    this.tierText.setText(`Тир ${this.tier}${this.tier < p.unlockedTier ? '  →' : ''}`);
    this.tierHint.setText(p.unlockedTier > 1 ? `открыто Тиров: ${p.unlockedTier} · ← → — выбрать` : 'пройди его без смерти, чтобы открыть Тир 2');
    this.seedText.setText(`сид ${this.seed}`);
    const lv = levelFromXp(p.xp);
    const sk = p.skills.length ? p.skills.map((id) => SKILLS[id]?.name ?? id).join(' · ') : 'пока только клинок и уклонение — первый скилл на 10 уровне';
    const g = heroGrowth(lv.level);
    this.levelText.setText(`Уровень ${lv.level} · ${Math.floor(lv.into)}/${Math.ceil(lv.need)} опыта · закалка: урон +${Math.round((g.damageMult - 1) * 100)} %, HP +${g.hpDelta}, откаты −${Math.round((1 - g.cooldownMult) * 100)} %\nСкиллы: ${sk}`);
    this.statsText.setText(`Забегов ${p.runs} · Побед ${p.wins} · Лучшая комната ${p.bestRoom} · Предметов ${p.inventory.length} · Эхо ${p.echo}`);
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
    this.scene.start('arena', { run: new RunState(this.tier, this.seed, this.progress.skills, this.progress.equipped, levelFromXp(this.progress.xp).level, this.progress.upgrades ?? {}) });
  }
}
