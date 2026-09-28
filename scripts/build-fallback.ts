/**
 * Writes data/birds.json straight from the curated checklist (no network, no
 * AviList file). The app uses this file whenever Supabase isn't configured.
 * `npm run seed -- --json` overwrites it with AviList taxonomy + photos.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { birdFromChecklist, checklistEntries } from "./lib/dataset";
import type { BirdDataset } from "../src/lib/types";

const birds = checklistEntries().map((e, i) => birdFromChecklist(e.english, e.scientific, e.family, (i + 1) * 10));
const ids = new Set<string>();
for (const b of birds) {
  if (ids.has(b.id)) throw new Error(`Duplicate species ${b.id}`);
  ids.add(b.id);
}
const dataset: BirdDataset = { source: "checklist", generatedAt: new Date().toISOString(), birds };
const out = path.join(__dirname, "..", "data", "birds.json");
writeFileSync(out, JSON.stringify(dataset, null, 1) + "\n");
console.log(`Wrote ${birds.length} birds to ${path.relative(process.cwd(), out)}`);
