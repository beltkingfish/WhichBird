import type { AviListSpecies } from "./avilist";

const key = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

export interface MatchResult<T> {
  matched: { entry: T; species: AviListSpecies; via: "scientific" | "english" }[];
  unmatched: T[];
}

/**
 * Match curated checklist entries to AviList species: by scientific name first,
 * then by English name (catches genus moves such as Accipiter → Astur).
 */
export function matchChecklist<T extends { english: string; scientific: string }>(
  entries: T[],
  avilist: AviListSpecies[],
): MatchResult<T> {
  const bySci = new Map(avilist.map((s) => [key(s.scientific), s]));
  const byEng = new Map(avilist.filter((s) => s.english).map((s) => [key(s.english), s]));
  const result: MatchResult<T> = { matched: [], unmatched: [] };
  const seen = new Set<string>();
  for (const entry of entries) {
    let species = bySci.get(key(entry.scientific));
    let via: "scientific" | "english" = "scientific";
    if (!species) {
      species = byEng.get(key(entry.english));
      via = "english";
    }
    if (!species || seen.has(species.scientific)) {
      result.unmatched.push(entry);
      continue;
    }
    seen.add(species.scientific);
    result.matched.push({ entry, species, via });
  }
  return result;
}
