import type { Bird } from "./types";

/** Puzzle #1. Changing this renumbers every puzzle, so don't. */
export const LAUNCH_DATE = "2026-09-28";

/** YYYY-MM-DD in the player's local time zone: everyone gets a new bird at their midnight. */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayIndex(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function puzzleNumber(dateKey: string): number {
  return dayIndex(dateKey) - dayIndex(LAUNCH_DATE) + 1;
}

/** FNV-1a string hash → 32-bit seed. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Small, fast, deterministic PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The bird for a given date. Birds are dealt from a seeded shuffle of the pool,
 * so no species repeats until the whole pool has been used; each pass through
 * the pool gets a fresh shuffle. A row in `daily_puzzles` (passed as
 * `pinnedId`) overrides the computed pick.
 */
export function dailyBird(birds: Bird[], dateKey: string, pinnedId?: string | null): { bird: Bird; number: number } {
  if (birds.length === 0) throw new Error("Bird pool is empty");
  const number = puzzleNumber(dateKey);
  const pinned = pinnedId ? birds.find((b) => b.id === pinnedId) : undefined;
  if (pinned) return { bird: pinned, number };

  const pool = [...birds].sort((a, b) => a.id.localeCompare(b.id));
  const n = pool.length;
  const k = number - 1;
  const cycle = Math.floor(k / n);
  const slot = ((k % n) + n) % n;
  const deck = seededShuffle(pool, hashString(`lifer:${cycle}`));
  return { bird: deck[slot], number };
}

export function randomBird(birds: Bird[], excludeId?: string): Bird {
  const choices = birds.length > 1 ? birds.filter((b) => b.id !== excludeId) : birds;
  return choices[Math.floor(Math.random() * choices.length)];
}
