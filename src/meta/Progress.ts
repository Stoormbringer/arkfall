/** Постоянный прогресс аккаунта (GDD §9): пока только в браузере. */
export interface Progress {
  unlockedTier: number;   // максимальный доступный Тир
  runs: number;
  wins: number;
  bestRoom: number;
  bestTierCleared: number;
}

const KEY = 'arkfall.progress.v1';
const DEFAULT: Progress = { unlockedTier: 1, runs: 0, wins: 0, bestRoom: 0, bestTierCleared: 0 };

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT, ...(JSON.parse(raw) as Partial<Progress>) } : { ...DEFAULT };
  } catch { return { ...DEFAULT }; }
}

export function saveProgress(p: Progress) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* приватный режим и т.п. — прогресс живёт в памяти сессии */ }
}

/** Завершение забега: победа открывает следующий Тир (GDD §6.6 — мастерством, не уровнем) */
export function recordRun(p: Progress, tier: number, room: number, won: boolean): Progress {
  const next: Progress = { ...p, runs: p.runs + 1, bestRoom: Math.max(p.bestRoom, room) };
  if (won) {
    next.wins++;
    next.bestTierCleared = Math.max(next.bestTierCleared, tier);
    next.unlockedTier = Math.max(next.unlockedTier, tier + 1);
  }
  saveProgress(next);
  return next;
}

export function resetProgress(): Progress { saveProgress({ ...DEFAULT }); return { ...DEFAULT }; }
