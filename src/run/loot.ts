import ITEMS_RAW from '../data/items.json';
import F from '../data/formulas.json';
import type { Rng } from '../core/rng';
import type { FacetRarity, ItemDef, ItemSlot } from '../data/types';

export const ITEMS = Object.fromEntries(Object.entries(ITEMS_RAW).filter(([k]) => !k.startsWith('_'))) as Record<string, ItemDef>;
export const SLOTS: ItemSlot[] = ['weapon', 'armor', 'accessory', 'artifact'];
export const SLOT_NAME: Record<ItemSlot, string> = { weapon: 'Клинок', armor: 'Доспех', accessory: 'Аксессуар', artifact: 'Артефакт' };
export const RARITY_ORDER: Record<FacetRarity, number> = { common: 0, rare: 1, epic: 2 };

/** Веса редкости растут с Тиром (GDD §H): предметы без уровня, но шанс редких выше глубже */
export function rarityWeights(tier: number): Record<FacetRarity, number> {
  const w = { ...F.loot.rarityWeights } as Record<FacetRarity, number>;
  w.epic += F.loot.epicPerTier * (tier - 1);
  w.rare += F.loot.rarePerTier * (tier - 1);
  return w;
}

/** Случайный предмет: сначала редкость по весам, затем равновероятно внутри редкости; без повторов из excluded */
export function rollItem(rng: Rng, tier: number, excluded: string[] = []): string | null {
  const rarity = rng.pick<FacetRarity>(rarityWeights(tier));
  let pool = Object.keys(ITEMS).filter((id) => ITEMS[id].rarity === rarity && !excluded.includes(id));
  if (!pool.length) pool = Object.keys(ITEMS).filter((id) => !excluded.includes(id));
  if (!pool.length) return null;
  return pool[Math.floor(rng.next() * pool.length)];
}

/** Смерть: домой уезжает лучшая половина рюкзака (округление вверх), по редкости */
export function keepOnDeath(backpack: string[]): string[] {
  const sorted = [...backpack].sort((a, b) => RARITY_ORDER[ITEMS[b].rarity] - RARITY_ORDER[ITEMS[a].rarity]);
  return sorted.slice(0, Math.ceil(sorted.length / 2));
}
