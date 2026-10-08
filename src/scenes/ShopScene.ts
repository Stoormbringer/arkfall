import Phaser from 'phaser';
import { backdrop, heading, UI } from '../ui/theme';
import type { Shop } from '../run/shop';
import { healPrice, itemPrice, rerollPrice, restockPrice, sellPrice } from '../run/shop';
import { ITEMS, SLOT_NAME } from '../run/loot';
import type { FacetRarity } from '../data/types';
import F from '../data/formulas.json';

export interface ShopSceneData { shop: Shop; hp: number; maxHp: number }

const RARITY_COLOR: Record<FacetRarity, number> = { common: 0x9aa4b8, rare: 0x6fb7ff, epic: 0xd38bff };
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

/**
 * Лавка Торговца после зачистки его комнаты (GDD §8.1: золото тратится внутри забега).
 * Правит RunState напрямую (как GearScene). События: 'shop-heal' (hp) · 'shop-closed'.
 * Клавиши: 1–3 купить предмет · H лечение · R реролл Руны · T обновить · Esc / Enter — уйти.
 */
export class ShopScene extends Phaser.Scene {
  private shop!: Shop;
  private hp = 0;
  private maxHp = 0;
  private layer!: Phaser.GameObjects.Container;
  private note = '';
  constructor() { super('shop'); }

  create(data: ShopSceneData) {
    this.shop = data.shop; this.hp = data.hp; this.maxHp = data.maxHp;
    const W = 1280, H = 720;
    backdrop(this, 0.9);
    const mono = { fontFamily: 'ui-monospace, Menlo, monospace', color: '#e8e4d8' };
    heading(this, 30, 'ТОРГОВЕЦ', 'Золото сгорает в конце забега — трать сейчас', UI.ice);
    void W; void H;
    this.add.text(W / 2, 112, '1 / 2 / 3 — купить · H — лечение · R — реролл Руны · T — обновить лавку · Esc — уйти', { ...mono, fontSize: '13px', color: '#6f7890' }).setOrigin(0.5);
    this.layer = this.add.container(0, 0);
    const kb = this.input.keyboard!;
    kb.on('keydown-ONE', () => this.buy(0)); kb.on('keydown-TWO', () => this.buy(1)); kb.on('keydown-THREE', () => this.buy(2));
    kb.on('keydown-H', () => this.heal()); kb.on('keydown-R', () => this.reroll()); kb.on('keydown-T', () => this.restock());
    kb.once('keydown-ESC', () => this.close()); kb.once('keydown-ENTER', () => this.close());
    this.render();
  }

  private close() { this.scene.stop(); this.game.events.emit('shop-closed'); }
  private say(text: string) { this.note = text; }
  private get gold() { return this.shop.run.gold; }

  private buy(i: number) {
    const id = this.shop.stock[i];
    if (!id) return;
    if (this.shop.buy(i)) this.say(`Куплено: ${ITEMS[id].name} — надеть можно в меню паузы (Esc → Снаряжение)`); else this.say('Не хватает золота');
    this.render();
  }
  private heal() {
    const got = this.shop.buyHeal(this.hp, this.maxHp);
    if (got > 0) { this.hp = Math.min(this.maxHp, this.hp + got); this.game.events.emit('shop-heal', got); this.say(`+${got} HP`); }
    else this.say(this.hp >= this.maxHp ? 'HP и так полное' : 'Не хватает золота');
    this.render();
  }
  private reroll() { this.say(this.shop.buyReroll() ? 'Куплен реролл Руны (действует до конца акта)' : 'Не хватает золота'); this.render(); }
  private restock() { this.say(this.shop.restock() ? 'Ассортимент обновлён' : 'Не хватает золота'); this.render(); }
  private sell(id: string) { if (this.shop.sell(id)) this.say(`Продано: ${ITEMS[id].name}`); this.render(); }

