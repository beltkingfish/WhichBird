"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { loadStats, type Stats } from "@/lib/storage";
import { LEVELS, type MatchLevel } from "@/lib/taxonomy";
import { AccountButton } from "./AccountButton";

export function SiteHeader() {
  const path = usePathname();
  const help = useRef<HTMLDialogElement>(null);
  const statsDialog = useRef<HTMLDialogElement>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  return (
    <header className="border-b-2 border-base-content">
      <div className="navbar mx-auto max-w-6xl gap-2 px-4">
        <div className="flex flex-1 items-center gap-4">
          <Link href="/" className="display text-3xl uppercase">
            Lifer
          </Link>
          <div role="tablist" className="tabs tabs-border tabs-sm">
            <Link href="/" role="tab" className={`tab ${path === "/" ? "tab-active" : ""}`}>
              Daily
            </Link>
            <Link href="/practice" role="tab" className={`tab ${path === "/practice" ? "tab-active" : ""}`}>
              Practice
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="btn btn-ghost btn-sm btn-square" aria-label="How to play" onClick={() => help.current?.showModal()}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01" strokeLinecap="round" />
            </svg>
          </button>
          <button
            className="btn btn-ghost btn-sm btn-square"
            aria-label="Statistics"
            onClick={() => {
              setStats(loadStats());
              statsDialog.current?.showModal();
            }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 20V11M12 20V5M19 20v-6" strokeLinecap="round" />
            </svg>
          </button>
          <AccountButton />
        </div>
      </div>

      <dialog ref={help} className="modal">
        <div className="modal-box max-w-md">
          <h2 className="display mb-3 text-2xl uppercase">How to play</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>Type any bird and pick it from the list.</li>
            <li>
              Its lineage (order, family, genus, species) is compared with the mystery bird. The color shows the
              deepest rank they share.
            </li>
            <li>The tree on the right fills in as you go. Lit branches lead toward the answer.</li>
            <li>Guesses are unlimited. The daily bird changes at midnight, your time.</li>
          </ol>
          <ul className="mt-4 space-y-1 text-sm">
            {([0, 1, 2, 3, 4] as MatchLevel[]).map((l) => (
              <li key={l} className="flex items-center gap-2">
                <span className="inline-block h-3.5 w-3.5 rounded-[2px]" style={{ background: LEVELS[l].color }} />
                {LEVELS[l].label}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-base-content/60">
            &ldquo;Lifer&rdquo; is birder slang for a species you&apos;ve never seen before.
          </p>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-primary btn-sm">Got it</button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      <dialog ref={statsDialog} className="modal">
        <div className="modal-box max-w-md">
          <h2 className="display mb-3 text-2xl uppercase">Your life list</h2>
          {stats && <StatsBody stats={stats} />}
          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-sm">Close</button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </header>
  );
}

const BUCKETS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10+"];

export function StatsBody({ stats, histogram = true }: { stats: Stats; histogram?: boolean }) {
  const total = Object.entries(stats.histogram).reduce((s, [k, v]) => s + (k === "10+" ? 10 : Number(k)) * v, 0);
  const max = Math.max(1, ...Object.values(stats.histogram));
  return (
    <>
      <div className="stats stats-horizontal w-full border border-base-300">
        <Stat title="Lifers" value={stats.wins} />
        <Stat title="Streak" value={stats.currentStreak} />
        <Stat title="Best" value={stats.maxStreak} />
        <Stat title="Avg" value={stats.wins ? (total / stats.wins).toFixed(1) : "–"} />
      </div>
      {histogram && stats.wins > 0 && (
        <div className="mt-4 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Guesses to find it</p>
          {BUCKETS.map((b) => (
            <div key={b} className="flex items-center gap-2 text-xs">
              <span className="w-6 text-right font-mono">{b}</span>
              <progress className="progress progress-primary h-3 flex-1" value={stats.histogram[b] ?? 0} max={max} />
              <span className="w-5 font-mono">{stats.histogram[b] ?? 0}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Stat({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="stat px-3 py-2 place-items-center">
      <div className="stat-title text-xs">{title}</div>
      <div className="stat-value font-mono text-2xl">{value}</div>
    </div>
  );
}
