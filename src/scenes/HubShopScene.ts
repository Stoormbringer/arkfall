import Phaser from 'phaser';
import { loadProgress, type Progress } from '../meta/Progress';
import { buyHubItem, hubItemPrice, hubShopFor, resetSkills, skillResetPrice } from '../meta/echo';
import { levelFromXp } from '../meta/Level';
import { ITEMS, SLOT_NAME } from '../run/loot';
import { SKILLS } from '../meta/skillChoice';
import type { FacetRarity } from '../data/types';
import F from '../data/formulas.json';

const RARITY_COLOR: Record<FacetRarity, number> = { common: 0x9aa4b8, rare: 0x6fb7ff, epic: 0xd38bff };
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

/**
 * Лавка Ковчега (хаб, GDD §8.3): предметы за Эхо, ассортимент меняется раз в N забегов; сброс скиллов.
 * Клавиши: 1–3 купить · R сброс скиллов (два нажатия) · Esc — в хаб.
 */
export class HubShopScene extends Phaser.Scene {
  private progress!: Progress;
  private layer!: Phaser.GameObjects.Container;
  private note = '';
  private confirmReset = false;
  constructor() { super('hubshop'); }

  create() {
    this.progress = loadProgress();
    this.note = ''; this.confirmReset = false;
    const mono = { fontFamily: 'ui-monospace, Menlo, monospace', color: '#e8e4d8' };
    this.add.rectangle(640, 360, 1280, 720, 0x0b0d12, 1);
    this.add.text(640, 60, 'ЛАВКА КОВЧЕГА', { ...mono, fontSize: '13px', color: '#8fd3ff', letterSpacing: 6 }).setOrigin(0.5);
    this.add.text(640, 96, 'Эхо не сгорает. Ассортимент меняется каждые ' + F.echo.hubShop.rotateEveryRuns + ' забега · 1 / 2 / 3 — купить · R — сброс скиллов · Esc — назад', { ...mono, fontSize: '13px', color: '#6f7890' }).setOrigin(0.5);
    this.layer = this.add.container(0, 0);
    const kb = this.input.keyboard!;
    kb.on('keydown-ONE', () => this.buy(0)); kb.on('keydown-TWO', () => this.buy(1)); kb.on('keydown-THREE', () => this.buy(2));
    kb.on('keydown-R', () => this.reset());
    kb.once('keydown-ESC', () => this.scene.start('title'));
    this.render();
  }

  private buy(i: number) {
    const shop = hubShopFor(this.progress);
    const id = shop.stock[i];
    if (!id) return;
    const next = buyHubItem(this.progress, i);
    if (next) { this.progress = next; this.note = `Куплено: ${ITEMS[id].name} — в Снаряжении`; } else this.note = 'Не хватает Эхо';
    this.confirmReset = false;
    this.render();
  }

  private reset() {
    const level = levelFromXp(this.progress.xp).level;
    if (!this.progress.skills.length) { this.note = 'Скиллов ещё нет'; this.render(); return; }
    if (this.progress.echo < skillResetPrice(level)) { this.note = 'Не хватает Эхо'; this.render(); return; }
    if (!this.confirmReset) { this.confirmReset = true; this.note = 'Сбросить все скиллы? Ещё раз R — да, любое действие — нет'; this.render(); return; }
    const next = resetSkills(this.progress);
    if (next) { this.progress = next; this.note = 'Скиллы сброшены — выбор заново ждёт в хабе'; }
    this.confirmReset = false;
    this.render();
  }

  private render() {
    this.layer.removeAll(true);
    const mono = { fontFamily: 'ui-monospace, Menlo, monospace', color: '#e8e4d8' };
    const p = this.progress, tier = p.unlockedTier, shop = hubShopFor(p);
    const add = (t: Phaser.GameObjects.Text) => { this.layer.add(t); return t; };
    add(this.add.text(640, 150, `Эхо: ${p.echo}    цены для Тира ${tier}    смена ассортимента через ${F.echo.hubShop.rotateEveryRuns - (p.runs % F.echo.hubShop.rotateEveryRuns)} забег(а)`, { ...mono, fontSize: '16px', color: '#f0c75e' }).setOrigin(0.5));

    const w = 300, h = 170, gap = 30, x0 = 640 - (w * 3 + gap * 2) / 2 + w / 2, cy = 280;
    shop.stock.forEach((id, i) => {
      const cx = x0 + i * (w + gap);
      const card = this.add.rectangle(cx, cy, w, h, 0x161a23);
      this.layer.add(card);
      if (!id) { card.setStrokeStyle(2, 0x2d3444); add(this.add.text(cx, cy, 'продано', { ...mono, fontSize: '14px', color: '#6f7890' }).setOrigin(0.5)); return; }
      const item = ITEMS[id], price = hubItemPrice(id, tier), can = p.echo >= price;
      card.setStrokeStyle(2, can ? RARITY_COLOR[item.rarity] : 0x2d3444);
      if (can) {
        card.setInteractive({ useHandCursor: true });
        card.on('pointerover', () => card.setFillStyle(0x1f2430)); card.on('pointerout', () => card.setFillStyle(0x161a23));
        card.on('pointerdown', () => this.buy(i));
      }
      const owned = p.inventory.filter((x) => x === id).length;
      add(this.add.text(cx, cy - 64, `${i + 1} · ${SLOT_NAME[item.slot]}${owned ? ` · есть ×${owned}` : ''}`, { ...mono, fontSize: '12px', color: '#6f7890' }).setOrigin(0.5));
      add(this.add.text(cx, cy - 36, item.name, { ...mono, fontSize: '17px', color: hex(RARITY_COLOR[item.rarity]) }).setOrigin(0.5));
      add(this.add.text(cx, cy, item.text, { ...mono, fontSize: '13px', wordWrap: { width: w - 30 }, align: 'center' }).setOrigin(0.5));
      add(this.add.text(cx, cy + 56, `${price} Эхо`, { ...mono, fontSize: '15px', color: can ? '#f0c75e' : '#6f7890' }).setOrigin(0.5));
    });

    // сброс скиллов
    const level = levelFromXp(p.xp).level, price = skillResetPrice(level), canReset = p.skills.length > 0 && p.echo >= price;
    const btn = this.add.rectangle(640, 430, 640, 64, 0x161a23).setStrokeStyle(2, canReset ? 0xe0553a : 0x2d3444);
    if (canReset) { btn.setInteractive({ useHandCursor: true }); btn.on('pointerdown', () => this.reset()); }
    this.layer.add(btn);
    const sk = p.skills.length ? p.skills.map((id) => SKILLS[id]?.name ?? id).join(' · ') : 'скиллов нет';
    add(this.add.text(640, 420, `R · Сброс скиллов — ${price} Эхо`, { ...mono, fontSize: '15px', color: canReset ? '#e8e4d8' : '#6f7890' }).setOrigin(0.5));
    add(this.add.text(640, 444, `Сейчас: ${sk}. После сброса все милстоуны до ${level} уровня выбираются заново`, { ...mono, fontSize: '11px', color: '#6f7890' }).setOrigin(0.5));

    add(this.add.text(640, 520, this.note, { ...mono, fontSize: '14px', color: this.confirmReset ? '#e0553a' : '#8fd3ff' }).setOrigin(0.5));
    add(this.add.text(640, 600, 'Эхо приходит с Логова элиты (5), боссов актов (40 / 50 / 60) и +30 % за живой выход; растёт с Тиром', { ...mono, fontSize: '12px', color: '#6f7890' }).setOrigin(0.5));
  }
}
