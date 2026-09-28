export type PhotoLicense = "cc0" | "cc-by" | "cc-by-sa" | "public-domain";

export interface BirdPhoto {
  url: string;
  pageUrl?: string | null;
  photographer?: string | null;
  /** Full credit line, e.g. "(c) Jane Doe, some rights reserved (CC BY)". */
  attribution: string;
  license: PhotoLicense;
  source: "inaturalist" | "wikimedia";
}

export interface Bird {
  /** Stable id across data sources: the scientific name. */
  id: string;
  common: string;
  scientific: string;
  order: string;
  family: string;
  familyEnglish?: string | null;
  genus: string;
  /** AviList sequence (or checklist position): used to rank near-misses. */
  seq: number;
  photo?: BirdPhoto | null;
}

export interface BirdDataset {
  source: "checklist" | "avilist" | "supabase";
  generatedAt: string;
  birds: Bird[];
}
