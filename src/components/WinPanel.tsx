"use client";

import { useEffect, useState } from "react";
import { copyText } from "@/lib/clipboard";
import { buildShareText } from "@/lib/share";
import type { Stats } from "@/lib/storage";
import type { MatchLevel } from "@/lib/taxonomy";
import type { Bird } from "@/lib/types";
import { StatsBody } from "./SiteHeader";

interface Props {
  mode: "daily" | "practice";
  target: Bird;
  puzzleNumber: number;
  levels: MatchLevel[];
  photoHintUsed: boolean;
  stats: Stats | null;
  onNext?: () => void;
}

/** Seconds until the player's local midnight, ticking. */
function useSecondsToMidnight(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.max(0, Math.floor((midnight.getTime() - now) / 1000));
}

function Countdown() {
  const s = useSecondsToMidnight();
  const parts = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  return (
    <span className="flex font-mono text-2xl" role="timer" aria-label={`${parts[0]} hours ${parts[1]} minutes`}>
      {parts.map((v, i) => (
        <span key={i} className="flex">
          {i > 0 && ":"}
          <span className="countdown">
            <span style={{ "--value": v, "--digits": 2 } as React.CSSProperties} aria-hidden>
              {String(v).padStart(2, "0")}
            </span>
          </span>
        </span>
      ))}
    </span>
  );
}

export function WinPanel({ mode, target, puzzleNumber, levels, photoHintUsed, stats, onNext }: Props) {
  const [copied, setCopied] = useState(false);
  const text = buildShareText({
    mode,
    puzzleNumber,
    levels,
    photoHintUsed,
    url: process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : undefined),
  });

  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copy() {
    const ok = await copyText(text);
    setCopied(ok);
    setCopyFailed(!ok);
    if (ok) setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    try {
      await navigator.share({ text });
    } catch {
      /* user closed the share sheet */
    }
  }

  const n = levels.length;

  return (
    <section aria-live="polite" className="card border-2 border-base-content bg-base-100">
      <div className="card-body gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--lvl-4)" }}>
              New lifer · {n} {n === 1 ? "guess" : "guesses"}
            </p>
            <h2 className="display text-3xl uppercase">{target.common}</h2>
          </div>
          <span className="inline-block h-8 w-8 shrink-0 rounded-[2px]" style={{ background: "var(--lvl-4)" }} aria-hidden />
        </div>

        <div className="breadcrumbs py-0 text-xs text-base-content/70">
          <ul>
            <li>{target.order}</li>
            <li>
              {target.family}
              {target.familyEnglish ? ` (${target.familyEnglish})` : ""}
            </li>
            <li className="sci">{target.scientific}</li>
          </ul>
        </div>

        <pre
          aria-label="Your result"
          className="select-all rounded-box bg-base-200 p-3 font-mono text-sm leading-relaxed whitespace-pre-wrap"
        >
          {text}
        </pre>
        {copyFailed && <p className="text-xs text-error">Couldn&apos;t reach the clipboard. Select the text above and copy it.</p>}

        <div className="card-actions">
          <button onClick={copy} className="btn btn-primary">
            {copied ? "Copied" : "Copy result"}
          </button>
          {canShare && (
            <button onClick={share} className="btn btn-outline">
              Share…
            </button>
          )}
          {mode === "practice" && onNext && (
            <button onClick={onNext} className="btn btn-outline">
              Next bird
            </button>
          )}
        </div>

        {mode === "daily" && (
          <>
            <div className="divider my-0" />
            <div className="flex items-end justify-between gap-3">
              <span className="text-xs uppercase tracking-wide text-base-content/60">Next bird in</span>
              <Countdown />
            </div>
            {stats && <StatsBody stats={stats} histogram={false} />}
          </>
        )}
      </div>

      {copied && (
        <div className="toast toast-center toast-bottom z-50">
          <div className="alert alert-success py-2 text-sm">Copied to clipboard</div>
        </div>
      )}
    </section>
  );
}
