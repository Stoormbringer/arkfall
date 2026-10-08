import { beforeEach, describe, expect, it } from 'vitest';
import F from '../../src/data/formulas.json';
import { buyHubItem, echoForBoss, echoForEliteRoom, echoRunTotal, hubItemPrice, hubShopFor, resetSkills, skillResetPrice } from '../../src/meta/echo';
import { chooseSkill, loadProgress, recordRun } from '../../src/meta/Progress';
import { xpToNext } from '../../src/core/formulas';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k), clear: () => store.clear(), key: () => null, length: 0,
  } as Storage;
});
const xpForLevel = (level: number) => { let x = 0; for (let l = 1; l < level; l++) x += xpToNext(l); return x + 1; };

describe('Эхо (GDD §8.1–8.3)', () => {
  it('доход: элита 5, боссы 40/50/60, ×(1+0,4(T−1)); +30 % только живым', () => {
    expect(echoForEliteRoom(1)).toBe(5);
    expect(echoForBoss(1, 1)).toBe(40); expect(echoForBoss(2, 1)).toBe(50); expect(echoForBoss(3, 1)).toBe(60);
    expect(echoForBoss(1, 10)).toBe(Math.round(40 * 4.6));
    expect(echoRunTotal(100, true)).toBe(130); expect(echoRunTotal(100, false)).toBe(100);
  });
  it('забег Тира 1 целиком даёт ~150 живым (как в таблице §8.1)', () => {
    const earned = echoForBoss(1, 1) + echoForBoss(2, 1) + echoForBoss(3, 1) + 2 * echoForEliteRoom(1);
    expect(echoRunTotal(earned, true)).toBeGreaterThan(140); expect(echoRunTotal(earned, true)).toBeLessThan(260);
  });
  it('Эхо копится в прогрессе и при смерти, и при победе', () => {
    recordRun(loadProgress(), 1, 12, false, 0, [], 45);
    recordRun(loadProgress(), 1, 30, true, 0, [], 150);
    expect(loadProgress().echo).toBe(195); expect(loadProgress().echoEarned).toBe(195);
  });
  it('лавка хаба: 3 предмета, цены по Тиру игрока, покупка списывает и кладёт в инвентарь; ассортимент стабилен внутри цикла', () => {
    let p = loadProgress();
    const s1 = hubShopFor(p);
    expect(s1.stock.length).toBe(F.echo.hubShop.itemSlots);
    expect(buyHubItem(p, 0)).toBeNull(); // нет Эхо
    p = { ...p, echo: 10_000 };
    const id = s1.stock[0]!;
    const next = buyHubItem(p, 0)!;
    expect(next.echo).toBe(10_000 - hubItemPrice(id, 1));
    expect(next.inventory).toEqual([id]);
    expect(hubShopFor(next).stock[0]).toBeNull(); // продано до смены цикла
    expect(buyHubItem(next, 0)).toBeNull();
    expect(hubItemPrice(id, 4) / hubItemPrice(id, 1)).toBeCloseTo(1 + 0.4 * 3, 1);
  });
  it('ассортимент меняется каждые N забегов', () => {
    const p = loadProgress();
    const a = hubShopFor(p).cycle;
    const later = { ...p, runs: F.echo.hubShop.rotateEveryRuns };
    expect(hubShopFor(later).cycle).toBe(a + 1);
    const sold = { ...p, hubShop: { cycle: a, stock: [null, null, null] } };
    expect(hubShopFor({ ...sold, runs: F.echo.hubShop.rotateEveryRuns }).stock.every(Boolean)).toBe(true);
  });
  it('сброс скиллов: 50 Эхо, снимает скиллы и возвращает все пройденные милстоуны', () => {
    let p = recordRun(loadProgress(), 1, 10, false, xpForLevel(21));
    expect(p.pendingMilestones).toEqual([10, 20]);
    p = chooseSkill(chooseSkill(p, 'dash_cut'), 'spark');
    expect(resetSkills(p)).toBeNull(); // 0 Эхо
    p = { ...p, echo: 60 };
    const r = resetSkills(p)!;
    expect(r.skills).toEqual([]); expect(r.pendingMilestones).toEqual([10, 20]); expect(r.echo).toBe(10);
    expect(skillResetPrice(30)).toBe(50); expect(skillResetPrice(200)).toBe(100);
    expect(resetSkills(r)).toBeNull(); // нечего сбрасывать
  });
});
