import { beforeEach, describe, expect, it } from 'vitest';
import { applyHeroGrowth, applyUpgrades, heroGrowth, skillModsFor, spendUpgrade, upgradePointsFree } from '../../src/meta/hero';
import { chooseSkill, loadProgress, recordRun } from '../../src/meta/Progress';
import { defaultMods } from '../../src/run/mods';
import { RunState } from '../../src/run/RunState';
import { xpToNext } from '../../src/core/formulas';
import F from '../../src/data/formulas.json';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k), clear: () => store.clear(), key: () => null, length: 0,
  } as Storage;
});
const xpForLevel = (level: number) => { let x = 0; for (let l = 1; l < level; l++) x += xpToNext(l); return x + 1; };

describe('прогрессия героя (пакет 31)', () => {
  it('закалка: уровень 1 — ничего, уровень 17 — урон +19 %, HP +19, откаты −5 %; откаты упираются в потолок', () => {
    expect(heroGrowth(1)).toEqual({ damageMult: 1, hpDelta: 0, cooldownMult: 1 });
    const g = heroGrowth(17);
    expect(g.damageMult).toBeCloseTo(1 + 16 * F.heroGrowth.damagePerLevel); expect(g.hpDelta).toBe(Math.round(16 * F.heroGrowth.hpPerLevel));
    expect(heroGrowth(300).cooldownMult).toBeCloseTo(1 - F.heroGrowth.cooldownCap);
    const m = defaultMods(); applyHeroGrowth(m, 17);
    expect(m.damageMult).toBeCloseTo(g.damageMult); expect(m.maxHpDelta).toBe(g.hpDelta);
  });
  it('забег берёт уровень в моды и сохраняет его', () => {
    const r = new RunState(1, 1, [], {}, 21, {});
    expect(r.mods.damageMult).toBeCloseTo(heroGrowth(21).damageMult);
    const b = RunState.fromSave(JSON.parse(JSON.stringify(r.toSave())));
    expect(b.level).toBe(21); expect(b.mods.damageMult).toBeCloseTo(r.mods.damageMult);
  });
  it('очки: 1 за 5 уровней; тратятся только на слоты своего скилла, не выше потолка; ранги складываются по схеме', () => {
    let p = recordRun(loadProgress(), 1, 10, false, xpForLevel(16));
    p = chooseSkill(p, 'spark');
    expect(upgradePointsFree(p)).toBe(3);
    expect(spendUpgrade(p, 'dash_cut', 'damage')).toBeNull(); // скилла нет
    expect(spendUpgrade(p, 'spark', 'charges')).toBeNull();   // у Разряда нет такого слота
    p = spendUpgrade(p, 'spark', 'damage')!; p = spendUpgrade(p, 'spark', 'damage')!; p = spendUpgrade(p, 'spark', 'projectiles')!;
    expect(upgradePointsFree(p)).toBe(0);
    expect(spendUpgrade(p, 'spark', 'cooldown')).toBeNull(); // очки кончились
    const sm = skillModsFor(p.upgrades!, 'spark');
    expect(sm.damage).toBeCloseTo(1 + F.upgradeSlots.damage[0] + F.upgradeSlots.damage[1]);
    expect(sm.projectiles).toBe(1);
    const m = defaultMods(); applyUpgrades(m, p.upgrades!);
    expect(m.skill.spark.damage).toBeCloseTo(sm.damage);
    // потолок рангов
    let q = { ...p, xp: xpForLevel(100) };
    for (let i = 0; i < 10; i++) { const n = spendUpgrade(q, 'spark', 'damage'); if (!n) break; q = n; }
    expect(q.upgrades!.spark.damage).toBe(F.upgradeSlots.damage.length);
  });
});
