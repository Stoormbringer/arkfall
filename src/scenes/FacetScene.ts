import Phaser from 'phaser';
import { facetDef } from '../run/mods';
import type { FacetRarity } from '../data/types';
import { backdrop, heading, hex, mono, panel, UI } from '../ui/theme';

export interface FacetSceneData { offer: string[]; rerollsLeft: number; rank: number; title?: string; more?: number }

const RARITY_COLOR: Record<FacetRarity, number> = { common: 0x9aa4b8, rare: 0x6fb7ff, epic: 0xd38bff };
const RARITY_NAME: Record<FacetRarity, string> = { common: 'Обычная', rare: 'Редкая', epic: 'Эпическая' };

/** Экран «1 из 3» между комнатами. Результат: game.events 'facet-chosen' (id) или 'facet-reroll'. */
export class FacetScene extends Phaser.Scene {
  constructor() { super('facet'); }

  create(data: FacetSceneData) {
    const W = 1280, H = 720;
    backdrop(this, 0.82);
    heading(this, 70, 'РУНА', data.title ?? `Ранг ${data.rank} — выбери Руну`, '#b58cff');
    this.add.text(W / 2, 158, 'Клик по карте или клавиши 1 / 2 / 3', mono(13, UI.dim)).setOrigin(0.5);

    const cardW = 300, cardH = 300, gap = 40;
    const x0 = W / 2 - (cardW * 3 + gap * 2) / 2 + cardW / 2;
    data.offer.forEach((id, i) => {
      const def = facetDef(id);
      const cx = x0 + i * (cardW + gap), cy = H / 2 + 20;
      const color = RARITY_COLOR[def.rarity];
      panel(this, cx, cy, cardW, cardH, color);
      const card = this.add.rectangle(cx, cy, cardW - 12, cardH - 12, 0xffffff, 0).setInteractive({ useHandCursor: true });
      this.add.rectangle(cx, cy - 128, 28, 22, UI.panelHi).setStrokeStyle(1, color);
      this.add.text(cx, cy - 128, `${i + 1}`, mono(13, UI.dim)).setOrigin(0.5);
      this.add.image(cx, cy - 88, 'sprites', `rune_${id}`).setScale(3);
      this.add.text(cx, cy - 56, def.name, mono(21)).setOrigin(0.5);
      this.add.text(cx, cy - 32, RARITY_NAME[def.rarity] + (def.binds ? ' · к скиллу' : ' · дикая'), mono(12, hex(color))).setOrigin(0.5);
      this.add.text(cx, cy + 36, def.effect, mono(15, UI.text, { wordWrap: { width: cardW - 40 }, align: 'center' })).setOrigin(0.5);
      card.on('pointerover', () => card.setFillStyle(0xffffff, 0.05));
      card.on('pointerout', () => card.setFillStyle(0xffffff, 0));
      card.on('pointerdown', () => this.choose(id));
      this.input.keyboard!.once(`keydown-${['ONE', 'TWO', 'THREE'][i]}`, () => this.choose(id));
    });

    if (data.more && data.more > 0) this.add.text(W / 2, H - 130, `Ещё выборов после этого: ${data.more}`, mono(13, '#b58cff')).setOrigin(0.5);
    const rerollText = data.rerollsLeft > 0 ? `R — реролл (осталось ${data.rerollsLeft})` : 'Рероллов в этом акте не осталось';
    this.add.text(W / 2, H - 100, rerollText, mono(13, data.rerollsLeft > 0 ? UI.text : UI.dim)).setOrigin(0.5);
    if (data.rerollsLeft > 0) this.input.keyboard!.once('keydown-R', () => { this.game.events.emit('facet-reroll'); this.scene.stop(); });
  }

  private choose(id: string) {
    this.game.events.emit('facet-chosen', id);
    this.scene.stop();
  }
}
