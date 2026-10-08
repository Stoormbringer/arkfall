import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { offerDoors } from '../../src/run/doors';

describe('двери с превью награды (GDD §2 шаг 3)', () => {
  it('перед боссом — одна дверь «Логово»', () => {
    expect(offerDoors(new Rng(1), { nextRoomIsBoss: true, hp01: 1, rank: 3 })).toEqual(['boss']);
  });
  it('2 или 3 двери, без повторов', () => {
    for (let seed = 1; seed < 300; seed++) {
      const d = offerDoors(new Rng(seed), { nextRoomIsBoss: false, hp01: 0.7, rank: 2 });
      expect(d.length).toBeGreaterThanOrEqual(2);
      expect(d.length).toBeLessThanOrEqual(3);
      expect(new Set(d).size).toBe(d.length);
      expect(d).not.toContain('boss');
    }
  });
  it('элитная комната не предлагается до Ранга 1', () => {
    for (let seed = 1; seed < 200; seed++) expect(offerDoors(new Rng(seed), { nextRoomIsBoss: false, hp01: 0.7, rank: 0 })).not.toContain('elite');
  });
  it('Торговец не раньше комнаты shop.fromRoom и встречается позже', () => {
    for (let seed = 1; seed < 200; seed++) expect(offerDoors(new Rng(seed), { nextRoomIsBoss: false, hp01: 0.7, rank: 2, nextRoom: 1 })).not.toContain('shop');
    let n = 0;
    for (let seed = 1; seed < 300; seed++) if (offerDoors(new Rng(seed), { nextRoomIsBoss: false, hp01: 0.7, rank: 2, nextRoom: 5 }).includes('shop')) n++;
    expect(n).toBeGreaterThan(40);
  });
  it('при низком HP лечение встречается заметно чаще', () => {
    const count = (hp: number) => { let n = 0; for (let s = 1; s < 500; s++) if (offerDoors(new Rng(s), { nextRoomIsBoss: false, hp01: hp, rank: 2 }).includes('heal')) n++; return n; };
    expect(count(0.2)).toBeGreaterThan(count(0.95) * 2);
  });
});
