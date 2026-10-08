import Phaser from 'phaser';
import { equipItem, loadProgress, type Progress } from '../meta/Progress';
import { ITEMS, RARITY_ORDER, SLOT_NAME, SLOTS } from '../run/loot';
import type { FacetRarity, ItemSlot } from '../data/types';
import type { RunState } from '../run/RunState';

const RARITY_COLOR: Record<FacetRarity, string> = { common: '#9aa4b8', rare: '#6fb7ff', epic: '#d38bff' };
export interface GearData { run?: RunState }

/**
 * Снаряжение (GDD §H): 4 слота, клик — надеть/снять.
 * Из хаба — экипировка аккаунта. Из забега — то же плюс находки рюкзака; изменения применяются сразу.
 */
export class GearScene extends Phaser.Scene {
  private progress!: Progress;
  private run?: RunState;
  private layer!: Phaser.GameObjects.Container;
  constructor() { super('gear'); }

  create(data: GearData) {
    this.progress = loadProgress();
    this.run = data?.run;
    const mono = { fontFamily: 'ui-monospace, Menlo, monospace', color: '#e8e4d8' };
    this.add.rectangle(640, 360, 1280, 720, 0x0b0d12, this.run ? 0.94 : 1);
    this.add.text(640, 60, 'СНАРЯЖЕНИЕ', { ...mono, fontSize: '13px', color: '#f0c75e', letterSpacing: 6 }).setOrigin(0.5);
    this.add.text(640, 96, this.run ? 'Клик — надеть или снять, действует сразу · Esc — назад в бой' : 'Клик — надеть или снять · Esc — назад в хаб', { ...mono, fontSize: '13px', color: '#6f7890' }).setOrigin(0.5);
    this.layer = this.add.container(0, 0);
    this.input.keyboard!.once('keydown-ESC', () => this.close());
    this.render();
  }

  private close() {
    if (this.run) { this.scene.stop(); this.game.events.emit('gear-closed'); }
    else this.scene.start('title');
  }

  private get equipped() { return this.run ? this.run.equipped : this.progress.equipped; }

  private render() {
    this.layer.removeAll(true);
    const mono = { fontFamily: 'ui-monospace, Menlo, monospace', color: '#e8e4d8' };
    const colW = 300, x0 = 640 - (colW * 4 + 24 * 3) / 2 + colW / 2;
    const fromRun = new Set(this.run?.backpack ?? []);
    const all = [...this.progress.inventory, ...(this.run?.backpack ?? [])];
    SLOTS.forEach((slot, i) => {
      const cx = x0 + i * (colW + 24);
      const eq = this.equipped[slot];
      this.layer.add(this.add.text(cx, 150, SLOT_NAME[slot], { ...mono, fontSize: '18px' }).setOrigin(0.5));
      this.layer.add(this.add.text(cx, 176, eq ? `надето: ${ITEMS[eq].name}` : 'пусто', { ...mono, fontSize: '12px', color: eq ? RARITY_COLOR[ITEMS[eq].rarity] : '#6f7890' }).setOrigin(0.5));
      const counts = new Map<string, number>();
      for (const id of all) if (ITEMS[id]?.slot === slot) counts.set(id, (counts.get(id) ?? 0) + 1);
      const ids = [...counts.keys()].sort((a, b) => RARITY_ORDER[ITEMS[b].rarity] - RARITY_ORDER[ITEMS[a].rarity]);
      if (!ids.length) this.layer.add(this.add.text(cx, 230, 'ещё не найдено', { ...mono, fontSize: '13px', color: '#6f7890' }).setOrigin(0.5));
      ids.forEach((id, j) => {
        const item = ITEMS[id], y = 230 + j * 84, isEq = eq === id;
        const card = this.add.rectangle(cx, y, colW, 72, isEq ? 0x1f2a3a : 0x161a23).setStrokeStyle(2, isEq ? 0xf0c75e : Phaser.Display.Color.HexStringToColor(RARITY_COLOR[item.rarity]).color).setInteractive({ useHandCursor: true });
        card.on('pointerover', () => card.setFillStyle(0x1f2430));
        card.on('pointerout', () => card.setFillStyle(isEq ? 0x1f2a3a : 0x161a23));
        card.on('pointerdown', () => this.toggle(slot, id));
        const n = counts.get(id)!;
        const tag = fromRun.has(id) && !this.progress.inventory.includes(id) ? ' · найдено в забеге' : '';
        this.layer.add(card);
        this.layer.add(this.add.text(cx, y - 18, item.name + (n > 1 ? ` ×${n}` : ''), { ...mono, fontSize: '14px', color: RARITY_COLOR[item.rarity] }).setOrigin(0.5));
        this.layer.add(this.add.text(cx, y + 8, item.text + tag, { ...mono, fontSize: '12px', wordWrap: { width: colW - 24 }, align: 'center' }).setOrigin(0.5));
      });
    });
  }

  private toggle(slot: ItemSlot, id: string) {
    const next = this.equipped[slot] === id ? null : id;
    // экипировка аккаунта обновляется всегда (кроме предметов, которые ещё только в рюкзаке забега)
    if (next === null || this.progress.inventory.includes(next)) this.progress = equipItem(this.progress, slot, next);
    if (this.run) {
      if (next === null) delete this.run.equipped[slot]; else this.run.equipped[slot] = next;
      this.run.rebuildMods();
    }
    this.render();
  }
}
