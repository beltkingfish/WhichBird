"use client";

/** Browser persistence. Every access is guarded: storage can be missing or throw (private mode). */

export interface DailyState {
  dateKey: string;
  targetId: string;
  guessIds: string[];
  won: boolean;
  photoHintUsed: boolean;
}

export interface PracticeState {
  targetId: string;
  guessIds: string[];
  won: boolean;
  photoHintUsed: boolean;
}

export interface Stats {
  played: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  lastWinDate: string | null;
  /** guesses-to-win → count; key "10+" for 10 or more */
  histogram: Record<string, number>;
}

export const EMPTY_STATS: Stats = { played: 0, wins: 0, currentStreak: 0, maxStreak: 0, lastWinDate: null, histogram: {} };

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the game still works, it just won't remember */
  }
}

export const loadDaily = (dateKey: string) => read<DailyState>(`whichbird:daily:${dateKey}`);
export const saveDaily = (s: DailyState) => write(`whichbird:daily:${s.dateKey}`, s);
export const loadPractice = () => read<PracticeState>("whichbird:practice");
export const savePractice = (s: PracticeState) => write("whichbird:practice", s);
export const loadStats = () => ({ ...EMPTY_STATS, ...(read<Stats>("whichbird:stats") ?? {}) });
export const loadPhotoPref = () => read<boolean>("whichbird:photo-hint") ?? false;
export const savePhotoPref = (on: boolean) => write("whichbird:photo-hint", on);

function previousDay(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return dt.toISOString().slice(0, 10);
}

/** Record a daily win once; returns the updated stats. */
export function recordDailyWin(dateKey: string, guessCount: number): Stats {
  const stats = loadStats();
  if (stats.lastWinDate === dateKey) return stats;
  const streak = stats.lastWinDate === previousDay(dateKey) ? stats.currentStreak + 1 : 1;
  const bucket = guessCount >= 10 ? "10+" : String(guessCount);
  const next: Stats = {
    played: stats.played + 1,
    wins: stats.wins + 1,
    currentStreak: streak,
    maxStreak: Math.max(stats.maxStreak, streak),
    lastWinDate: dateKey,
    histogram: { ...stats.histogram, [bucket]: (stats.histogram[bucket] ?? 0) + 1 },
  };
  write("whichbird:stats", next);
  return next;
}
