import ExcelJS from "exceljs";
import path from "node:path";

export interface AviListSpecies {
  sequence: number;
  order: string;
  family: string;
  familyEnglish: string | null;
  genus: string;
  scientific: string;
  english: string;
  avibaseId: string | null;
  ebirdCode: string | null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** exceljs cells can be strings, numbers, rich text (AviList italicises names), hyperlinks or formulas. */
export function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v).trim();
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    if ("richText" in v && Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("").trim();
    if ("text" in v && v.text != null) return cellText(v.text as ExcelJS.CellValue);
    if ("result" in v && v.result != null) return cellText(v.result as ExcelJS.CellValue);
  }
  return "";
}

/** "PASSERIFORMES" → "Passeriformes"; leaves already-cased names alone. */
export function tidyTaxon(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t;
}

type Col = keyof typeof HEADER_ALIASES;
const HEADER_ALIASES = {
  sequence: ["sequence", "seq"],
  rank: ["taxonrank", "rank"],
  order: ["order"],
  family: ["family"],
  familyEnglish: ["familyenglishname", "familyenglish"],
  scientific: ["scientificname"],
  english: ["englishnameavilist", "englishname", "commonname"],
  avibase: ["avibaseid"],
  ebird: ["speciescodecornelllab", "ebirdspeciescode", "speciescode"],
} as const;

function resolveColumns(headers: string[]): Partial<Record<Col, number>> {
  const normed = headers.map(norm);
  const cols: Partial<Record<Col, number>> = {};
  for (const [col, aliases] of Object.entries(HEADER_ALIASES) as [Col, readonly string[]][]) {
    for (const alias of aliases) {
      const i = normed.indexOf(alias);
      if (i >= 0) {
        cols[col] = i;
        break;
      }
    }
  }
  // Fall back to any "English name…" column (AviList ships several; the AviList one comes first).
  if (cols.english == null) {
    const i = normed.findIndex((h) => h.startsWith("englishname"));
    if (i >= 0) cols.english = i;
  }
  return cols;
}

/** Parse rows (first row that contains a scientific-name header is the header). */
export function parseAviListRows(rows: string[][]): AviListSpecies[] {
  const headerIdx = rows.slice(0, 20).findIndex((r) => r.some((c) => norm(c) === "scientificname"));
  if (headerIdx < 0) throw new Error("Could not find a 'Scientific_name' header in the first 20 rows");
  const cols = resolveColumns(rows[headerIdx]);
  for (const required of ["order", "family", "scientific"] as const) {
    if (cols[required] == null) throw new Error(`AviList sheet is missing a '${required}' column`);
  }
  const get = (row: string[], col: Col) => (cols[col] == null ? "" : (row[cols[col]!] ?? "").trim());

  const familyEnglish = new Map<string, string>();
  const species: AviListSpecies[] = [];
  let seq = 0;

  for (const row of rows.slice(headerIdx + 1)) {
    const scientific = get(row, "scientific").replace(/\s+/g, " ");
    if (!scientific) continue;
    seq++;
    const rank = get(row, "rank").toLowerCase();
    const family = tidyTaxon(get(row, "family"));
    const famEng = get(row, "familyEnglish");

    if (rank === "family" && family) {
      const eng = famEng || get(row, "english");
      if (eng) familyEnglish.set(family, eng);
      continue;
    }
    const isSpecies = rank ? rank === "species" : /^[A-Z][a-z]+ [a-z-]+$/.test(scientific);
    if (!isSpecies) continue;
    if (famEng && family && !familyEnglish.has(family)) familyEnglish.set(family, famEng);

    species.push({
      sequence: Number(get(row, "sequence")) || seq,
      order: tidyTaxon(get(row, "order")),
      family,
      familyEnglish: famEng || null,
      genus: scientific.split(" ")[0],
      scientific,
      english: get(row, "english"),
      avibaseId: get(row, "avibase") || null,
      ebirdCode: get(row, "ebird") || null,
    });
  }

  for (const s of species) s.familyEnglish ??= familyEnglish.get(s.family) ?? null;
  return species;
}

/** Read the AviList download (.xlsx or .csv). */
export async function readAviList(file: string): Promise<AviListSpecies[]> {
  const wb = new ExcelJS.Workbook();
  let sheet: ExcelJS.Worksheet | undefined;
  if (path.extname(file).toLowerCase() === ".csv") {
    sheet = await wb.csv.readFile(file);
  } else {
    await wb.xlsx.readFile(file);
    // Prefer the sheet that actually has a Scientific_name header.
    sheet =
      wb.worksheets.find((ws) => {
        for (let r = 1; r <= Math.min(ws.rowCount, 20); r++) {
          const values = ws.getRow(r).values as ExcelJS.CellValue[];
          if (values.some((v) => norm(cellText(v)) === "scientificname")) return true;
        }
        return false;
      }) ?? wb.worksheets[0];
  }
  if (!sheet) throw new Error(`No worksheet found in ${file}`);

  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as ExcelJS.CellValue[]; // 1-based; index 0 is empty
    rows.push(values.slice(1).map(cellText));
  });
  return parseAviListRows(rows);
}
