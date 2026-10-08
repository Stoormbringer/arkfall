import F from '../data/formulas.json';
import type { Rng } from '../core/rng';
import type { FacetRarity } from '../data/types';
import { ITEMS, rollItem } from './loot';
import type { RunState } from './RunState';

/** Золото и цены растут с Тиром одинаково — покупательная способность не меняется, меняются только числа (GDD §8.4) */
export const goldTierMult = (tier: number) => 1 + F.gold.tierStep * (tier - 1);

/** Золото за обычного моба: 1–3 × (1 + 0,03·R) × мульт. Тира (GDD §8.2) */
export function goldForMob(rng: Rng, tier: number, room: number): number {
  const base = F.gold.mobMin + Math.floor(rng.next() * (F.gold.mobMax - F.gold.mobMin + 1));
  return Math.round(base * (1 + F.gold.roomGrowth * room) * goldTierMult(tier));
}
export const goldForBoss = (tier: number) => Math.round(F.gold.bossBonus * goldTierMult(tier));
export const goldForEliteRoom = (tier: number) => Math.round(F.gold.eliteRoomBonus * goldTierMult(tier));

export const itemPrice = (id: string, tier: number) => Math.round(F.shop.itemPrice[ITEMS[id].rarity as FacetRarity] * goldTierMult(tier));
export const sellPrice = (id: string, tier: number) => Math.round(itemPrice(id, tier) * F.shop.sellRatio);
export const healPrice = (tier: number) => Math.round(F.shop.healPrice * goldTierMult(tier));
export const rerollPrice = (tier: number) => Math.round(F.shop.rerollPrice * goldTierMult(tier));
/** Цена обновления ассортимента растёт с каждым обновлением в этой лавке */
export const restockPrice = (tier: number, restocks: number) => Math.round(F.shop.restockPrice * F.shop.restockGrowth ** restocks * goldTierMult(tier));

/** Ассортимент: N разных предметов, редкость по весам Тира; рюкзак не исключается — дубликаты в лавке допустимы, но не внутри одной витрины */
export function rollShopStock(rng: Rng, tier: number): string[] {
  const stock: string[] = [];
  for (let i = 0; i < F.shop.itemSlots; i++) {
    const id = rollItem(rng, tier, stock);
    if (id) stock.push(id);
  }
  return stock;
}

/** Состояние одной лавки; живёт только пока открыт экран */
export class Shop {
  stock: (string | null)[];
  restocks = 0;
  constructor(private rng: Rng, readonly run: RunState) { this.stock = rollShopStock(rng, run.tier); }

  get tier() { return this.run.tier; }

  buy(index: number): boolean {
    const id = this.stock[index];
    if (!id || !this.run.spendGold(itemPrice(id, this.tier))) return false;
    this.run.backpack.push(id);
    this.stock[index] = null;
    return true;
  }
  /** Продать можно только то, что в рюкзаке и не надето */
  canSell(id: string) { return this.run.backpack.includes(id) && !Object.values(this.run.equipped).includes(id); }
  sell(id: string): boolean {
    if (!this.canSell(id)) return false;
    this.run.backpack.splice(this.run.backpack.indexOf(id), 1);
    this.run.addGold(sellPrice(id, this.tier));
    return true;
  }
  buyReroll(): boolean {
    if (!this.run.spendGold(rerollPrice(this.tier))) return false;
    this.run.rerollsLeft++;
    return true;
  }
  /** Лечение: возвращает купленные HP или 0 */
  buyHeal(hp: number, maxHp: number): number {
    if (hp >= maxHp || !this.run.spendGold(healPrice(this.tier))) return 0;
    return F.shop.healHp;
  }
  restock(): boolean {
    if (!this.run.spendGold(restockPrice(this.tier, this.restocks))) return false;
    this.restocks++;
    this.stock = rollShopStock(this.rng, this.tier);
    return true;
  }
}
