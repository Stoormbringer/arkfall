import type { RunSave } from '../run/RunState';

const KEY = 'arkfall.run.v1';

/** Старые сохранения поднимаются до текущей версии; незнакомые — отбрасываются */
export function migrateRun(raw: unknown): RunSave | null {
  const s = raw as { v?: number } & Partial<Omit<RunSave, 'v'>>;
  if (!s || typeof s !== 'object') return null;
  if (s.v === 1) return { ...(s as unknown as RunSave), v: 2, gold: 0, goldEarned: 0, echo: 0 };
  return s.v === 2 ? { ...(s as RunSave), echo: s.echo ?? 0, level: s.level ?? 1, upgrades: s.upgrades ?? {} } : null;
}

export function loadRun(): RunSave | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? migrateRun(JSON.parse(raw)) : null;
  } catch { return null; }
}
export function saveRun(s: RunSave) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* best effort */ } }
export function clearRun() { try { localStorage.removeItem(KEY); } catch { /* best effort */ } }
