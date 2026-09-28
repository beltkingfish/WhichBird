import { CHECKLIST, FAMILIES } from "../../data/na-checklist";
import type { Bird } from "../../src/lib/types";
import type { AviListSpecies } from "./avilist";

export const checklistEntries = () => CHECKLIST.map(([english, scientific, family]) => ({ english, scientific, family }));

/** A bird built only from the curated checklist (no AviList lookup). */
export function birdFromChecklist(english: string, scientific: string, family: string, seq: number): Bird {
  const fam = FAMILIES[family];
  if (!fam) throw new Error(`Unknown family '${family}' for ${scientific}; add it to FAMILIES`);
  return {
    id: scientific,
    common: english,
    scientific,
    order: fam.order,
    family,
    familyEnglish: fam.english,
    genus: scientific.split(" ")[0],
    seq,
    photo: null,
  };
}

export function birdFromAviList(s: AviListSpecies): Bird {
  return {
    id: s.scientific,
    common: s.english,
    scientific: s.scientific,
    order: s.order,
    family: s.family,
    familyEnglish: s.familyEnglish ?? FAMILIES[s.family]?.english ?? null,
    genus: s.genus,
    seq: s.sequence,
    photo: null,
  };
}
