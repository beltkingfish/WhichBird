import "server-only";
import { createClient } from "@supabase/supabase-js";
import fallback from "@data/birds.json";
import { POOL_ID } from "@data/na-checklist";
import type { Bird, BirdDataset, BirdPhoto } from "./types";

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

interface CatalogRow {
  scientific_name: string;
  common_name: string;
  order_name: string;
  family_name: string;
  family_english_name: string | null;
  genus_name: string;
  avilist_sequence: number | null;
  photo_url: string | null;
  photo_page_url: string | null;
  photo_photographer: string | null;
  photo_attribution: string | null;
  photo_license: BirdPhoto["license"] | null;
  photo_source: BirdPhoto["source"] | null;
}

function rowToBird(r: CatalogRow, i: number): Bird {
  return {
    id: r.scientific_name,
    common: r.common_name,
    scientific: r.scientific_name,
    order: r.order_name,
    family: r.family_name,
    familyEnglish: r.family_english_name,
    genus: r.genus_name,
    seq: r.avilist_sequence ?? i,
    photo:
      r.photo_url && r.photo_attribution && r.photo_license && r.photo_source
        ? {
            url: r.photo_url,
            pageUrl: r.photo_page_url,
            photographer: r.photo_photographer,
            attribution: r.photo_attribution,
            license: r.photo_license,
            source: r.photo_source,
          }
        : null,
  };
}

/** The game's bird pool: Supabase when configured and seeded, else the bundled JSON. */
export async function loadBirds(pool = POOL_ID): Promise<BirdDataset> {
  const db = supabase();
  if (db) {
    const { data, error } = await db
      .from("bird_catalog")
      .select("*")
      .contains("pools", [pool])
      .order("avilist_sequence", { ascending: true });
    if (error) console.error("[whichbird] Supabase bird_catalog query failed, using bundled data:", error.message);
    else if (data?.length) {
      return { source: "supabase", generatedAt: new Date().toISOString(), birds: (data as CatalogRow[]).map(rowToBird) };
    } else console.warn("[whichbird] Supabase has no birds yet (run `npm run seed`); using bundled data");
  }
  return fallback as BirdDataset;
}

/** Puzzles pinned in `daily_puzzles` around today (covers every time zone): dateKey → bird id. */
export async function loadPinnedPuzzles(): Promise<Record<string, string>> {
  const db = supabase();
  if (!db) return {};
  const day = 86_400_000;
  const from = new Date(Date.now() - 2 * day).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 2 * day).toISOString().slice(0, 10);
  const { data, error } = await db
    .from("daily_puzzles")
    .select("puzzle_date, birds(scientific_name)")
    .gte("puzzle_date", from)
    .lte("puzzle_date", to);
  if (error) {
    console.error("[whichbird] daily_puzzles query failed:", error.message);
    return {};
  }
  const pinned: Record<string, string> = {};
  for (const row of (data ?? []) as unknown as { puzzle_date: string; birds: { scientific_name: string } | null }[]) {
    if (row.birds) pinned[row.puzzle_date] = row.birds.scientific_name;
  }
  return pinned;
}
