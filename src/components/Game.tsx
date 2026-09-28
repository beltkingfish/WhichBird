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
    return <div className="py-24 text-center text-muted">Scanning the treetops…</div>;
  }

  const best = bestLevel(scored);
  const levels: MatchLevel[] = scored.map((s) => s.level);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-3xl font-bold">
            {mode === "daily" ? `Today's mystery bird` : "Practice"}
            {mode === "daily" && <span className="ml-2 align-middle text-base font-normal text-muted">#{round.number}</span>}
          </h1>
          <p className="text-sm text-muted">
            {mode === "daily"
              ? "One bird a day, the same for everyone. Guess any species; the tree shows how close you are."
              : "A random bird, as many rounds as you like. Doesn't touch your daily streak."}
          </p>
        </div>
        <details className="text-sm text-muted">
          <summary className="cursor-pointer select-none hover:text-ink">How to play</summary>
          <div className="mt-2 max-w-sm space-y-1 rounded-lg border border-line bg-card p-3 text-ink">
            <p>Name any bird. We compare its lineage with the mystery bird&apos;s: Order › Family › Genus › Species.</p>
            <p>The deeper the match, the warmer the color. Close the gap until you land on the species itself, your lifer.</p>
            <p>Guesses are unlimited. Within a color, closer guesses sort higher.</p>
          </div>
        </details>
      </div>

      <Legend />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
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
            <>
              <GuessInput birds={birds} guessed={guessedSet} onGuess={onGuess} />
              <StatusLine best={best} count={scored.length} target={round.target} guesses={guesses} />
            </>
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

function GiveUp({ target, onNext }: { target: Bird; onNext: () => void }) {
  const [revealed, setRevealed] = useState(false);
  if (!revealed) {
    return (
      <button onClick={() => setRevealed(true)} className="text-sm text-muted underline hover:text-ink">
        Give up and reveal the bird
      </button>
    );
  }
  return (
    <p className="text-sm">
      It was the <span className="font-semibold">{target.common}</span> (<span className="sci">{target.scientific}</span>).{" "}
      <button onClick={onNext} className="underline hover:text-ink">
        Try another bird
      </button>
    </p>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Color key">
      {([0, 1, 2, 3, 4] as MatchLevel[]).map((l) => (
        <li key={l} className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: LEVELS[l].color }} />
          {LEVELS[l].label}
        </li>
      ))}
    </ul>
  );
}

function StatusLine({ best, count, target, guesses }: { best: MatchLevel; count: number; target: Bird; guesses: Bird[] }) {
  if (count === 0) return <p className="text-sm text-muted">Where to start? Try a bird from your backyard.</p>;
  const known = [
    best >= 1 && target.order,
    best >= 2 && `${target.family}${target.familyEnglish ? ` (${target.familyEnglish})` : ""}`,
    best >= 3 && target.genus,
  ].filter(Boolean);
  const last = guesses[guesses.length - 1];
  return (
    <p className="text-sm">
      {known.length ? (
        <>
          Known lineage: <span className="font-medium">Aves › {known.join(" › ")} › ?</span>
        </>
      ) : (
        <>No shared order yet. {last?.common} is in {last?.order}; the mystery bird isn&apos;t.</>
      )}
    </p>
  );
}
