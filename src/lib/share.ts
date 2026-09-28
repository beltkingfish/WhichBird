import { LEVELS, type MatchLevel } from "./taxonomy";

export interface ShareInput {
  mode: "daily" | "practice";
  puzzleNumber?: number;
  levels: MatchLevel[];
  photoHintUsed: boolean;
  url?: string;
}

/**
 * Wordle-style result to paste anywhere: one square per guess, in guess order,
 * wrapped at 10 per row, then a link back to the game.
 *   ⬜ different order · 🟨 same order · 🟧 same family · 🟥 same genus · 🟩 found it
 */
export function buildShareText({ mode, puzzleNumber, levels, photoHintUsed, url }: ShareInput): string {
  const title = mode === "daily" ? `🐦 Lifer #${puzzleNumber}` : "🐦 Lifer (practice)";
  const n = levels.length;
  const headline = `${title} · ${n} ${n === 1 ? "guess" : "guesses"}${photoHintUsed ? " 📷" : ""}`;
  const rows: string[] = [];
  for (let i = 0; i < n; i += 10) {
    rows.push(levels.slice(i, i + 10).map((l) => LEVELS[l].emoji).join(""));
  }
  return [headline, ...rows, url].filter(Boolean).join("\n");
}
