import { describe, expect, it } from 'vitest';
import { COLS, LAYOUTS_ALL, pickLayout, RoomGrid, ROWS, TILE } from '../../src/run/layout';
import ROOMS from '../../src/data/rooms.json';
import { Rng } from '../../src/core/rng';

describe('формы комнат (GDD §10: 12 форм)', () => {
  it('12 форм, сетка 32×18 по 40 px покрывает арену 1280×720, стена = тайл', () => {
    expect(LAYOUTS_ALL.length).toBe(12);
    expect(COLS * TILE).toBe(ROOMS.arena.width); expect(ROWS * TILE).toBe(ROOMS.arena.height);
    expect(ROOMS.arena.wall).toBe(TILE);
    for (const l of LAYOUTS_ALL) { expect(l.map.length).toBe(ROWS); for (const row of l.map) expect(row.length).toBe(COLS); }
  });
  it('внешнее кольцо свободно (там стена арены), центр «Зала» пуст, все клетки пола достижимы из центра', () => {
    for (let i = 0; i < LAYOUTS_ALL.length; i++) {
      const g = new RoomGrid(i);
      for (let cx = 0; cx < COLS; cx++) { expect(g.cell(cx, 0), `${g.def.name} верх`).toBe('.'); expect(g.cell(cx, ROWS - 1)).toBe('.'); }
      for (let cy = 0; cy < ROWS; cy++) { expect(g.cell(0, cy)).toBe('.'); expect(g.cell(COLS - 1, cy)).toBe('.'); }
      // BFS по клеткам пола
      const seen = new Set<string>(); const q = [[1, 1]]; seen.add('1,1');
      while (q.length) {
        const [x, y] = q.shift()!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
          if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || seen.has(k) || g.cell(nx, ny) !== '.') continue;
          seen.add(k); q.push([nx, ny]);
        }
      }
      let floor = 0; for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) if (g.cell(cx, cy) === '.') floor++;
      expect(seen.size, `${g.def.name}: недостижимые клетки`).toBe(floor);
    }
    expect(new RoomGrid(0).obstacles().length).toBe(0);
  });
  it('босс и комната 1 — всегда «Зал»; остальные формы выпадают', () => {
    expect(pickLayout(new Rng(5), 10, true)).toBe(0); expect(pickLayout(new Rng(5), 1, false)).toBe(0);
    const seen = new Set<number>(); for (let s = 1; s < 200; s++) seen.add(pickLayout(new Rng(s), 2, false));
    expect(seen.size).toBe(11); expect(seen.has(0)).toBe(false);
  });
  it('ямы пропускают снаряды, колонны — нет', () => {
    const g = new RoomGrid(LAYOUTS_ALL.findIndex((l) => l.name === 'Провал'));
    const pit = g.obstacles()[0];
    expect(g.blocksWalk(pit.cx * TILE + 5, pit.cy * TILE + 5)).toBe(true);
    expect(g.blocksShot(pit.cx * TILE + 5, pit.cy * TILE + 5)).toBe(false);
  });
  it('прямая видимость: колонна режет линию, яма — нет', () => {
    const g = new RoomGrid(LAYOUTS_ALL.findIndex((l) => l.name === 'Четыре колонны'));
    const p = g.obstacles()[0]; const px = p.cx * TILE + TILE / 2, py = p.cy * TILE + TILE / 2;
    expect(g.hasLos(px - 80, py, px + 80, py)).toBe(false);
    expect(g.hasLos(px - 80, py + 120, px + 80, py + 120)).toBe(true);
    const pit = new RoomGrid(LAYOUTS_ALL.findIndex((l) => l.name === 'Провал'));
    const q = pit.obstacles()[0]; const qx = q.cx * TILE + TILE / 2, qy = q.cy * TILE + TILE / 2;
    expect(pit.hasLos(qx - 100, qy, qx + 100, qy)).toBe(true);
  });
  it('руление: курс в стену отклоняется, свободный курс не трогается, сторона обхода стабильна', () => {
    const g = new RoomGrid(LAYOUTS_ALL.findIndex((l) => l.name === 'Коридор'));
    const wallY = 6 * TILE + TILE / 2; // верхняя стена коридора y = 6
    const x = 15 * TILE, y = wallY - TILE * 1.5;
    const down = Math.PI / 2;
    const a = g.steer(x, y, down, 12, 1);
    expect(a).not.toBeCloseTo(down);
    expect(g.steer(x, y, a, 12, 1)).toBeCloseTo(a);
    expect(g.steer(x, y - TILE * 3, down, 12, 1)).toBeCloseTo(down); // далеко от стены — прямой курс
    expect(Math.sign(g.steer(x, y, down, 12, 1) - down)).toBe(1);
    expect(Math.sign(g.steer(x, y, down, 12, -1) - down)).toBe(-1);
  });
});
