import type { BirdPhoto, PhotoLicense } from "../../src/lib/types";

export type Fetcher = (url: string) => Promise<unknown>;

/** A JSON fetcher with a descriptive User-Agent that never exceeds `perMinute` requests. */
export function politeFetcher(userAgent: string, perMinute = 55): Fetcher {
  const gap = Math.ceil(60_000 / perMinute);
  let next = 0;
  return async (url) => {
    const wait = next - Date.now();
    next = Math.max(Date.now(), next) + gap;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, { headers: { "User-Agent": userAgent, Accept: "application/json" } });
      if (res.ok) return res.json();
      if ((res.status === 429 || res.status >= 500) && attempt < 3) {
        await new Promise((r) => setTimeout(r, 5_000 * 2 ** attempt));
        continue;
      }
      throw new Error(`${res.status} ${res.statusText} for ${url}`);
    }
  };
}

// ---------------------------------------------------------------- iNaturalist

const INAT = "https://api.inaturalist.org/v1";

interface INatTaxon {
  id: number;
  name: string;
  rank: string;
}
interface INatPhoto {
  id: number;
  url: string;
  attribution: string;
  license_code: string | null;
}
interface INatObservation {
  id: number;
  user?: { login?: string; name?: string | null };
  photos: INatPhoto[];
}

const INAT_LICENSES: Record<string, PhotoLicense> = { cc0: "cc0", "cc-by": "cc-by" };

export function pickINatPhoto(observations: INatObservation[]): BirdPhoto | null {
  for (const obs of observations) {
    for (const photo of obs.photos ?? []) {
      const license = photo.license_code ? INAT_LICENSES[photo.license_code.toLowerCase()] : undefined;
      if (!license || !photo.url) continue;
      return {
        // API returns the square thumbnail; the same path serves other sizes.
        url: photo.url.replace(/\/square\.(jpe?g|png)/i, "/medium.$1"),
        pageUrl: `https://www.inaturalist.org/observations/${obs.id}`,
        photographer: obs.user?.name || obs.user?.login || null,
        attribution: photo.attribution,
        license,
        source: "inaturalist",
      };
    }
  }
  return null;
}

export async function findINatPhoto(scientific: string, get: Fetcher): Promise<BirdPhoto | null> {
  const taxa = (await get(`${INAT}/taxa?${new URLSearchParams({ q: scientific, rank: "species", is_active: "true", per_page: "10" })}`)) as {
    results: INatTaxon[];
  };
  const taxon = taxa.results.find((t) => t.name.toLowerCase() === scientific.toLowerCase());
  if (!taxon) return null;
  const obs = (await get(
    `${INAT}/observations?${new URLSearchParams({
      taxon_id: String(taxon.id),
      photo_license: "cc0,cc-by",
      quality_grade: "research",
      photos: "true",
      order_by: "votes",
      per_page: "10",
    })}`,
  )) as { results: INatObservation[] };
  return pickINatPhoto(obs.results);
}

// ----------------------------------------------------------- Wikimedia/Wikipedia

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

export function normalizeCommonsLicense(short: string): PhotoLicense | null {
  const s = short.toLowerCase().trim();
  if (s === "cc0" || s.startsWith("cc0 ") || s.includes("cc-zero")) return "cc0";
  if (s.startsWith("public domain") || s === "pd") return "public-domain";
  if (/^cc[ -]by[ -]sa\b/.test(s)) return "cc-by-sa";
  if (/^cc[ -]by\b/.test(s) && !/\bnc\b|\bnd\b/.test(s)) return "cc-by";
  return null;
}

interface CommonsImageInfo {
  url: string;
  thumburl?: string;
  descriptionurl?: string;
  extmetadata?: Record<string, { value: string }>;
}

export function commonsPhoto(info: CommonsImageInfo, allowShareAlike: boolean): BirdPhoto | null {
  const meta = info.extmetadata ?? {};
  const license = normalizeCommonsLicense(meta.LicenseShortName?.value ?? "");
  if (!license || (license === "cc-by-sa" && !allowShareAlike)) return null;
  const artist = meta.Artist ? stripHtml(meta.Artist.value) : null;
  const licenseName = meta.LicenseShortName?.value ?? license;
  return {
    url: info.thumburl ?? info.url,
    pageUrl: info.descriptionurl ?? null,
    photographer: artist,
    attribution: artist ? `${artist}, ${licenseName}, via Wikimedia Commons` : `${licenseName}, via Wikimedia Commons`,
    license,
    source: "wikimedia",
  };
}

export async function findWikimediaPhoto(
  scientific: string,
  get: Fetcher,
  allowShareAlike = false,
): Promise<BirdPhoto | null> {
  type Summary = { originalimage?: { source: string } };
  let summary: Summary | null = null;
  try {
    summary = (await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(scientific.replace(/ /g, "_"))}`)) as Summary;
  } catch {
    return null;
  }
  const src = summary?.originalimage?.source;
  if (!src) return null;
  const file = decodeURIComponent(src.split("/").pop() ?? "");
  if (!file) return null;
  const q = (await get(
    `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({
      action: "query",
      titles: `File:${file}`,
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: "800",
      format: "json",
      origin: "*",
    })}`,
  )) as { query?: { pages?: Record<string, { imageinfo?: CommonsImageInfo[] }> } };
  const info = Object.values(q.query?.pages ?? {})[0]?.imageinfo?.[0];
  return info ? commonsPhoto(info, allowShareAlike) : null;
}
