import Phaser from 'phaser';
import { facetDef } from '../run/mods';
import type { FacetRarity } from '../data/types';

export interface FacetSceneData { offer: string[]; rerollsLeft: number; rank: number; title?: string; more?: number }

const RARITY_COLOR: Record<FacetRarity, number> = { common: 0x9aa4b8, rare: 0x6fb7ff, epic: 0xd38bff };
const RARITY_NAME: Record<FacetRarity, string> = { common: 'Обычная', rare: 'Редкая', epic: 'Эпическая' };

/** Экран «1 из 3» между комнатами. Результат: game.events 'facet-chosen' (id) или 'facet-reroll'. */
export class FacetScene extends Phaser.Scene {
  constructor() { super('facet'); }

  create(data: FacetSceneData) {
    const W = 1280, H = 720;
    this.add.rectangle(W / 2, H / 2, W, H, 0x05070b, 0.78);
    const mono = { fontFamily: 'ui-monospace, Menlo, monospace', color: '#e8e4d8' };
    this.add.text(W / 2, 84, 'РУНА', { ...mono, fontSize: '13px', color: '#b58cff', letterSpacing: 6 }).setOrigin(0.5);
    this.add.text(W / 2, 120, data.title ?? `Ранг ${data.rank} — выбери Руну`, { ...mono, fontSize: '28px' }).setOrigin(0.5);
    this.add.text(W / 2, 158, 'Клик по карте или клавиши 1 / 2 / 3', { ...mono, fontSize: '14px', color: '#6f7890' }).setOrigin(0.5);

    const cardW = 300, cardH = 300, gap = 40;
    const x0 = W / 2 - (cardW * 3 + gap * 2) / 2 + cardW / 2;
    data.offer.forEach((id, i) => {
      const def = facetDef(id);
      const cx = x0 + i * (cardW + gap), cy = H / 2 + 20;
      const color = RARITY_COLOR[def.rarity];
      const card = this.add.rectangle(cx, cy, cardW, cardH, 0x161a23, 1).setStrokeStyle(2, color).setInteractive({ useHandCursor: true });
      this.add.text(cx, cy - 110, `${i + 1}`, { ...mono, fontSize: '14px', color: '#6f7890' }).setOrigin(0.5);
      this.add.text(cx, cy - 76, def.name, { ...mono, fontSize: '22px' }).setOrigin(0.5);
      this.add.text(cx, cy - 48, RARITY_NAME[def.rarity] + (def.binds ? ' · к скиллу' : ' · дикая'), { ...mono, fontSize: '12px', color: '#' + color.toString(16).padStart(6, '0') }).setOrigin(0.5);
      this.add.text(cx, cy + 20, def.effect, { ...mono, fontSize: '15px', wordWrap: { width: cardW - 40 }, align: 'center' }).setOrigin(0.5);
      card.on('pointerover', () => card.setFillStyle(0x1f2430));
      card.on('pointerout', () => card.setFillStyle(0x161a23));
      card.on('pointerdown', () => this.choose(id));
      this.input.keyboard!.once(`keydown-${['ONE', 'TWO', 'THREE'][i]}`, () => this.choose(id));
    });

    if (data.more && data.more > 0) this.add.text(W / 2, H - 130, `Ещё выборов после этого: ${data.more}`, { ...mono, fontSize: '14px', color: '#b58cff' }).setOrigin(0.5);
    const rerollText = data.rerollsLeft > 0 ? `R — реролл (осталось ${data.rerollsLeft})` : 'Рероллов в этом акте не осталось';
    this.add.text(W / 2, H - 100, rerollText, { ...mono, fontSize: '14px', color: data.rerollsLeft > 0 ? '#e8e4d8' : '#6f7890' }).setOrigin(0.5);
    if (data.rerollsLeft > 0) this.input.keyboard!.once('keydown-R', () => { this.game.events.emit('facet-reroll'); this.scene.stop(); });
  }

  private choose(id: string) {
    this.game.events.emit('facet-chosen', id);
    this.scene.stop();
  }
}
