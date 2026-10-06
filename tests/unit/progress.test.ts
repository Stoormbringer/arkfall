import { beforeEach, describe, expect, it } from 'vitest';
import { loadProgress, recordRun, resetProgress } from '../../src/meta/Progress';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(), key: () => null, length: 0,
  } as Storage;
});

describe('прогресс аккаунта (GDD §6.6, §9)', () => {
  it('новый аккаунт: открыт только Тир 1', () => expect(loadProgress().unlockedTier).toBe(1));
  it('победа на Тире N открывает Тир N+1 и сохраняется', () => {
    recordRun(loadProgress(), 1, 30, true);
    expect(loadProgress().unlockedTier).toBe(2);
    expect(loadProgress().wins).toBe(1);
  });
  it('смерть не открывает Тир, но считает забег и лучшую комнату', () => {
    recordRun(loadProgress(), 1, 17, false);
    const p = loadProgress();
    expect(p.unlockedTier).toBe(1);
    expect(p.runs).toBe(1);
    expect(p.bestRoom).toBe(17);
  });
  it('нельзя перепрыгнуть Тир: победа на Тире 1 дважды не даёт Тир 3', () => {
    recordRun(recordRun(loadProgress(), 1, 30, true), 1, 30, true);
    expect(loadProgress().unlockedTier).toBe(2);
  });
  it('сброс возвращает к началу', () => {
    recordRun(loadProgress(), 1, 30, true);
    expect(resetProgress().unlockedTier).toBe(1);
  });
});
