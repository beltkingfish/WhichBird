"use client";

import { useEffect, useState } from "react";
import { buildShareText } from "@/lib/share";
import type { Stats } from "@/lib/storage";
import type { MatchLevel } from "@/lib/taxonomy";
import type { Bird } from "@/lib/types";

interface Props {
  mode: "daily" | "practice";
  target: Bird;
  puzzleNumber: number;
  levels: MatchLevel[];
  photoHintUsed: boolean;
  stats: Stats | null;
  onNext?: () => void;
}

function useCountdown(): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const s = Math.max(0, Math.floor((midnight.getTime() - now) / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

const cheer = (n: number) =>
  n === 1 ? "First guess! Were you out at dawn?" : n <= 4 ? "Sharp eyes." : n <= 9 ? "Nice work in the field." : "Persistence pays: every birder knows that.";

export function WinPanel({ mode, target, puzzleNumber, levels, photoHintUsed, stats, onNext }: Props) {
  const [copied, setCopied] = useState(false);
  const countdown = useCountdown();
  const text = buildShareText({
    mode,
    puzzleNumber,
    levels,
    photoHintUsed,
    url: process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : undefined),
  });

  async function share() {
    try {
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user cancelled the share sheet */
    }
  }

  const avg =
    stats && stats.wins
      ? (
          Object.entries(stats.histogram).reduce((sum, [k, v]) => sum + (k === "10+" ? 10 : Number(k)) * v, 0) / stats.wins
        ).toFixed(1)
      : null;

  return (
    <section
      aria-live="polite"
      className="rounded-xl border-2 p-4 shadow-sm"
      style={{ borderColor: "var(--lvl-4)", background: "color-mix(in srgb, var(--lvl-4-glow) 14%, var(--card))" }}
    >
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--lvl-4)" }}>
        New lifer!
      </p>
      <h2 className="font-display text-2xl font-bold">{target.common}</h2>
      <p className="text-sm text-muted">
        <span className="sci">{target.scientific}</span> · {target.order} › {target.family}
        {target.familyEnglish ? ` (${target.familyEnglish})` : ""}
      </p>
      <p className="mt-2 text-sm">
        Found in {levels.length} {levels.length === 1 ? "guess" : "guesses"}. {cheer(levels.length)}
      </p>

      <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-card p-3 font-sans text-sm">{text}</pre>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={share} className="rounded-lg bg-accent px-4 py-2 font-medium text-accent-ink">
          {copied ? "Copied!" : "Share result"}
        </button>
        {mode === "practice" && onNext && (
          <button onClick={onNext} className="rounded-lg border border-line bg-card px-4 py-2 font-medium">
            Find another bird
          </button>
        )}
      </div>

      {mode === "daily" && (
        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2 text-sm">
          {stats && (
            <>
              <Stat label="Lifers" value={stats.wins} />
              <Stat label="Streak" value={stats.currentStreak} />
              <Stat label="Best streak" value={stats.maxStreak} />
              {avg && <Stat label="Avg guesses" value={avg} />}
            </>
          )}
          <div className="ml-auto text-right">
            <div className="text-xs text-muted">Next bird in</div>
            <div className="font-mono text-lg tabular-nums">{countdown}</div>
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
