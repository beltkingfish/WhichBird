"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { dailyBird, localDateKey, randomBird } from "@/lib/daily";
import {
  loadDaily,
  loadPhotoPref,
  loadPractice,
  loadStats,
  recordDailyWin,
  saveDaily,
  savePhotoPref,
  savePractice,
  type Stats,
} from "@/lib/storage";
import { syncResult } from "@/lib/supabase-browser";
import { bestLevel, LEVELS, scoreGuesses, type MatchLevel } from "@/lib/taxonomy";
import type { Bird } from "@/lib/types";
import { GuessInput } from "./GuessInput";
import { GuessTable } from "./GuessTable";
import { PhotoHint } from "./PhotoHint";
import { TaxonomyTree } from "./TaxonomyTree";
import { WinPanel } from "./WinPanel";

interface Props {
  mode: "daily" | "practice";
  birds: Bird[];
  /** daily_puzzles overrides: dateKey → bird id */
  pinned: Record<string, string>;
}

interface Round {
  dateKey: string;
  number: number;
  target: Bird;
  guessIds: string[];
  won: boolean;
  photoHintUsed: boolean;
}

export function Game({ mode, birds, pinned }: Props) {
  const byId = useMemo(() => new Map(birds.map((b) => [b.id, b])), [birds]);
  const [round, setRound] = useState<Round | null>(null);
  const [photoPref, setPhotoPref] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  // Everything date- and storage-dependent happens in the browser (the player's own midnight).
  useEffect(() => {
    const dateKey = localDateKey();
    setPhotoPref(loadPhotoPref());
    if (mode === "daily") {
      const { bird, number } = dailyBird(birds, dateKey, pinned[dateKey]);
      const saved = loadDaily(dateKey);
      const restore = saved?.targetId === bird.id ? saved : null;
      setRound({
        dateKey,
        number,
        target: bird,
        guessIds: (restore?.guessIds ?? []).filter((id) => byId.has(id)),
        won: restore?.won ?? false,
        photoHintUsed: restore?.photoHintUsed ?? false,
      });
      setStats(loadStats());
    } else {
      const saved = loadPractice();
      const target = saved && !saved.won ? byId.get(saved.targetId) : undefined;
      setRound({
        dateKey,
        number: 0,
        target: target ?? randomBird(birds),
        guessIds: target ? saved!.guessIds.filter((id) => byId.has(id)) : [],
        won: false,
        photoHintUsed: target ? saved!.photoHintUsed : false,
      });
    }
  }, [mode, birds, pinned, byId]);

  const persist = useCallback(
    (r: Round) => {
      const state = { targetId: r.target.id, guessIds: r.guessIds, won: r.won, photoHintUsed: r.photoHintUsed };
      if (mode === "daily") saveDaily({ ...state, dateKey: r.dateKey });
      else savePractice(state);
    },
    [mode],
  );

  const guesses = useMemo(() => (round ? round.guessIds.map((id) => byId.get(id)!).filter(Boolean) : []), [round, byId]);
  const scored = useMemo(() => (round ? scoreGuesses(guesses, round.target) : []), [guesses, round]);
  const guessedSet = useMemo(() => new Set(round?.guessIds ?? []), [round]);

  function onGuess(bird: Bird) {
    if (!round || round.won || guessedSet.has(bird.id)) return;
    const won = bird.id === round.target.id;
    const next: Round = { ...round, guessIds: [...round.guessIds, bird.id], won };
    setRound(next);
    persist(next);
    if (won) {
      const levels = scoreGuesses(next.guessIds.map((id) => byId.get(id)!), round.target).map((s) => s.level);
      if (mode === "daily") setStats(recordDailyWin(round.dateKey, levels.length));
      void syncResult({ mode, dateKey: round.dateKey, birdScientific: round.target.scientific, levels });
    }
  }

  function enablePhoto() {
    setPhotoPref(true);
    savePhotoPref(true);
    if (round && !round.won && !round.photoHintUsed) {
      const next = { ...round, photoHintUsed: true };
      setRound(next);
      persist(next);
    }
  }

  function newPracticeBird() {
    if (!round) return;
    const next: Round = { ...round, target: randomBird(birds, round.target.id), guessIds: [], won: false, photoHintUsed: false };
    setRound(next);
    persist(next);
  }

  // A saved "photo hint on" preference applies to new rounds too, and counts as using it.
  const photoOn = photoPref || !!round?.photoHintUsed;
  useEffect(() => {
    if (photoPref && round && !round.won && !round.photoHintUsed && round.target.photo) {
      const next = { ...round, photoHintUsed: true };
      setRound(next);
      persist(next);
    }
  }, [photoPref, round, persist]);

  if (!round) {
    return (
      <div className="grid place-items-center py-24">
        <span className="loading loading-dots loading-lg text-base-content/40" />
      </div>
    );
  }

  const best = bestLevel(scored);
  const levels: MatchLevel[] = scored.map((s) => s.level);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-base-300 pb-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-base-content/60">
            {mode === "daily" ? `No. ${round.number} · ${formatDate(round.dateKey)}` : "Practice · random bird"}
          </p>
          <h1 className="display text-4xl uppercase sm:text-5xl">{mode === "daily" ? "Today's bird" : "Practice"}</h1>
        </div>
        <Legend />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="min-w-0 space-y-4">
          {round.won ? (
            <WinPanel
              mode={mode}
              target={round.target}
              puzzleNumber={round.number}
              levels={levels}
              photoHintUsed={round.photoHintUsed}
              stats={stats}
              onNext={newPracticeBird}
            />
          ) : (
            <div className="space-y-2">
              <GuessInput birds={birds} guessed={guessedSet} onGuess={onGuess} />
              <KnownLineage best={best} count={scored.length} target={round.target} guesses={guesses} />
            </div>
          )}
          <GuessTable scored={scored} latestIndex={scored.length} />
          <PhotoHint
            mode={mode}
            target={round.target}
            wrongGuesses={round.won ? 0 : scored.length}
            solved={round.won}
            enabled={photoOn}
            onEnable={enablePhoto}
            onDisable={
              photoPref
                ? () => {
                    setPhotoPref(false);
                    savePhotoPref(false);
                  }
                : undefined
            }
          />
          {mode === "practice" && !round.won && <GiveUp key={round.target.id} target={round.target} onNext={newPracticeBird} />}
        </div>
        <TaxonomyTree guesses={guesses} target={round.target} solved={round.won} />
      </div>
    </div>
  );
}

function formatDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function GiveUp({ target, onNext }: { target: Bird; onNext: () => void }) {
  const [revealed, setRevealed] = useState(false);
  if (!revealed) {
    return (
      <button onClick={() => setRevealed(true)} className="btn btn-ghost btn-sm">
        Give up
      </button>
    );
  }
  return (
    <div role="alert" className="alert">
      <span>
        It was the <span className="font-semibold">{target.common}</span> (<span className="sci">{target.scientific}</span>).
      </span>
      <button onClick={onNext} className="btn btn-sm btn-primary">
        Next bird
      </button>
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs" aria-label="Color key">
      {([0, 1, 2, 3, 4] as MatchLevel[]).map((l) => (
        <li key={l} className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-[2px]" style={{ background: LEVELS[l].color }} />
          {LEVELS[l].label}
        </li>
      ))}
    </ul>
  );
}

/** Breadcrumb of the target's lineage as far as the player has uncovered it. */
function KnownLineage({ best, count, target, guesses }: { best: MatchLevel; count: number; target: Bird; guesses: Bird[] }) {
  if (count === 0) return <p className="text-sm text-base-content/60">No guesses yet. Any bird will do to start.</p>;
  const known = [best >= 1 && target.order, best >= 2 && target.family, best >= 3 && target.genus].filter(Boolean) as string[];
  const last = guesses[guesses.length - 1];
  return (
    <div className="flex flex-wrap items-center gap-x-2 text-sm">
      <span className="text-xs uppercase tracking-wide text-base-content/60">Known</span>
      <div className="breadcrumbs py-0">
        <ul>
          <li>Aves</li>
          {known.map((k, i) => (
            <li key={k} className={i === 2 ? "sci font-semibold" : "font-semibold"}>
              {k}
            </li>
          ))}
          <li className="text-base-content/50">?</li>
        </ul>
      </div>
      {!known.length && last && (
        <span className="text-base-content/60">
          (not in {last.order})
        </span>
      )}
    </div>
  );
}
