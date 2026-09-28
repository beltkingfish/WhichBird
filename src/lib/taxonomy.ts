import type { Bird } from "./types";

/** How deep a guess's lineage matches the target's. */
export type MatchLevel = 0 | 1 | 2 | 3 | 4;

export const RANKS = ["order", "family", "genus", "species"] as const;
export type Rank = (typeof RANKS)[number];

export interface LevelInfo {
  level: MatchLevel;
  label: string;
  /** Deepest shared rank, or null when only Aves is shared. */
  rank: Rank | null;
  emoji: string;
  /** CSS color token used by the table, tree and legend. */
  color: string;
}

export const LEVELS: Record<MatchLevel, LevelInfo> = {
  0: { level: 0, label: "Different order", rank: null, emoji: "⬜", color: "var(--lvl-0)" },
  1: { level: 1, label: "Same order", rank: "order", emoji: "🟥", color: "var(--lvl-1)" },
  2: { level: 2, label: "Same family", rank: "family", emoji: "🟧", color: "var(--lvl-2)" },
  3: { level: 3, label: "Same genus", rank: "genus", emoji: "🟨", color: "var(--lvl-3)" },
  4: { level: 4, label: "Lifer!", rank: "species", emoji: "🐦", color: "var(--lvl-4)" },
};

export function lineage(bird: Bird): Record<Rank, string> {
  return { order: bird.order, family: bird.family, genus: bird.genus, species: bird.scientific };
}

/** Deepest rank at which the guess and target share a taxon (0 = only class Aves). */
export function compareLineage(guess: Bird, target: Bird): MatchLevel {
  const g = lineage(guess);
  const t = lineage(target);
  let level: MatchLevel = 0;
  for (const [i, rank] of RANKS.entries()) {
    if (g[rank] !== t[rank]) break;
    level = (i + 1) as MatchLevel;
  }
  return level;
}

export interface ScoredGuess {
  bird: Bird;
  level: MatchLevel;
  /** Distance in the taxonomic sequence; a finer "warmer/colder" signal within a level. */
  distance: number;
  /** 1-based position in the order the player guessed. */
  index: number;
}

export function scoreGuesses(guesses: Bird[], target: Bird): ScoredGuess[] {
  return guesses.map((bird, i) => ({
    bird,
    level: compareLineage(bird, target),
    distance: Math.abs(bird.seq - target.seq),
    index: i + 1,
  }));
}

/** Closest first, like Globle: by match level, then taxonomic-sequence distance. */
export function sortByCloseness(scored: ScoredGuess[]): ScoredGuess[] {
  return [...scored].sort((a, b) => b.level - a.level || a.distance - b.distance || b.index - a.index);
}

export function bestLevel(scored: ScoredGuess[]): MatchLevel {
  return scored.reduce<MatchLevel>((m, s) => (s.level > m ? s.level : m), 0);
}
