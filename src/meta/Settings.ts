/** Настройки игры (GDD: доступность) — тряска, вспышки, частицы. Живут в localStorage. */
export interface Settings {
  shake: boolean;      // тряска камеры
  flash: boolean;      // вспышка экрана при уроне герою
  particles: 'full' | 'low' | 'off';
  corpses: boolean;    // тела врагов остаются и тают
  sfxVolume: number;   // 0..1
  musicVolume: number; // 0..1 — эмбиент
}

const KEY = 'arkfall.settings.v1';
export const DEFAULT_SETTINGS: Settings = { shake: true, flash: true, particles: 'full', corpses: true, sfxVolume: 0.8, musicVolume: 0.5 };
let cache: Settings | null = null;

export function loadSettings(): Settings {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULT_SETTINGS };
  } catch { cache = { ...DEFAULT_SETTINGS }; }
  return cache;
}

export function saveSettings(s: Settings): Settings {
  cache = { ...s };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* приватный режим */ }
  return cache;
}

/** Тряска камеры с учётом настройки */
export function shake(cam: Phaser.Cameras.Scene2D.Camera, ms: number, intensity: number) {
  if (loadSettings().shake) cam.shake(ms, intensity);
}
