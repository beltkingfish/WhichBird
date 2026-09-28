import type { Bird } from "./types";
import { compareLineage, lineage, RANKS, type MatchLevel } from "./taxonomy";

export type NodeStatus = "path" | "off" | "mystery";

export interface TaxonNode {
  name: string;
  attributes: {
    rank: "class" | "order" | "family" | "genus" | "species";
    status: NodeStatus;
    /** Family English name or species scientific name. */
    subtitle?: string;
    /** Guess leaves only. */
    level?: MatchLevel;
  };
  children?: TaxonNode[];
}

/**
 * The taxonomy tree the player has uncovered so far: the union of every
 * guess's lineage, rooted at Aves. Nodes shared with the target are marked
 * `path`, and a "?" node hangs off the deepest known point of the target's
 * lineage until the bird is found. Nothing about the target is added that a
 * guess hasn't already revealed.
 */
export function buildGuessTree(guesses: Bird[], target: Bird, solved: boolean): TaxonNode {
  const root: TaxonNode = { name: "Aves", attributes: { rank: "class", status: "path", subtitle: "Birds" }, children: [] };
  const t = lineage(target);

  for (const bird of guesses) {
    const l = lineage(bird);
    let node = root;
    let onPath = true;
    for (const rank of RANKS) {
      onPath = onPath && l[rank] === t[rank];
      const key = rank === "species" ? bird.common : l[rank];
      node.children ??= [];
      let child = node.children.find((c) => c.name === key && c.attributes.status !== "mystery");
      if (!child) {
        child = {
          name: key,
          attributes: {
            rank,
            status: onPath ? "path" : "off",
            subtitle: rank === "family" ? bird.familyEnglish ?? undefined : rank === "species" ? bird.scientific : undefined,
            ...(rank === "species" ? { level: compareLineage(bird, target) } : {}),
          },
          ...(rank === "species" ? {} : { children: [] }),
        };
        node.children.push(child);
      }
      node = child;
    }
  }

  if (!solved) {
    // Walk the lit path to its deepest node and hang the mystery bird there.
    let deepest = root;
    let depth = 0;
    for (;;) {
      const next = deepest.children?.find((c) => c.attributes.status === "path" && c.attributes.rank !== "species");
      if (!next) break;
      deepest = next;
      depth++;
    }
    const rank = RANKS[depth];
    deepest.children ??= [];
    deepest.children.push({ name: "?", attributes: { rank, status: "mystery" } });
  }

  sortTree(root);
  return root;
}

function sortTree(node: TaxonNode) {
  if (!node.children) return;
  node.children.sort((a, b) => {
    const rank = (n: TaxonNode) => (n.attributes.status === "path" ? 0 : n.attributes.status === "mystery" ? 1 : 2);
    return rank(a) - rank(b) || a.name.localeCompare(b.name);
  });
  node.children.forEach(sortTree);
}

export function countLeaves(node: TaxonNode): number {
  return node.children?.length ? node.children.reduce((n, c) => n + countLeaves(c), 0) : 1;
}
