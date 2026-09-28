import type { Bird } from "./types";

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreName(name: string, q: string): number {
  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  const words = name.split(" ");
  const qWords = q.split(" ");
  // every query word is a prefix of some name word, e.g. "red tail" → "red tailed hawk"
  if (qWords.every((qw) => words.some((w) => w.startsWith(qw)))) return 60;
  if (name.includes(q)) return 40;
  return 0;
}

/** Autocomplete: rank birds by common name, then scientific name, then genus/family. */
export function searchBirds(birds: Bird[], query: string, limit = 8, exclude: Set<string> = new Set()): Bird[] {
  const q = normalize(query);
  if (!q) return [];
  const scored: { bird: Bird; score: number }[] = [];
  for (const bird of birds) {
    if (exclude.has(bird.id)) continue;
    const score = Math.max(
      scoreName(normalize(bird.common), q),
      scoreName(normalize(bird.scientific), q) - 5,
      q.length >= 3 && normalize(bird.family).startsWith(q) ? 20 : 0,
    );
    if (score > 0) scored.push({ bird, score });
  }
  scored.sort((a, b) => b.score - a.score || a.bird.common.localeCompare(b.bird.common));
  return scored.slice(0, limit).map((s) => s.bird);
}
