import Phaser from 'phaser';
import { loadProgress, type Progress } from '../meta/Progress';
import { heroGrowth, maxRank, spendUpgrade, upgradePointsFree, upgradePointsTotal, type UpgradableSlot } from '../meta/hero';
import { levelFromXp } from '../meta/Level';
import { SKILLS } from '../meta/skillChoice';
import F from '../data/formulas.json';
import { backdrop, button, heading, mono, panel, UI } from '../ui/theme';

const SLOT_NAME: Record<UpgradableSlot, string> = { damage: 'Урон', cooldown: 'Откат', area: 'Область', duration: 'Длительность', projectiles: 'Снаряды / цели', charges: 'Заряды' };
const SLOT_FMT = (slot: UpgradableSlot, v: number) => (slot === 'projectiles' || slot === 'charges' ? `+${v}` : `${v > 0 ? '+' : ''}${Math.round(v * 100)} %`);

/**
 * Прокачка (хаб, U): закалка уровня и очки улучшений — 1 очко за каждые 5 уровней, тратится на слот скилла (GDD §C.3).
 * Клик по слоту — +1 ранг. Esc — назад.
 */
export class UpgradeScene extends Phaser.Scene {
  private p!: Progress;
  private layer!: Phaser.GameObjects.Container;
  constructor() { super('upgrade'); }

  create() {
    this.p = loadProgress();
    backdrop(this);
    heading(this, 30, 'ПРОКАЧКА', 'Закалка и улучшения скиллов');
    this.add.text(640, 104, 'Клик по слоту — +1 ранг. Очко за каждые 5 уровней. Сброс скиллов в Лавке возвращает очки · Esc — назад', mono(12, UI.dim)).setOrigin(0.5);
    this.layer = this.add.container(0, 0);
    this.input.keyboard!.once('keydown-ESC', () => this.scene.start('title'));
    this.render();
  }

  private render() {
    this.layer.removeAll(true);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => { this.layer.add(o); return o; };
    const level = levelFromXp(this.p.xp).level, g = heroGrowth(level);
    const free = upgradePointsFree(this.p), total = upgradePointsTotal(level);

    // закалка
    add(panel(this, 640, 170, 1000, 70, UI.goldHex));
    add(this.add.text(640, 158, `Уровень ${level} · закалка: урон +${Math.round((g.damageMult - 1) * 100)} % · HP +${g.hpDelta} · откаты −${Math.round((1 - g.cooldownMult) * 100)} %`, mono(16, UI.gold)).setOrigin(0.5));
    add(this.add.text(640, 182, `Очков улучшений: ${free} свободно из ${total} · следующее на уровне ${(Math.floor(level / F.heroGrowth.upgradePointEveryLevels) + 1) * F.heroGrowth.upgradePointEveryLevels}`, mono(13, free > 0 ? UI.ice : UI.dim)).setOrigin(0.5));

    if (!this.p.skills.length) { add(this.add.text(640, 320, 'Скиллов ещё нет — первый на 10 уровне', mono(15, UI.dim)).setOrigin(0.5)); return; }
    const cols = Math.min(3, this.p.skills.length), w = 380, h = 200, gap = 20;
    const x0 = 640 - (w * cols + gap * (cols - 1)) / 2 + w / 2;
    this.p.skills.forEach((id, i) => {
      const def = SKILLS[id]; if (!def) return;
      const cx = x0 + (i % cols) * (w + gap), cy = 320 + Math.floor(i / cols) * (h + gap);
      add(panel(this, cx, cy, w, h, UI.iceHex));
      add(this.add.text(cx, cy - h / 2 + 22, def.name, mono(17)).setOrigin(0.5));
      const slots = def.upgradeSlots.filter((s) => s !== 'unique') as UpgradableSlot[];
      slots.forEach((slot, j) => {
        const y = cy - h / 2 + 56 + j * 32;
        const rank = this.p.upgrades?.[id]?.[slot] ?? 0, max = maxRank(slot);
        const steps = (F.upgradeSlots as Record<string, number[]>)[slot];
        const cur = steps.slice(0, rank).reduce((a, b) => a + b, 0);
        const can = free > 0 && rank < max;
        const b = add(button(this, cx, y, w - 40, 28, '', { accent: can ? UI.iceHex : UI.stone, size: 12, disabled: !can, onClick: () => this.spend(id, slot) }));
        void b;
        add(this.add.text(cx - w / 2 + 32, y, `${SLOT_NAME[slot]}`, mono(13)).setOrigin(0, 0.5));
        add(this.add.text(cx + 10, y, '●'.repeat(rank) + '○'.repeat(max - rank), mono(12, UI.ice)).setOrigin(0.5));
        add(this.add.text(cx + w / 2 - 32, y, rank ? SLOT_FMT(slot, cur) : `+${SLOT_FMT(slot, steps[0]).replace('+', '')}`, mono(12, rank ? UI.text : UI.dim)).setOrigin(1, 0.5));
      });
      if (def.unique) add(this.add.text(cx, cy + h / 2 - 16, `Уникальное: ${def.unique.name} (позже)`, mono(10, UI.dim)).setOrigin(0.5));
    });
  }

  private spend(id: string, slot: UpgradableSlot) {
    const next = spendUpgrade(this.p, id, slot);
    if (next) { this.p = next; this.game.events.emit('sfx', 'rune'); }
    this.render();
  }
}
