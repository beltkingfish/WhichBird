"use client";

import { useId, useMemo, useRef, useState } from "react";
import { searchBirds } from "@/lib/search";
import type { Bird } from "@/lib/types";

interface Props {
  birds: Bird[];
  guessed: Set<string>;
  disabled?: boolean;
  onGuess: (bird: Bird) => void;
}

/** Accessible combobox: type a common or scientific name, pick with arrows/Enter or the mouse. */
export function GuessInput({ birds, guessed, disabled, onGuess }: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const results = useMemo(() => searchBirds(birds, query, 8), [birds, query]);

  function submit(bird: Bird | undefined) {
    if (!bird) {
      setError(query.trim() ? "Not on the list. Pick a bird from the suggestions." : null);
      return;
    }
    if (guessed.has(bird.id)) {
      setError(`You've already guessed ${bird.common}.`);
      return;
    }
    onGuess(bird);
    setQuery("");
    setActive(0);
    setOpen(false);
    setError(null);
    inputRef.current?.focus();
  }

  return (
    <div className="relative">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(results[active]);
        }}
      >
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          value={query}
          placeholder={disabled ? "Lifer found! 🎉" : "Name a bird… (e.g. Blue Jay)"}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
            setError(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2.5 text-base shadow-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={disabled || !query.trim()}
          className="rounded-lg bg-accent px-4 py-2.5 font-medium text-accent-ink shadow-sm disabled:opacity-50"
        >
          Guess
        </button>
      </form>

      {open && results.length > 0 && !disabled && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-80 w-full overflow-auto rounded-lg border border-line bg-card py-1 shadow-lg"
        >
          {results.map((bird, i) => {
            const already = guessed.has(bird.id);
            return (
              <li
                key={bird.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                aria-disabled={already}
                onMouseDown={(e) => {
                  e.preventDefault();
                  submit(bird);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-1.5 ${
                  i === active ? "bg-accent/10" : ""
                } ${already ? "opacity-40" : ""}`}
              >
                <span>{bird.common}</span>
                <span className="sci truncate text-xs text-muted">{bird.scientific}</span>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="mt-1 text-sm text-[var(--lvl-1)]">{error}</p>}
    </div>
  );
}
