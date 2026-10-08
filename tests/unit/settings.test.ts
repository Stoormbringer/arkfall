import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, shake } from '../../src/meta/Settings';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k), clear: () => store.clear(), key: () => null, length: 0,
  } as Storage;
  saveSettings({ ...DEFAULT_SETTINGS });
});

describe('настройки игры', () => {
  it('по умолчанию всё включено; сохранение переживает перезагрузку', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    saveSettings({ ...DEFAULT_SETTINGS, shake: false, particles: 'low' });
    expect(JSON.parse(store.get('arkfall.settings.v1')!).shake).toBe(false);
    expect(loadSettings().particles).toBe('low');
  });
  it('тряска камеры уважает настройку', () => {
    let calls = 0;
    const cam = { shake: () => { calls++; } } as unknown as Phaser.Cameras.Scene2D.Camera;
    shake(cam, 100, 0.01); expect(calls).toBe(1);
    saveSettings({ ...DEFAULT_SETTINGS, shake: false });
    shake(cam, 100, 0.01); expect(calls).toBe(1);
  });
});
