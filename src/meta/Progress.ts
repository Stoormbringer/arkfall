import { levelFromXp, milestonesCrossed } from './Level';

/** Постоянный прогресс аккаунта (GDD §9): пока только в браузере. */
export interface Progress {
  unlockedTier: number;   // максимальный доступный Тир
  runs: number;
  wins: number;
  bestRoom: number;
  bestTierCleared: number;
  xp: number;                 // накопленный опыт персонажа
  skills: string[];           // выбранные Основные скиллы
  pendingMilestones: number[]; // уровни, на которых выбор скилла ещё не сделан
  echo: number;               // Эхо — постоянная валюта (GDD §8.1)
  echoEarned: number;         // всего заработано (аналитика)
  hubShop?: { cycle: number; stock: (string | null)[] }; // ассортимент Лавки Ковчега
  inventory: string[];        // id предметов (могут повторяться)
  equipped: Partial<Record<'weapon' | 'armor' | 'accessory' | 'artifact', string>>;
}

const KEY = 'arkfall.progress.v1';
const DEFAULT: Progress = { unlockedTier: 1, runs: 0, wins: 0, bestRoom: 0, bestTierCleared: 0, xp: 0, echo: 0, echoEarned: 0, skills: [], pendingMilestones: [], inventory: [], equipped: {} };

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
export function recordRun(p: Progress, tier: number, room: number, won: boolean, runXp = 0, loot: string[] = [], echo = 0): Progress {
  const gained = Math.round(won ? runXp * 1.3 : runXp); // GDD §5.5: бонус завершения +30 % только живым
  const before = levelFromXp(p.xp).level;
  const xp = p.xp + gained;
  const after = levelFromXp(xp).level;
  const next: Progress = { ...p, runs: p.runs + 1, bestRoom: Math.max(p.bestRoom, room), xp,
    pendingMilestones: [...p.pendingMilestones, ...milestonesCrossed(before, after)],
    inventory: [...p.inventory, ...loot], echo: p.echo + echo, echoEarned: p.echoEarned + echo };
  if (won) {
    next.wins++;
    next.bestTierCleared = Math.max(next.bestTierCleared, tier);
    next.unlockedTier = Math.max(next.unlockedTier, tier + 1);
  }
  saveProgress(next);
  return next;
}

export function chooseSkill(p: Progress, id: string): Progress {
  const next: Progress = { ...p, skills: [...p.skills, id], pendingMilestones: p.pendingMilestones.slice(1) };
  saveProgress(next);
  return next;
}

export function equipItem(p: Progress, slot: keyof Progress['equipped'], id: string | null): Progress {
  const equipped = { ...p.equipped };
  if (id === null) delete equipped[slot]; else equipped[slot] = id;
  const next = { ...p, equipped };
  saveProgress(next);
  return next;
}

export function resetProgress(): Progress { saveProgress({ ...DEFAULT }); return { ...DEFAULT }; }
