"use client";

import type { Bird } from "@/lib/types";

const LICENSE_LABEL: Record<string, string> = {
  cc0: "CC0",
  "cc-by": "CC BY",
  "cc-by-sa": "CC BY-SA",
  "public-domain": "Public domain",
};

interface Props {
  mode: "daily" | "practice";
  target: Bird;
  wrongGuesses: number;
  solved: boolean;
  enabled: boolean;
  onEnable: () => void;
  /** Present when photo hints are on by preference: turns them off for future rounds. */
  onDisable?: () => void;
}

/** Blurred, desaturated photo of the target that comes into focus with every wrong guess. */
export function PhotoHint({ mode, target, wrongGuesses, solved, enabled, onEnable, onDisable }: Props) {
  const photo = target.photo;
  if (!photo) {
    return (
      <p className="rounded-box border border-dashed border-base-300 px-3 py-2 text-xs text-base-content/60">
        No photo on file for {mode === "daily" ? "today's" : "this"} bird.
      </p>
    );
  }

  if (!enabled && !solved) {
    return (
      <button onClick={onEnable} className="btn btn-outline btn-block justify-between font-normal">
        <span>Show photo hint</span>
        <span className="text-xs text-base-content/60">blurred, sharpens with each guess</span>
      </button>
    );
  }

  const blur = solved ? 0 : Math.max(3, 28 - wrongGuesses * 2.5);
  const gray = solved ? 0 : Math.max(0, 1 - wrongGuesses * 0.08);
  const credit = photo.photographer ?? photo.attribution;
  const source = photo.source === "inaturalist" ? "iNaturalist" : "Wikimedia Commons";

  return (
    <figure className="overflow-hidden rounded-box border border-base-300">
      <div className="relative aspect-[3/2] max-h-72 w-full overflow-hidden bg-base-300">
        <img
          src={photo.url}
          alt={solved ? `${target.common} (${target.scientific})` : "Blurred photo of the mystery bird"}
          className="h-full w-full scale-110 object-cover transition-[filter] duration-700"
          style={{ filter: `blur(${blur}px) grayscale(${gray})` }}
          referrerPolicy="no-referrer"
        />
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[11px] leading-snug text-base-content/60">
        <span>
          {solved ? (
            <>
              {photo.attribution}
              {photo.pageUrl && (
                <>
                  {", "}
                  <a href={photo.pageUrl} target="_blank" rel="noreferrer" className="link">
                    {source}
                  </a>
                </>
              )}
            </>
          ) : (
            // Credit stays visible while blurred; the link waits until solved because its page names the bird.
            <>
              Photo: {credit}, {LICENSE_LABEL[photo.license]}, via {source}
            </>
          )}
        </span>
        {onDisable && (
          <button onClick={onDisable} className="link">
            Don&apos;t show by default
          </button>
        )}
      </figcaption>
    </figure>
  );
}
