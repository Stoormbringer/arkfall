import Phaser from 'phaser';
import { equipItem, loadProgress, type Progress } from '../meta/Progress';
import { ITEMS, RARITY_ORDER, SLOT_NAME, SLOTS } from '../run/loot';
import type { FacetRarity, ItemSlot } from '../data/types';

const RARITY_COLOR: Record<FacetRarity, string> = { common: '#9aa4b8', rare: '#6fb7ff', epic: '#d38bff' };

/** Снаряжение в хабе (GDD §H): 4 слота, клик по предмету — надеть/снять. */
export class GearScene extends Phaser.Scene {
  private progress!: Progress;
  private layer!: Phaser.GameObjects.Container;
  constructor() { super('gear'); }

  create() {
    this.progress = loadProgress();
    const mono = { fontFamily: 'ui-monospace, Menlo, monospace', color: '#e8e4d8' };
    this.add.rectangle(640, 360, 1280, 720, 0x0b0d12, 1);
    this.add.text(640, 60, 'СНАРЯЖЕНИЕ', { ...mono, fontSize: '13px', color: '#f0c75e', letterSpacing: 6 }).setOrigin(0.5);
    this.add.text(640, 96, 'Клик по предмету — надеть или снять · Esc — назад в хаб', { ...mono, fontSize: '13px', color: '#6f7890' }).setOrigin(0.5);
    this.layer = this.add.container(0, 0);
    this.input.keyboard!.once('keydown-ESC', () => this.scene.start('title'));
    this.render();
  }

  private render() {
    this.layer.removeAll(true);
    const mono = { fontFamily: 'ui-monospace, Menlo, monospace', color: '#e8e4d8' };
    const colW = 300, x0 = 640 - (colW * 4 + 24 * 3) / 2 + colW / 2;
    SLOTS.forEach((slot, i) => {
      const cx = x0 + i * (colW + 24);
      const eq = this.progress.equipped[slot];
      this.layer.add(this.add.text(cx, 150, SLOT_NAME[slot], { ...mono, fontSize: '18px' }).setOrigin(0.5));
      this.layer.add(this.add.text(cx, 176, eq ? `надето: ${ITEMS[eq].name}` : 'пусто', { ...mono, fontSize: '12px', color: eq ? RARITY_COLOR[ITEMS[eq].rarity] : '#6f7890' }).setOrigin(0.5));
      const owned = this.progress.inventory.filter((id) => ITEMS[id]?.slot === slot);
      const counts = new Map<string, number>();
      for (const id of owned) counts.set(id, (counts.get(id) ?? 0) + 1);
      const ids = [...counts.keys()].sort((a, b) => RARITY_ORDER[ITEMS[b].rarity] - RARITY_ORDER[ITEMS[a].rarity]);
      if (!ids.length) this.layer.add(this.add.text(cx, 230, 'ещё не найдено', { ...mono, fontSize: '13px', color: '#6f7890' }).setOrigin(0.5));
      ids.forEach((id, j) => {
        const item = ITEMS[id], y = 230 + j * 84, isEq = eq === id;
        const card = this.add.rectangle(cx, y, colW, 72, isEq ? 0x1f2a3a : 0x161a23).setStrokeStyle(2, isEq ? 0xf0c75e : Phaser.Display.Color.HexStringToColor(RARITY_COLOR[item.rarity]).color).setInteractive({ useHandCursor: true });
        card.on('pointerover', () => card.setFillStyle(0x1f2430));
        card.on('pointerout', () => card.setFillStyle(isEq ? 0x1f2a3a : 0x161a23));
        card.on('pointerdown', () => this.toggle(slot, id));
        const n = counts.get(id)!;
        this.layer.add(card);
        this.layer.add(this.add.text(cx, y - 18, item.name + (n > 1 ? ` ×${n}` : ''), { ...mono, fontSize: '14px', color: RARITY_COLOR[item.rarity] }).setOrigin(0.5));
        this.layer.add(this.add.text(cx, y + 8, item.text, { ...mono, fontSize: '12px', wordWrap: { width: colW - 24 }, align: 'center' }).setOrigin(0.5));
      });
    });
  }

  private toggle(slot: ItemSlot, id: string) {
    this.progress = equipItem(this.progress, slot, this.progress.equipped[slot] === id ? null : id);
    this.render();
  }
}
