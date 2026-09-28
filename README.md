# Lifer 🐦

A daily bird-guessing game played on the tree of life. It borrows Metazooa's taxonomy
guessing and Globle's warmer/colder colors. *Lifer* is birders' slang for a species you
see for the first time; here, the day's mystery bird is your lifer.

- **One bird a day**, the same for everyone. It is picked deterministically from the date.
- **Guess any species.** Each guess is compared with the target's lineage:
  **Order › Family › Genus › Species**. The deepest shared rank decides the color:

  | Color | Meaning |
  | --- | --- |
  | ⬜ gray | different order (only *Aves* in common) |
  | 🟥 red | same order |
  | 🟧 orange | same family |
  | 🟨 yellow | same genus |
  | 🐦 gold | the species itself: a lifer! |

- **Unlimited guesses.** Within one color, guesses closer in the AviList taxonomic
  sequence sort higher, so there's still a hot/cold signal.
- **Live taxonomy tree.** Every guess's lineage is drawn as a tree. Branches shared with
  the mystery bird light up in the match colors, and a dashed **?** hangs from the deepest
  known point of the target's lineage.
- **Photo hint (optional).** A blurred, desaturated photo of the target sharpens with each
  wrong guess. Using it adds 📷 to your share text.
- **Share grid** in Wordle style on a win, plus streaks and average guesses.
- **Practice mode** at `/practice`: random birds, unlimited rounds, no effect on your streak.
- **Optional accounts**: a Supabase magic-link sign-in saves results to `player_results`.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + [daisyUI 5](https://daisyui.com) (custom `lifer` / `lifer-dusk` themes in `src/app/globals.css`) |
| Tree | [react-d3-tree](https://github.com/bkrem/react-d3-tree), horizontal layout (see [Tree visualization](#tree-visualization)) |
| Data | Supabase Postgres (optional: the app falls back to bundled `data/birds.json`) |
| Taxonomy | [AviList](https://www.avilist.org/) global checklist, CC BY 4.0 |
| Photos | iNaturalist API (CC0 / CC BY only), Wikimedia Commons fallback |
| Hosting | Railway (`railway.json`) |

## Project layout

```
data/
  na-checklist.ts     curated pool: ~280 common North American species (which birds are in the game)
  birds.json          bundled dataset the app uses when Supabase isn't configured
scripts/
  seed.ts             AviList → taxonomy, iNaturalist/Wikimedia → photos, → Supabase (+ birds.json)
  build-fallback.ts   regenerate birds.json from the checklist alone (offline)
  lib/                AviList parser, checklist matcher, photo lookups (+ tests)
supabase/migrations/  SQL schema
src/lib/              game logic: lineage comparison, daily selection, search, share text, tree data
src/components/       Game, GuessInput (autocomplete), GuessTable, TaxonomyTree, PhotoHint, WinPanel
```

## Quick start (no database)

```bash
npm install
npm run dev          # http://localhost:3000
```

This runs the full game on `data/birds.json`: 277 species with checklist taxonomy and no
photos. Run the seed script (below) to switch to AviList taxonomy and add photos.

```bash
npm test             # vitest: lineage scoring, daily selection, search, share text, tree, AviList parsing
npm run typecheck
```

## Setting up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema. Either paste `supabase/migrations/20260928000000_init.sql` into the
   SQL editor, or with the Supabase CLI:
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```
3. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API)
   - `SUPABASE_SERVICE_ROLE_KEY`: used **only** by the seed script. Never deploy it to the app.
   - `SEED_CONTACT`: an email or URL for the User-Agent sent to iNaturalist and Wikimedia.
4. Optional, for accounts: under Authentication → URL Configuration, add your local and
   Railway URLs to the redirect allow-list so magic links land back in the game.

### Schema

| Table | Purpose |
| --- | --- |
| `taxa` | Order / family / genus as an adjacency list (`rank`, `name`, `parent_id`, family English names) |
| `birds` | Species: scientific + common name, `genus_id`, AviList sequence, Avibase/eBird ids, `pools text[]` |
| `bird_photos` | Photo URL, observation/file page, photographer, full attribution string, normalized license, source |
| `daily_puzzles` | Optional pinned puzzles (`puzzle_date` → `bird_id`); these override the computed pick |
| `player_results` | Per-user results (RLS: owner only) |
| `bird_catalog` (view) | Flattened lineage + primary photo; this is what the app reads |

Game data is readable by everyone and writable only with the service role. Rows in
`daily_puzzles` become readable at `puzzle_date - 1 day`, so future answers stay hidden.

**Scaling past North America:** the pool is a tag, not a table. Add species (for example
the full AviList) with another tag in `birds.pools` and nothing in the schema changes.
`loadBirds(pool)` in `src/lib/birds.ts` picks the pool.

## Seeding from AviList

1. Download the AviList checklist (XLSX, the extended version is fine) from
   <https://www.avilist.org/checklist/> and save it as, for example,
   `data/raw/AviList-v2025.xlsx` (`data/raw/` is git-ignored).
2. Run:
   ```bash
   npm run seed -- --avilist data/raw/AviList-v2025.xlsx --json
   ```

What the script does:

- **Parses AviList** (`.xlsx` or `.csv`). It finds the header row by `Scientific_name`,
  keeps `Taxon_rank = species` rows, reads Order/Family/Genus, the AviList English name,
  the sequence number, and the Avibase and eBird codes. It handles rich-text (italic)
  cells and ALL-CAPS order names.
- **Filters to the curated pool** in `data/na-checklist.ts`. Species are matched by
  scientific name, then by English name to catch genus moves such as *Accipiter* →
  *Astur*. Renames are printed. Species AviList doesn't recognize are kept with the
  checklist's taxonomy and a warning, unless you pass `--strict`.
- **Finds a photo per species:**
  1. iNaturalist: `GET /v1/taxa?q=<name>&rank=species` gives the taxon id, then
     `GET /v1/observations?taxon_id=…&photo_license=cc0,cc-by&quality_grade=research&order_by=votes`
     returns candidates. It takes the first CC0 or CC BY photo at medium size, with its
     attribution, the photographer and the observation URL.
  2. Wikimedia fallback: the Wikipedia REST summary for the scientific name gives the
     lead image, and the Commons `imageinfo`/`extmetadata` call gives the license and
     artist. It accepts CC0, public domain and CC BY by default; `--allow-sa` also
     accepts CC BY-SA.

  Requests carry a descriptive `User-Agent` and are throttled to about 55 per minute.
  Results are cached in `.seed-cache/photos.json`, so re-runs are fast. `--refresh-photos`
  ignores the cache.
- **Upserts into Supabase**: `taxa` (order → family → genus), then `birds` (pool tags are
  merged, never overwritten), then the primary `bird_photos` row. `--json` also rewrites
  `data/birds.json` so the no-database fallback has the same data.

Other flags: `--no-db` (JSON only), `--no-photos`, `--pool <id>`.

A first run with photos takes about 10 minutes for ~280 species because of the
rate limit.

### Pinning a daily bird

By default the daily bird comes from a seeded shuffle of the pool, keyed on the puzzle
number (days since 2026-09-28). No species repeats until the whole pool has been used.
To choose a specific bird for a date:

```sql
insert into daily_puzzles (puzzle_date, puzzle_number, bird_id)
select '2026-12-25', 89, id from birds where scientific_name = 'Cardinalis cardinalis';
```

Adding or removing species reshuffles future puzzles. Pin upcoming dates first if
you need them stable.

## Deploying to Railway

1. Push this repo to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo** and pick the repo.
   `railway.json` sets the build (`npm ci && npm run build`), the start command
   (`npm run start`, which binds Railway's `$PORT`) and a health check on `/api/health`.
3. Under **Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL`: your Railway domain, used in share text

   `NEXT_PUBLIC_*` values are baked in at build time, so redeploy after changing them.
   Don't add the service-role key: seeding runs from your machine.
4. **Settings → Networking → Generate Domain.**

Pages are statically rendered and revalidated hourly, so newly seeded birds appear
within the hour, or immediately after a redeploy.

## Tree visualization

The spec asked for a radial layout built with react-d3-tree. react-d3-tree only supports
horizontal and vertical layouts, so v1 uses a horizontal tree (decided before
building). The branch data comes from `buildGuessTree()` in `src/lib/tree.ts` and has
no dependency on the renderer. The planned polish pass can therefore swap in
`@visx/hierarchy`'s radial `Tree` and Framer Motion branch reveals without touching
game logic.

## Known limitations

- The answer is computed in the browser, like Wordle and Globle, so a curious player can
  find it in devtools.
- Taxonomy in the bundled `data/birds.json` comes from the curated checklist until you
  run the seed. A few names may differ from AviList, such as a genus move. The seed
  output lists every such difference.

## Credits

- Taxonomy: **AviList Core Team. 2025. AviList: The Global Avian Checklist, v2025.**
  <https://doi.org/10.2173/avilist.v2025>, licensed CC BY 4.0.
- Photos: individual iNaturalist and Wikimedia Commons contributors, credited in the game
  next to each photo, under the license stored with it.
