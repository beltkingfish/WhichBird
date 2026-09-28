"use client";

import { useState } from "react";
import { LEVELS, sortByCloseness, type ScoredGuess } from "@/lib/taxonomy";

interface Props {
  scored: ScoredGuess[];
  latestIndex: number;
}

/** Guess history. Each rank cell lights up in the guess's color when it matches the target. */
export function GuessTable({ scored, latestIndex }: Props) {
  const [sort, setSort] = useState<"closest" | "recent">("closest");
  if (scored.length === 0) return null;
  const rows = sort === "closest" ? sortByCloseness(scored) : [...scored].reverse();

  return (
    <section aria-label="Your guesses" className="rounded-xl border border-line bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="text-sm font-semibold">
          {scored.length} {scored.length === 1 ? "guess" : "guesses"}
        </h2>
        <div className="flex gap-1 text-xs" role="group" aria-label="Sort guesses">
          {(["closest", "recent"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              aria-pressed={sort === s}
              className={`rounded px-2 py-0.5 ${sort === s ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"}`}
            >
              {s === "closest" ? "Closest" : "Recent"}
            </button>
          ))}
        </div>
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="hidden px-3 py-1.5 font-medium sm:table-cell">#</th>
              <th className="px-3 py-1.5 font-medium">Bird</th>
              <th className="px-2 py-1.5 font-medium">Order</th>
              <th className="px-2 py-1.5 font-medium">Family</th>
              <th className="px-2 py-1.5 font-medium">Genus</th>
              <th className="px-2 py-1.5 font-medium">
                <span className="sr-only">Match</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ bird, level, index }) => {
              const info = LEVELS[level];
              const cell = (matched: boolean, text: string, italic = false) => (
                <td className="px-1.5 py-1.5">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-xs ${italic ? "sci" : ""}`}
                    style={
                      matched
                        ? { background: info.color, color: level >= 3 ? "#1f2a24" : "#fff" }
                        : { color: "var(--muted)" }
                    }
                  >
                    {text}
                  </span>
                </td>
              );
              return (
                <tr
                  key={bird.id}
                  className={`border-t border-line ${index === latestIndex ? "bg-accent/5" : ""}`}
                  style={{ boxShadow: `inset 4px 0 0 ${info.color}` }}
                >
                  <td className="hidden px-3 py-1.5 text-xs tabular-nums text-muted sm:table-cell">{index}</td>
                  <td className="min-w-32 px-2 py-1.5">
                    <div className="font-medium leading-tight">{bird.common}</div>
                    <div className="sci text-xs text-muted">{bird.scientific}</div>
                  </td>
                  {cell(level >= 1, bird.order)}
                  {cell(level >= 2, bird.family)}
                  {cell(level >= 3, bird.genus, true)}
                  <td className="px-2 py-1.5 text-center" title={info.label}>
                    <span aria-hidden>{info.emoji}</span>
                    <span className="sr-only">{info.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
