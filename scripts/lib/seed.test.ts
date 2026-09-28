import ExcelJS from "exceljs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cellText, parseAviListRows, readAviList, tidyTaxon } from "./avilist";
import { matchChecklist } from "./match";
import { commonsPhoto, normalizeCommonsLicense, pickINatPhoto } from "./photos";

const HEADER = ["Sequence", "Taxon_rank", "Order", "Family", "Family_English_name", "Scientific_name", "Authority", "English_name_AviList", "AvibaseID", "Species_code_Cornell_Lab"];
const ROWS = [
  [1, "order", "PASSERIFORMES", "", "", "Passeriformes", "", "", "", ""],
  [2, "family", "PASSERIFORMES", "Parulidae", "New World Warblers", "Parulidae", "", "", "", ""],
  [3, "genus", "PASSERIFORMES", "Parulidae", "", "Setophaga", "", "", "", ""],
  [4, "species", "PASSERIFORMES", "Parulidae", "", "Setophaga petechia", "(Linnaeus, 1766)", "Yellow Warbler", "AVIBASE-1", "yelwar"],
  [5, "subspecies", "PASSERIFORMES", "Parulidae", "", "Setophaga petechia aestiva", "", "", "", ""],
  [6, "species", "ACCIPITRIFORMES", "Accipitridae", "Hawks", "Astur cooperii", "", "Cooper's Hawk", "", ""],
];

describe("AviList parsing", () => {
  it("normalises cells and names", () => {
    expect(cellText({ richText: [{ text: "Setophaga " }, { text: "petechia" }] } as ExcelJS.CellValue)).toBe("Setophaga petechia");
    expect(tidyTaxon("PASSERIFORMES")).toBe("Passeriformes");
    expect(tidyTaxon("Parulidae")).toBe("Parulidae");
  });

  it("keeps species rows only and fills family English names from family rows", () => {
    const rows = [["AviList v2025"], HEADER, ...ROWS].map((r) => r.map(String));
    const species = parseAviListRows(rows);
    expect(species.map((s) => s.scientific)).toEqual(["Setophaga petechia", "Astur cooperii"]);
    expect(species[0]).toMatchObject({
      order: "Passeriformes",
      family: "Parulidae",
      familyEnglish: "New World Warblers",
      genus: "Setophaga",
      english: "Yellow Warbler",
      sequence: 4,
      avibaseId: "AVIBASE-1",
      ebirdCode: "yelwar",
    });
  });

  it("reads a real .xlsx with rich-text (italic) cells", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Read me").addRow(["Notes"]);
    const ws = wb.addWorksheet("AviList");
    ws.addRow(HEADER);
    for (const r of ROWS) {
      const row = ws.addRow(r);
      row.getCell(6).value = { richText: [{ text: String(r[5]), font: { italic: true } }] };
    }
    const file = path.join(mkdtempSync(path.join(tmpdir(), "whichbird-")), "avilist.xlsx");
    await wb.xlsx.writeFile(file);
    const species = await readAviList(file);
    expect(species.map((s) => s.english)).toEqual(["Yellow Warbler", "Cooper's Hawk"]);
  });

  it("matches the checklist by scientific name, then English name", () => {
    const species = parseAviListRows([HEADER, ...ROWS].map((r) => r.map(String)));
    const { matched, unmatched } = matchChecklist(
      [
        { english: "Yellow Warbler", scientific: "Setophaga petechia" },
        { english: "Cooper's Hawk", scientific: "Accipiter cooperii" },
        { english: "Dodo", scientific: "Raphus cucullatus" },
      ],
      species,
    );
    expect(matched.map((m) => [m.species.scientific, m.via])).toEqual([
      ["Setophaga petechia", "scientific"],
      ["Astur cooperii", "english"],
    ]);
    expect(unmatched.map((u) => u.english)).toEqual(["Dodo"]);
  });
});

describe("photo selection", () => {
  it("takes the first CC0/CC BY iNaturalist photo, at medium size", () => {
    const photo = pickINatPhoto([
      { id: 1, photos: [{ id: 10, url: "https://x/photos/10/square.jpg", attribution: "(c) A, all rights reserved", license_code: null }] },
      { id: 2, photos: [{ id: 11, url: "https://x/photos/11/square.jpg", attribution: "(c) B, some rights reserved (CC BY-NC)", license_code: "cc-by-nc" }] },
      { id: 3, user: { login: "cee", name: "C. Dee" }, photos: [{ id: 12, url: "https://x/photos/12/square.jpeg", attribution: "(c) C. Dee, some rights reserved (CC BY)", license_code: "cc-by" }] },
    ]);
    expect(photo).toEqual({
      url: "https://x/photos/12/medium.jpeg",
      pageUrl: "https://www.inaturalist.org/observations/3",
      photographer: "C. Dee",
      attribution: "(c) C. Dee, some rights reserved (CC BY)",
      license: "cc-by",
      source: "inaturalist",
    });
  });

  it("normalises Commons licenses and rejects NC/ND", () => {
    expect(normalizeCommonsLicense("CC BY 4.0")).toBe("cc-by");
    expect(normalizeCommonsLicense("CC BY-SA 3.0")).toBe("cc-by-sa");
    expect(normalizeCommonsLicense("CC0")).toBe("cc0");
    expect(normalizeCommonsLicense("Public domain")).toBe("public-domain");
    expect(normalizeCommonsLicense("CC BY-NC 2.0")).toBeNull();
  });

  it("only accepts share-alike Commons images when allowed", () => {
    const info = {
      url: "https://upload.wikimedia.org/a.jpg",
      thumburl: "https://upload.wikimedia.org/thumb/a.jpg",
      descriptionurl: "https://commons.wikimedia.org/wiki/File:a.jpg",
      extmetadata: { LicenseShortName: { value: "CC BY-SA 4.0" }, Artist: { value: '<a href="/u">Jane Roe</a>' } },
    };
    expect(commonsPhoto(info, false)).toBeNull();
    expect(commonsPhoto(info, true)).toMatchObject({ photographer: "Jane Roe", license: "cc-by-sa", url: info.thumburl });
  });
});
