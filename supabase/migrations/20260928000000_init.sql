-- WhichBird schema: taxonomy, birds, photo attribution, daily puzzles, player results.
--
-- The hierarchy is stored as an adjacency list (`taxa`) so it can grow from the
-- ~280-species North American pool to the full ~11,000-species AviList without
-- schema changes. Game pools are tags on `birds.pools`.

create table if not exists public.taxa (
  id          bigint generated always as identity primary key,
  rank        text   not null check (rank in ('order', 'family', 'genus')),
  name        text   not null,           -- scientific name, e.g. 'Parulidae'
  english_name text,                     -- e.g. 'New World Warblers' (families)
  parent_id   bigint references public.taxa (id) on delete restrict,
  sequence    integer,                   -- AviList sequence of the taxon row
  unique (rank, name),
  -- orders are roots; everything else hangs off a parent
  check ((rank = 'order') = (parent_id is null))
);

create index if not exists taxa_parent_idx on public.taxa (parent_id);

create table if not exists public.birds (
  id              bigint generated always as identity primary key,
  scientific_name text   not null unique,
  common_name     text   not null,
  genus_id        bigint not null references public.taxa (id) on delete restrict,
  avilist_sequence integer,              -- global taxonomic sequence (proximity tiebreaker)
  avibase_id      text,
  ebird_code      text,
  pools           text[] not null default '{}',  -- e.g. {'na-common'}
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists birds_genus_idx on public.birds (genus_id);
create index if not exists birds_pools_idx on public.birds using gin (pools);

create table if not exists public.bird_photos (
  id           bigint generated always as identity primary key,
  bird_id      bigint not null references public.birds (id) on delete cascade,
  source       text   not null check (source in ('inaturalist', 'wikimedia')),
  url          text   not null,          -- direct image URL
  page_url     text,                     -- observation / file page for credit
  photographer text,
  attribution  text   not null,          -- full attribution string as provided by the source
  license      text   not null,          -- normalized: 'cc0', 'cc-by', 'cc-by-sa', 'public-domain'
  is_primary   boolean not null default true,
  fetched_at   timestamptz not null default now()
);

create unique index if not exists bird_photos_primary_idx
  on public.bird_photos (bird_id) where is_primary;

create table if not exists public.daily_puzzles (
  puzzle_date   date primary key,
  puzzle_number integer not null unique,
  bird_id       bigint  not null references public.birds (id) on delete restrict,
  pool          text    not null default 'na-common',
  created_at    timestamptz not null default now()
);

-- Optional: per-user results when signed in through Supabase Auth.
create table if not exists public.player_results (
  user_id     uuid    not null references auth.users (id) on delete cascade,
  mode        text    not null default 'daily' check (mode in ('daily', 'practice')),
  puzzle_date date    not null,
  bird_id     bigint  references public.birds (id) on delete set null,
  guess_count integer not null check (guess_count > 0),
  guess_levels smallint[] not null default '{}',  -- 0..4 per guess, in order
  completed_at timestamptz not null default now(),
  primary key (user_id, mode, puzzle_date)
);

-- Flattened view the app reads: one row per bird with full lineage + primary photo.
create or replace view public.bird_catalog
with (security_invoker = true) as
select
  b.id,
  b.scientific_name,
  b.common_name,
  o.name          as order_name,
  f.name          as family_name,
  f.english_name  as family_english_name,
  g.name          as genus_name,
  b.avilist_sequence,
  b.pools,
  p.url           as photo_url,
  p.page_url      as photo_page_url,
  p.photographer  as photo_photographer,
  p.attribution   as photo_attribution,
  p.license       as photo_license,
  p.source        as photo_source
from public.birds b
join public.taxa g on g.id = b.genus_id  and g.rank = 'genus'
join public.taxa f on f.id = g.parent_id and f.rank = 'family'
join public.taxa o on o.id = f.parent_id and o.rank = 'order'
left join public.bird_photos p on p.bird_id = b.id and p.is_primary;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists birds_touch on public.birds;
create trigger birds_touch before update on public.birds
  for each row execute function public.touch_updated_at();

-- Row level security: game data is world-readable, writable only by the
-- service role (the seed script). Player results belong to their owner.
alter table public.taxa           enable row level security;
alter table public.birds          enable row level security;
alter table public.bird_photos    enable row level security;
alter table public.daily_puzzles  enable row level security;
alter table public.player_results enable row level security;

create policy "taxa are public"          on public.taxa          for select using (true);
create policy "birds are public"         on public.birds         for select using (true);
create policy "photos are public"        on public.bird_photos   for select using (true);
-- Only today (in the earliest time zone) and earlier, so future answers stay secret.
create policy "past daily puzzles are public" on public.daily_puzzles
  for select using (puzzle_date <= current_date + 1);

create policy "read own results"   on public.player_results for select using (auth.uid() = user_id);
create policy "insert own results" on public.player_results for insert with check (auth.uid() = user_id);
create policy "update own results" on public.player_results for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select on public.bird_catalog to anon, authenticated;
