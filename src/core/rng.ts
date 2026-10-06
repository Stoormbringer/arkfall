/** Детерминированный RNG (mulberry32): один сид = один забег для лидербордов */
export class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0; }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min: number, max: number): number { return min + (max - min) * this.next(); }
  pick<T extends string>(weights: Record<string, number>): T {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let r = this.next() * total;
    for (const [k, w] of Object.entries(weights)) { r -= w; if (r <= 0) return k as T; }
    return Object.keys(weights)[0] as T;
  }
}
