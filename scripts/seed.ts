/**
 * Seed WhichBird from AviList + iNaturalist/Wikimedia.
 *
 *   npm run seed -- --avilist data/raw/AviList-v2025.xlsx [options]
 *
 * Options
 *   --avilist <file>   AviList download (.xlsx or .csv). Required.
 *   --json             Also write data/birds.json (the app's offline fallback).
 *   --no-db            Skip Supabase (handy with --json for a local-only refresh).
 *   --no-photos        Skip photo lookups.
 *   --refresh-photos   Ignore the photo cache in .seed-cache/photos.json.
 *   --allow-sa         Accept CC BY-SA images from the Wikimedia fallback.
 *   --strict           Drop checklist species that AviList doesn't recognise
 *                      (default: keep them with checklist taxonomy and warn).
 *   --pool <id>        Pool tag written to birds.pools (default: na-common).
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_CONTACT.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { POOL_ID } from "../data/na-checklist";
import type { Bird, BirdDataset, BirdPhoto } from "../src/lib/types";
import { readAviList } from "./lib/avilist";
import { birdFromAviList, birdFromChecklist, checklistEntries } from "./lib/dataset";
import { matchChecklist } from "./lib/match";
import { findINatPhoto, findWikimediaPhoto, politeFetcher } from "./lib/photos";

const ROOT = path.join(__dirname, "..");
const CACHE_DIR = path.join(ROOT, ".seed-cache");
const PHOTO_CACHE = path.join(CACHE_DIR, "photos.json");

loadDotEnv();

const { values: args } = parseArgs({
  options: {
    avilist: { type: "string" },
    json: { type: "boolean", default: false },
    "no-db": { type: "boolean", default: false },
    "no-photos": { type: "boolean", default: false },
    "refresh-photos": { type: "boolean", default: false },
    "allow-sa": { type: "boolean", default: false },
    strict: { type: "boolean", default: false },
    pool: { type: "string", default: POOL_ID },
  },
});

async function main() {
  if (!args.avilist) fail("Pass the AviList spreadsheet: npm run seed -- --avilist path/to/AviList.xlsx");

  // 1. Taxonomy from AviList, restricted to the curated pool.
  console.log(`Reading ${args.avilist} …`);
  const avilist = await readAviList(args.avilist!);
  console.log(`  ${avilist.length} species in AviList`);

  const entries = checklistEntries();
  const { matched, unmatched } = matchChecklist(entries, avilist);
  const renamed = matched.filter((m) => m.via === "english" || m.species.english !== m.entry.english);
  for (const m of renamed) {
    console.log(`  ↪ ${m.entry.english} (${m.entry.scientific}) → ${m.species.english} (${m.species.scientific})`);
  }
  const birds: Bird[] = matched.map((m) => birdFromAviList(m.species));
  if (unmatched.length) {
    console.warn(`  ⚠ ${unmatched.length} checklist species not found in AviList:`);
    for (const u of unmatched) console.warn(`     - ${u.english} (${u.scientific})`);
    if (!args.strict) {
      // Keep them with the checklist's taxonomy, slotted after the nearest matched family member.
      for (const u of unmatched) {
        const kin = birds.filter((b) => b.family === u.family).map((b) => b.seq);
        const seq = kin.length ? Math.max(...kin) + 0.5 : 1e6;
        birds.push(birdFromChecklist(u.english, u.scientific, u.family, seq));
      }
      console.warn("     kept with checklist taxonomy (use --strict to drop them)");
    }
  }
  birds.sort((a, b) => a.seq - b.seq);
  console.log(`  ${birds.length} birds in pool '${args.pool}'`);

  // 2. Photos: iNaturalist (CC0 / CC BY) first, Wikimedia Commons fallback.
  if (!args["no-photos"]) await attachPhotos(birds);

  // 3. Write.
  if (args.json) {
    const dataset: BirdDataset = { source: "avilist", generatedAt: new Date().toISOString(), birds };
    writeFileSync(path.join(ROOT, "data", "birds.json"), JSON.stringify(dataset, null, 1) + "\n");
    console.log("Wrote data/birds.json");
  }
  if (!args["no-db"]) await writeSupabase(birds, args.pool!);
  console.log("Done. Happy birding!");
}

async function attachPhotos(birds: Bird[]) {
  const contact = process.env.SEED_CONTACT;
  if (!contact) console.warn("  ⚠ Set SEED_CONTACT so iNaturalist/Wikimedia know who to contact about this User-Agent");
  const get = politeFetcher(`WhichBird/0.1 (+https://whichbird.app; bird-guessing game seed script; ${contact ?? "no contact given"})`);
  const cache: Record<string, BirdPhoto | null> =
    !args["refresh-photos"] && existsSync(PHOTO_CACHE) ? JSON.parse(readFileSync(PHOTO_CACHE, "utf8")) : {};
  const saveCache = () => {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(PHOTO_CACHE, JSON.stringify(cache, null, 1));
  };

  let fetched = 0;
  for (const [i, bird] of birds.entries()) {
    if (bird.scientific in cache) {
      bird.photo = cache[bird.scientific];
      continue;
    }
    let photo: BirdPhoto | null = null;
    try {
      photo = await findINatPhoto(bird.scientific, get);
    } catch (e) {
      console.warn(`  iNaturalist lookup failed for ${bird.scientific}: ${(e as Error).message}`);
    }
    if (!photo) {
      try {
        photo = await findWikimediaPhoto(bird.scientific, get, args["allow-sa"]);
      } catch (e) {
        console.warn(`  Wikimedia lookup failed for ${bird.scientific}: ${(e as Error).message}`);
      }
    }
    cache[bird.scientific] = photo;
    bird.photo = photo;
    fetched++;
    console.log(`  [${i + 1}/${birds.length}] ${bird.common}: ${photo ? `${photo.source} (${photo.license})` : "no usable photo"}`);
    if (fetched % 10 === 0) saveCache();
  }
  saveCache();
  const missing = birds.filter((b) => !b.photo);
  if (missing.length) console.warn(`  ⚠ ${missing.length} birds have no photo: ${missing.map((b) => b.common).join(", ")}`);
}

async function writeSupabase(birds: Bird[], pool: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (or pass --no-db)");
  const db = createClient(url!, key!, { auth: { persistSession: false } });

  console.log("Writing taxonomy …");
  const orderIds = await upsertTaxa(db, "order", unique(birds.map((b) => ({ name: b.order, parent: null, english: null }))));
  const familyIds = await upsertTaxa(
    db,
    "family",
    unique(birds.map((b) => ({ name: b.family, parent: orderIds.get(b.order)!, english: b.familyEnglish ?? null }))),
  );
  const genusIds = await upsertTaxa(db, "genus", unique(birds.map((b) => ({ name: b.genus, parent: familyIds.get(b.family)!, english: null }))));

  console.log("Writing birds …");
  const { data: existing, error: exErr } = await db.from("birds").select("scientific_name, pools").in(
    "scientific_name",
    birds.map((b) => b.scientific),
  );
  check(exErr);
  const existingPools = new Map((existing ?? []).map((r) => [r.scientific_name as string, (r.pools as string[]) ?? []]));
  const { data: rows, error } = await db
    .from("birds")
    .upsert(
      birds.map((b) => ({
        scientific_name: b.scientific,
        common_name: b.common,
        genus_id: genusIds.get(b.genus)!,
        avilist_sequence: Math.round(b.seq),
        pools: [...new Set([...(existingPools.get(b.scientific) ?? []), pool])],
      })),
      { onConflict: "scientific_name" },
    )
    .select("id, scientific_name");
  check(error);
  const birdIds = new Map((rows ?? []).map((r) => [r.scientific_name as string, r.id as number]));

  const withPhotos = birds.filter((b) => b.photo);
  if (withPhotos.length) {
    console.log("Writing photo attribution …");
    const ids = withPhotos.map((b) => birdIds.get(b.scientific)!);
    check((await db.from("bird_photos").delete().in("bird_id", ids).eq("is_primary", true)).error);
    check(
      (
        await db.from("bird_photos").insert(
          withPhotos.map((b) => ({
            bird_id: birdIds.get(b.scientific)!,
            source: b.photo!.source,
            url: b.photo!.url,
            page_url: b.photo!.pageUrl,
            photographer: b.photo!.photographer,
            attribution: b.photo!.attribution,
            license: b.photo!.license,
            is_primary: true,
          })),
        )
      ).error,
    );
  }
  console.log(`  ${birdIds.size} birds, ${withPhotos.length} photos written`);
}

async function upsertTaxa(
  db: SupabaseClient,
  rank: "order" | "family" | "genus",
  items: { name: string; parent: number | null; english: string | null }[],
): Promise<Map<string, number>> {
  const { data, error } = await db
    .from("taxa")
    .upsert(
      items.map((t) => ({ rank, name: t.name, parent_id: t.parent, ...(t.english ? { english_name: t.english } : {}) })),
      { onConflict: "rank,name" },
    )
    .select("id, name");
  check(error);
  return new Map((data ?? []).map((r) => [r.name as string, r.id as number]));
}

function unique<T extends { name: string }>(items: T[]): T[] {
  return [...new Map(items.map((i) => [i.name, i])).values()];
}

function check(error: { message: string } | null) {
  if (error) fail(`Supabase error: ${error.message}`);
}

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

/** Minimal .env / .env.local loader so the script works without extra deps. */
function loadDotEnv() {
  for (const file of [".env.local", ".env"]) {
    const p = path.join(ROOT, file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

main().catch((e) => fail(e instanceof Error ? e.stack ?? e.message : String(e)));
