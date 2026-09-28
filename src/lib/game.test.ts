import { describe, expect, it } from "vitest";
import fallback from "../../data/birds.json";
import { dailyBird, localDateKey, puzzleNumber, seededShuffle } from "./daily";
import { searchBirds } from "./search";
import { buildShareText } from "./share";
import { compareLineage, scoreGuesses, sortByCloseness } from "./taxonomy";
import { buildGuessTree } from "./tree";
import type { Bird, BirdDataset } from "./types";

const birds = (fallback as BirdDataset).birds;
const bird = (common: string): Bird => {
  const b = birds.find((x) => x.common === common);
  if (!b) throw new Error(`no ${common}`);
  return b;
};

describe("compareLineage", () => {
  const target = bird("Yellow Warbler"); // Passeriformes › Parulidae › Setophaga
  it("scores each rank", () => {
    expect(compareLineage(bird("Mallard"), target)).toBe(0);
    expect(compareLineage(bird("Blue Jay"), target)).toBe(1);
    expect(compareLineage(bird("Ovenbird"), target)).toBe(2);
    expect(compareLineage(bird("Palm Warbler"), target)).toBe(3);
    expect(compareLineage(target, target)).toBe(4);
  });
  it("never matches a deeper rank when a shallower one differs", () => {
    const fake = { ...bird("Palm Warbler"), family: "Fakeidae" };
    expect(compareLineage(fake, target)).toBe(1);
  });
  it("sorts closest first, breaking ties by taxonomic sequence", () => {
    const scored = scoreGuesses([bird("Mallard"), bird("Blue Jay"), bird("Palm Warbler"), bird("Ovenbird")], target);
    expect(sortByCloseness(scored).map((s) => s.bird.common)).toEqual(["Palm Warbler", "Ovenbird", "Blue Jay", "Mallard"]);
  });
});

describe("daily puzzle", () => {
  it("numbers puzzles from launch day", () => {
    expect(puzzleNumber("2026-09-28")).toBe(1);
    expect(puzzleNumber("2026-09-29")).toBe(2);
    expect(puzzleNumber("2027-09-28")).toBe(366);
  });
  it("is deterministic and independent of input order", () => {
    const a = dailyBird(birds, "2026-10-05").bird.id;
    const b = dailyBird([...birds].reverse(), "2026-10-05").bird.id;
    expect(a).toBe(b);
  });
  it("uses every bird once before repeating", () => {
    const start = new Date(2026, 8, 28);
    const ids = new Set<string>();
    for (let i = 0; i < birds.length; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      ids.add(dailyBird(birds, localDateKey(d)).bird.id);
    }
    expect(ids.size).toBe(birds.length);
  });
  it("honours a pinned puzzle", () => {
    expect(dailyBird(birds, "2026-10-05", "Cardinalis cardinalis").bird.common).toBe("Northern Cardinal");
  });
  it("handles dates before launch", () => {
    expect(() => dailyBird(birds, "2020-01-01")).not.toThrow();
  });
  it("shuffles deterministically", () => {
    expect(seededShuffle([1, 2, 3, 4, 5], 42)).toEqual(seededShuffle([1, 2, 3, 4, 5], 42));
  });
});

describe("searchBirds", () => {
  it("prefers prefix matches on common names", () => {
    expect(searchBirds(birds, "blue j")[0].common).toBe("Blue Jay");
  });
  it("matches word prefixes, apostrophes and scientific names", () => {
    expect(searchBirds(birds, "red tail").map((b) => b.common)).toContain("Red-tailed Hawk");
    expect(searchBirds(birds, "coopers")[0].common).toBe("Cooper's Hawk");
    expect(searchBirds(birds, "cardinalis card")[0].common).toBe("Northern Cardinal");
  });
});

describe("buildShareText", () => {
  it("renders an emoji row per guess", () => {
    const text = buildShareText({ mode: "daily", puzzleNumber: 12, levels: [0, 1, 2, 3, 4], photoHintUsed: false });
    expect(text).toBe("🐦 WhichBird #12 · 5 guesses\n⬜🟨🟧🟥🟩");
  });
  it("wraps long games and flags the photo hint", () => {
    const text = buildShareText({ mode: "daily", puzzleNumber: 1, levels: [...Array(11).fill(0), 4], photoHintUsed: true });
    expect(text.split("\n")).toHaveLength(3);
    expect(text).toContain("📷");
  });
});

describe("buildGuessTree", () => {
  const target = bird("Yellow Warbler");
  it("lights the shared path and hangs a mystery node at its tip", () => {
    const tree = buildGuessTree([bird("Mallard"), bird("Ovenbird")], target, false);
    const order = tree.children!.find((c) => c.name === "Passeriformes")!;
    expect(order.attributes.status).toBe("path");
    const family = order.children!.find((c) => c.name === "Parulidae")!;
    expect(family.attributes.status).toBe("path");
    expect(family.children!.some((c) => c.attributes.status === "mystery" && c.attributes.rank === "genus")).toBe(true);
    const duck = tree.children!.find((c) => c.name === "Anseriformes")!;
    expect(duck.attributes.status).toBe("off");
  });
  it("puts the mystery under the root when nothing matches", () => {
    const tree = buildGuessTree([bird("Mallard")], target, false);
    expect(tree.children!.some((c) => c.attributes.status === "mystery" && c.attributes.rank === "order")).toBe(true);
  });
  it("never reveals unguessed parts of the target lineage", () => {
    const json = JSON.stringify(buildGuessTree([bird("Blue Jay")], target, false));
    expect(json).not.toContain("Parulidae");
    expect(json).not.toContain("Setophaga");
  });
  it("drops the mystery node once solved", () => {
    const json = JSON.stringify(buildGuessTree([bird("Palm Warbler"), target], target, true));
    expect(json).not.toContain('"mystery"');
  });
});

describe("bundled dataset", () => {
  it("has 200–300 unique species with full lineage", () => {
    expect(birds.length).toBeGreaterThanOrEqual(200);
    expect(birds.length).toBeLessThanOrEqual(300);
    expect(new Set(birds.map((b) => b.id)).size).toBe(birds.length);
    for (const b of birds) {
      expect(b.order && b.family && b.genus && b.scientific.startsWith(b.genus + " ")).toBeTruthy();
    }
  });
});
