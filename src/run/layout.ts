import LAYOUTS from '../data/layouts.json';
import type { Rng } from '../core/rng';

export type Cell = '.' | '#' | '~';
export interface LayoutDef { name: string; note: string; map: string[] }

export const TILE = LAYOUTS.tile;
export const LAYOUTS_ALL = LAYOUTS.rooms as LayoutDef[];
export const COLS = LAYOUTS_ALL[0].map[0].length;
export const ROWS = LAYOUTS_ALL[0].map.length;

/** Форма комнаты: индекс 0 — открытый «Зал» (боссы и комната 1), остальное — случайно по сиду */
export function pickLayout(rng: Rng, room: number, isBoss: boolean): number {
  if (isBoss || room === 1) return 0;
  return 1 + Math.floor(rng.next() * (LAYOUTS_ALL.length - 1));
}

/** Сетка комнаты: что блокирует ходьбу и снаряды, обход препятствий, точки появления */
export class RoomGrid {
  readonly def: LayoutDef;
  constructor(readonly index: number) { this.def = LAYOUTS_ALL[index]; }

  cell(cx: number, cy: number): Cell {
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return '#';
    return this.def.map[cy][cx] as Cell;
  }
  cellAt(x: number, y: number): Cell { return this.cell(Math.floor(x / TILE), Math.floor(y / TILE)); }
  /** мешает ходить (колонна или яма) */
  blocksWalk(x: number, y: number) { return this.cellAt(x, y) !== '.'; }
  /** мешает снаряду (только колонна) */
  blocksShot(x: number, y: number) { return this.cellAt(x, y) === '#'; }
  /** точка свободна для тела радиуса r (проверка по 5 точкам) */
  isFree(x: number, y: number, r: number) {
    return !this.blocksWalk(x, y) && !this.blocksWalk(x - r, y) && !this.blocksWalk(x + r, y) && !this.blocksWalk(x, y - r) && !this.blocksWalk(x, y + r);
  }

  /** Прямая видимость для ударов и снарядов: ни одна точка отрезка не внутри колонны (шаг 8 px) */
  hasLos(x0: number, y0: number, x1: number, y1: number): boolean {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / 8));
    for (let i = 0; i <= n; i++) { const t = i / n; if (this.blocksShot(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false; }
    return true;
  }

  /** все клетки с препятствиями — для статических тел и тайлов */
  obstacles(): { cx: number; cy: number; cell: Cell }[] {
    const out: { cx: number; cy: number; cell: Cell }[] = [];
    for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) { const c = this.cell(cx, cy); if (c !== '.') out.push({ cx, cy, cell: c }); }
    return out;
  }

  /**
   * Руление вокруг препятствий без поиска пути: если прямой курс через lookAhead упирается в стену,
   * пробуем отклонения ±45°, ±90°, ±135° (сначала в предпочтительную сторону — чтобы не дёргаться туда-сюда).
   * Возвращает угол движения.
   */
  steer(x: number, y: number, want: number, r: number, side: 1 | -1, lookAhead = TILE * 1.2): number {
    const ok = (a: number) => this.isFree(x + Math.cos(a) * lookAhead, y + Math.sin(a) * lookAhead, r * 0.8);
    if (ok(want)) return want;
    for (const d of [Math.PI / 4, Math.PI / 2, (Math.PI * 3) / 4]) {
      if (ok(want + d * side)) return want + d * side;
      if (ok(want - d * side)) return want - d * side;
    }
    return want + Math.PI * side; // тупик — назад
  }
}