  private button(x: number, y: number, w: number, h: number, stroke: number, enabled: boolean, onClick: () => void) {
    const btn = this.add.rectangle(x, y, w, h, 0x161a23).setStrokeStyle(2, enabled ? stroke : 0x2d3444);
    if (enabled) {
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setFillStyle(0x1f2430));
      btn.on('pointerout', () => btn.setFillStyle(0x161a23));
      btn.on('pointerdown', onClick);
    }
    this.layer.add(btn);
    return btn;
  }

  private render() {
    this.layer.removeAll(true);
    const mono = { fontFamily: 'ui-monospace, Menlo, monospace', color: '#e8e4d8' };
    const tier = this.shop.tier;
    const add = (t: Phaser.GameObjects.Text) => { this.layer.add(t); return t; };
    add(this.add.text(640, 150, `Золото: ${this.gold}    HP: ${Math.round(this.hp)}/${this.maxHp}`, { ...mono, fontSize: '18px', color: '#f0c75e' }).setOrigin(0.5));

    // витрина: 3 предмета
    const w = 300, h = 170, gap = 30, x0 = 640 - (w * 3 + gap * 2) / 2 + w / 2, cy = 270;
    this.shop.stock.forEach((id, i) => {
      const cx = x0 + i * (w + gap);
      if (!id) {
        this.button(cx, cy, w, h, 0x2d3444, false, () => undefined);
        add(this.add.text(cx, cy, 'продано', { ...mono, fontSize: '14px', color: '#6f7890' }).setOrigin(0.5));
        return;
      }
      const item = ITEMS[id], price = itemPrice(id, tier), can = this.gold >= price;
      this.button(cx, cy, w, h, RARITY_COLOR[item.rarity], can, () => this.buy(i));
      add(this.add.text(cx, cy - 64, `${i + 1} · ${SLOT_NAME[item.slot]}`, { ...mono, fontSize: '12px', color: '#6f7890' }).setOrigin(0.5));
      this.layer.add(this.add.image(cx - w / 2 + 30, cy - 36, 'sprites', `item_${id}`).setScale(2.5));
      add(this.add.text(cx + 12, cy - 36, item.name, { ...mono, fontSize: '17px', color: hex(RARITY_COLOR[item.rarity]) }).setOrigin(0.5));
      add(this.add.text(cx, cy, item.text, { ...mono, fontSize: '13px', wordWrap: { width: w - 30 }, align: 'center' }).setOrigin(0.5));
      add(this.add.text(cx, cy + 56, `${price} золота`, { ...mono, fontSize: '15px', color: can ? '#f0c75e' : '#6f7890' }).setOrigin(0.5));
    });

    // услуги
    const svc: [string, string, number, boolean, () => void][] = [
      ['H', `Лечение +${F.shop.healHp} HP`, healPrice(tier), this.hp < this.maxHp, () => this.heal()],
      ['R', `Реролл Руны +1 (сейчас ${this.shop.run.rerollsLeft})`, rerollPrice(tier), true, () => this.reroll()],
      ['T', 'Обновить лавку', restockPrice(tier, this.shop.restocks), true, () => this.restock()],
    ];
    const sw = 300, sx0 = 640 - (sw * 3 + gap * 2) / 2 + sw / 2, sy = 410;
    svc.forEach(([key, label, price, avail, fn], i) => {
      const cx = sx0 + i * (sw + gap), can = avail && this.gold >= price;
      this.button(cx, sy, sw, 64, 0x8fd3ff, can, fn);
      add(this.add.text(cx, sy - 10, `${key} · ${label}`, { ...mono, fontSize: '14px', color: avail ? '#e8e4d8' : '#6f7890' }).setOrigin(0.5));
      add(this.add.text(cx, sy + 14, `${price} золота`, { ...mono, fontSize: '13px', color: can ? '#f0c75e' : '#6f7890' }).setOrigin(0.5));
    });

    // продажа из рюкзака (не надетое)
    const sellable = this.shop.run.backpack.filter((id) => this.shop.canSell(id));
    add(this.add.text(640, 476, sellable.length ? 'Продать из рюкзака (клик):' : 'В рюкзаке нечего продать', { ...mono, fontSize: '13px', color: '#6f7890' }).setOrigin(0.5));
    const bw = 220, bgap = 12, cols = Math.min(5, Math.max(1, sellable.length));
    const bx0 = 640 - (bw * cols + bgap * (cols - 1)) / 2 + bw / 2;
    sellable.slice(0, 10).forEach((id, i) => {
      const cx = bx0 + (i % 5) * (bw + bgap), y = 516 + Math.floor(i / 5) * 54;
      const item = ITEMS[id];
      this.button(cx, y, bw, 44, RARITY_COLOR[item.rarity], true, () => this.sell(id));
      add(this.add.text(cx, y - 8, item.name, { ...mono, fontSize: '12px', color: hex(RARITY_COLOR[item.rarity]) }).setOrigin(0.5));
      add(this.add.text(cx, y + 11, `+${sellPrice(id, tier)} золота`, { ...mono, fontSize: '11px', color: '#f0c75e' }).setOrigin(0.5));
    });

    add(this.add.text(640, 640, this.note, { ...mono, fontSize: '14px', color: '#8fd3ff' }).setOrigin(0.5));
    const leave = this.button(640, 684, 260, 40, 0x3a4256, true, () => this.close());
    void leave;
    add(this.add.text(640, 684, 'Уйти · Esc', { ...mono, fontSize: '15px' }).setOrigin(0.5));
  }
}
