"use client";

import { useState } from "react";
import { LEVELS, sortByCloseness, type ScoredGuess } from "@/lib/taxonomy";

interface Props {
  scored: ScoredGuess[];
  latestIndex: number;
}

/** Guess history. Each rank cell fills with the guess's color when it matches the target. */
export function GuessTable({ scored, latestIndex }: Props) {
  const [sort, setSort] = useState<"closest" | "recent">("closest");
  if (scored.length === 0) return null;
  const rows = sort === "closest" ? sortByCloseness(scored) : [...scored].reverse();

  return (
    <section aria-label="Your guesses" className="rounded-box border border-base-300">
      <div className="flex items-center justify-between border-b border-base-300 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide">
          Guesses <span className="font-mono text-base-content/60">{scored.length}</span>
        </h2>
        <div className="join" role="group" aria-label="Sort guesses">
          {(["closest", "recent"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              aria-pressed={sort === s}
              className={`btn join-item btn-xs ${sort === s ? "btn-neutral" : "btn-ghost"}`}
            >
              {s === "closest" ? "Closest" : "Latest"}
            </button>
          ))}
        </div>
      </div>
      <div className="relative overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide">
              <th className="hidden w-8 sm:table-cell">#</th>
              <th>Bird</th>
              <th>Order</th>
              <th>Family</th>
              <th>Genus</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ bird, level, index }) => {
              const info = LEVELS[level];
              const cell = (matched: boolean, text: string, italic = false) => (
                <td className="px-2">
                  <span
                    className={`inline-block whitespace-nowrap rounded-[2px] px-1.5 py-0.5 text-xs ${italic ? "sci" : ""} ${matched ? "font-semibold" : "text-base-content/50"}`}
                    style={matched ? { background: info.color, color: level === 3 ? "#1a1c1b" : "#fff" } : undefined}
                  >
                    {text}
                  </span>
                </td>
              );
              return (
                <tr
                  key={bird.id}
                  className={index === latestIndex ? "bg-base-200" : ""}
                  style={{ boxShadow: `inset 4px 0 0 ${info.color}` }}
                  title={info.label}
                >
                  <td className="hidden font-mono text-xs text-base-content/50 sm:table-cell">{index}</td>
                  <td className="min-w-32">
                    <div className="font-semibold leading-tight">{bird.common}</div>
                    <div className="sci text-xs text-base-content/60">{bird.scientific}</div>
                    <span className="sr-only">{info.label}</span>
                  </td>
                  {cell(level >= 1, bird.order)}
                  {cell(level >= 2, bird.family)}
                  {cell(level >= 3, bird.genus, true)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
