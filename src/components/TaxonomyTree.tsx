"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CustomNodeElementProps, RawNodeDatum, TreeLinkDatum } from "react-d3-tree";
import { LEVELS, type MatchLevel } from "@/lib/taxonomy";
import { buildGuessTree, countLeaves, type TaxonNode } from "@/lib/tree";
import type { Bird } from "@/lib/types";

// d3-zoom touches the DOM on import; render the tree only in the browser.
const Tree = dynamic(() => import("react-d3-tree").then((m) => m.Tree), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted">Growing the tree…</div>,
});

const DEPTH_SPACING = 135;
const ROW_SPACING = 44;
/** Color for an on-path node at each depth: Aves → Order → Family → Genus → Species. */
const PATH_COLORS = ["var(--ink)", LEVELS[1].color, LEVELS[2].color, LEVELS[3].color, LEVELS[4].color];

type Attrs = TaxonNode["attributes"];

function renderNode({ nodeDatum, hierarchyPointNode, toggleNode }: CustomNodeElementProps) {
  const a = nodeDatum.attributes as unknown as Attrs;
  const depth = hierarchyPointNode.depth;
  const isLeaf = a.rank === "species";
  const isMystery = a.status === "mystery";
  const fill = isMystery
    ? "var(--card)"
    : isLeaf
      ? LEVELS[(a.level ?? 0) as MatchLevel].color
      : a.status === "path"
        ? PATH_COLORS[depth]
        : "var(--off)";
  const italic = a.rank === "genus";
  const hasKids = !!nodeDatum.children?.length;
  const collapsed = nodeDatum.__rd3t.collapsed;

  return (
    <g className="tree-node" onClick={hasKids ? toggleNode : undefined} style={{ cursor: hasKids ? "pointer" : "default" }}>
      {isLeaf && a.level === 4 && <circle r={14} fill="var(--lvl-4-glow)" opacity={0.45} />}
      <circle
        r={isMystery ? 11 : isLeaf ? 8 : 7}
        fill={fill}
        stroke={isMystery ? "var(--muted)" : collapsed && hasKids ? "var(--ink)" : "var(--card)"}
        strokeWidth={isMystery ? 1.5 : 2}
        strokeDasharray={isMystery ? "3 3" : undefined}
      />
      {isMystery && (
        <text textAnchor="middle" dy="0.35em" fontSize={12} fontWeight={700}>
          ?
        </text>
      )}
      {!isMystery && (
        <>
          <text x={isLeaf ? 14 : 0} y={isLeaf ? -1 : -13} textAnchor={isLeaf ? "start" : "middle"} fontSize={12} fontWeight={a.status === "path" ? 700 : 500} fontStyle={italic ? "italic" : undefined}>
            {nodeDatum.name}
          </text>
          {a.subtitle && (
            <text className="tree-sub" x={isLeaf ? 14 : 0} y={isLeaf ? 12 : 20} textAnchor={isLeaf ? "start" : "middle"} fontSize={10} fontStyle={isLeaf ? "italic" : undefined}>
              {a.subtitle}
            </text>
          )}
        </>
      )}
      {isMystery && (
        <text className="tree-sub" x={16} dy="0.35em" fontSize={11}>
          {a.rank === "order" ? "which order?" : `another ${a.rank}?`}
        </text>
      )}
    </g>
  );
}

function linkClass({ target }: TreeLinkDatum) {
  const a = target.data.attributes as unknown as Attrs;
  if (a.status === "mystery") return "tree-link tree-link--mystery";
  if (a.status === "path") return `tree-link tree-link--lit tree-link--d${target.depth}`;
  return "tree-link";
}

interface Props {
  guesses: Bird[];
  target: Bird;
  solved: boolean;
}

/** Live taxonomy tree: every guess's lineage, with the branches shared with the target lit up. */
export function TaxonomyTree({ guesses, target, solved }: Props) {
  const data = useMemo(() => buildGuessTree(guesses, target, solved), [guesses, target, solved]);
  const leaves = countLeaves(data);
  const height = Math.min(640, Math.max(240, leaves * ROW_SPACING + 80));

  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit the five ranks across the container, zooming out on narrow screens.
  const needed = DEPTH_SPACING * 4 + 190;
  const zoom = width ? Math.min(1, width / needed) : 1;

  return (
    <section aria-label="Taxonomy tree" className="min-w-0 self-start rounded-xl border border-line bg-card shadow-sm lg:sticky lg:top-4">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="text-sm font-semibold">Tree of life</h2>
        <span className="text-right text-xs text-muted">drag to pan · scroll to zoom · click a node to fold it</span>
      </div>
      <div ref={ref} style={{ height }} className="w-full">
        {width > 0 && (
          <Tree
            data={data as unknown as RawNodeDatum}
            orientation="horizontal"
            pathFunc="step"
            translate={{ x: 40 * zoom + 10, y: height / 2 }}
            zoom={zoom}
            scaleExtent={{ min: 0.3, max: 2 }}
            nodeSize={{ x: DEPTH_SPACING, y: ROW_SPACING }}
            separation={{ siblings: 1, nonSiblings: 1.15 }}
            renderCustomNodeElement={renderNode}
            pathClassFunc={linkClass}
            enableLegacyTransitions
            transitionDuration={350}
          />
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {describePath(data)}
      </p>
    </section>
  );
}

/** Screen-reader summary of the known lineage. */
function describePath(root: TaxonNode): string {
  const parts: string[] = [];
  let node: TaxonNode | undefined = root;
  while (node) {
    parts.push(node.name);
    node = node.children?.find((c) => c.attributes.status === "path");
  }
  return `Known lineage: ${parts.join(" › ")}`;
}
