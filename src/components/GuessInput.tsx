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
        className="join w-full"
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
          placeholder={disabled ? "Solved" : "Type a bird, e.g. Blue Jay"}
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
          className="input input-lg join-item w-full min-w-0 flex-1 border-2 border-base-content text-base focus:outline-none focus-within:outline-none"
        />
        <button
          type="submit"
          disabled={disabled || !query.trim()}
          className="btn btn-primary btn-lg join-item border-2 border-base-content"
        >
          Guess
        </button>
      </form>

      {open && results.length > 0 && !disabled && (
        <ul
          id={listId}
          role="listbox"
          className="menu absolute z-10 mt-1 max-h-80 w-full flex-nowrap overflow-auto rounded-box border-2 border-base-content bg-base-100 p-1"
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
                className={already ? "opacity-40" : ""}
              >
                <div className={`flex items-baseline justify-between gap-3 ${i === active ? "menu-active" : ""}`}>
                  <span>{bird.common}</span>
                  <span className="sci truncate text-xs opacity-60">{bird.scientific}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="mt-1 text-sm text-error">{error}</p>}
    </div>
  );
}
