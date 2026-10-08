import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { enemyCount } from '../../src/core/formulas';
import ROOMS from '../../src/data/rooms.json';
import F from '../../src/data/formulas.json';
import { RunState } from '../../src/run/RunState';
import { goldForBoss, goldForMob, goldTierMult, itemPrice, rerollPrice, restockPrice, rollShopStock, sellPrice, Shop } from '../../src/run/shop';
import { migrateRun } from '../../src/meta/RunSave';
import { ITEMS } from '../../src/run/loot';

describe('золото (GDD §8.2)', () => {
  it('за обычного моба 1–2 × (1+0,03R) на Тире 1', () => {
    const rng = new Rng(11);
    for (let i = 0; i < 200; i++) {
      const g = goldForMob(rng, 1, 1);
      expect(g).toBeGreaterThanOrEqual(1); expect(g).toBeLessThanOrEqual(2);
    }
    expect(goldForMob(new Rng(1), 1, 30)).toBeGreaterThanOrEqual(2); // рост по комнатам заметен
  });
  it('за забег Тира 1 набирается порядка 600–900 (без элит и Сокровищниц)', () => {
    const rng = new Rng(5);
    let total = 0;
    for (let room = 1; room <= 30; room++) {
      if (room % 10 === 0) { total += goldForBoss(1); continue; }
      for (let i = 0; i < enemyCount(ROOMS.arena.baseCount, 1, room); i++) total += goldForMob(rng, 1, room);
    }
    expect(total).toBeGreaterThan(550); expect(total).toBeLessThan(1000);
  });
  it('доход и цены растут с Тиром одинаково', () => {
    expect(goldTierMult(10)).toBeCloseTo(1 + F.gold.tierStep * 9);
    expect(itemPrice('abyss_blade', 10) / itemPrice('abyss_blade', 1)).toBeCloseTo(goldTierMult(10), 1);
    expect(itemPrice('jagged_blade', 1)).toBe(F.shop.itemPrice.common);
    expect(itemPrice('abyss_blade', 1)).toBe(F.shop.itemPrice.epic);
  });
  it('кошелёк: списание только при достатке', () => {
    const r = new RunState(1, 1, []);
    r.addGold(100);
    expect(r.spendGold(150)).toBe(false); expect(r.gold).toBe(100);
    expect(r.spendGold(60)).toBe(true); expect(r.gold).toBe(40);
    expect(r.goldEarned).toBe(100);
  });
});

describe('лавка Торговца', () => {
  it('витрина: 3 разных предмета, детерминирована сидом', () => {
    const s = rollShopStock(new Rng(9), 1);
    expect(s.length).toBe(F.shop.itemSlots);
    expect(new Set(s).size).toBe(s.length);
    expect(rollShopStock(new Rng(9), 1)).toEqual(s);
  });
  it('покупка кладёт предмет в рюкзак и освобождает витрину; без золота — отказ', () => {
    const r = new RunState(1, 1, []);
    const shop = new Shop(new Rng(2), r);
    const id = shop.stock[0]!;
    expect(shop.buy(0)).toBe(false);
    r.addGold(itemPrice(id, 1));
    expect(shop.buy(0)).toBe(true);
    expect(r.gold).toBe(0); expect(r.backpack).toEqual([id]); expect(shop.stock[0]).toBeNull();
    expect(shop.buy(0)).toBe(false);
  });
  it('продажа: только из рюкзака и не надетое, за долю цены', () => {
    const r = new RunState(1, 1, [], { weapon: 'abyss_blade' });
    r.backpack.push('abyss_blade', 'wind_boots');
    const shop = new Shop(new Rng(2), r);
    expect(shop.sell('abyss_blade')).toBe(false); // надет
    expect(shop.sell('wind_boots')).toBe(true);
    expect(r.gold).toBe(sellPrice('wind_boots', 1));
    expect(sellPrice('wind_boots', 1)).toBe(Math.round(itemPrice('wind_boots', 1) * F.shop.sellRatio));
    expect(r.backpack).toEqual(['abyss_blade']);
  });
  it('реролл Руны, лечение при полном HP и обновление с растущей ценой', () => {
    const r = new RunState(1, 1, []);
    r.addGold(10_000);
    const shop = new Shop(new Rng(3), r);
    const before = r.rerollsLeft;
    expect(shop.buyReroll()).toBe(true); expect(r.rerollsLeft).toBe(before + 1); expect(r.gold).toBe(10_000 - rerollPrice(1));
    expect(shop.buyHeal(100, 100)).toBe(0);
    expect(shop.buyHeal(50, 100)).toBe(F.shop.healHp);
    const first = shop.stock;
    const g = r.gold;
    expect(shop.restock()).toBe(true);
    expect(g - r.gold).toBe(restockPrice(1, 0));
    expect(restockPrice(1, 1)).toBeGreaterThan(restockPrice(1, 0));
    expect(shop.stock.every((id) => id && ITEMS[id])).toBe(true);
    void first;
  });
  it('сохранение v1 поднимается до v2 с нулевым золотом; v2 проходит как есть; чужое — null', () => {
    const r = new RunState(1, 1, []); r.addGold(77);
    const v2 = r.toSave();
    expect(migrateRun(JSON.parse(JSON.stringify(v2)))?.gold).toBe(77);
    const { gold: _g, goldEarned: _e, ...rest } = v2; void _g; void _e;
    const v1 = { ...rest, v: 1 };
    expect(migrateRun(v1)).toMatchObject({ v: 2, gold: 0, goldEarned: 0, seed: 1 });
    expect(migrateRun({ v: 9 })).toBeNull();
    expect(migrateRun('x')).toBeNull();
  });
});
