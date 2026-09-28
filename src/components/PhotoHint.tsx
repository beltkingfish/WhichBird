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
      <div className="rounded-xl border border-dashed border-line p-4 text-center text-xs text-muted">
        No photo on file for {mode === "daily" ? "today\u2019s" : "this"} bird. You&apos;ll have to find it by the tree alone.
      </div>
    );
  }

  if (!enabled && !solved) {
    return (
      <button
        onClick={onEnable}
        className="w-full rounded-xl border border-dashed border-line p-4 text-sm text-muted hover:border-accent hover:text-ink"
      >
        📷 Show a blurry photo hint
        <span className="block text-xs">It sharpens with every wrong guess (and shows up in your share)</span>
      </button>
    );
  }

  const blur = solved ? 0 : Math.max(3, 28 - wrongGuesses * 2.5);
  const gray = solved ? 0 : Math.max(0, 1 - wrongGuesses * 0.08);
  const credit = photo.photographer ?? photo.attribution;

  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-card shadow-sm">
      <div className="relative aspect-[3/2] max-h-72 w-full overflow-hidden bg-line">
        <img
          src={photo.url}
          alt={solved ? `${target.common} (${target.scientific})` : "Blurred photo of the mystery bird"}
          className="h-full w-full scale-110 object-cover transition-[filter] duration-700"
          style={{ filter: `blur(${blur}px) grayscale(${gray})` }}
          referrerPolicy="no-referrer"
        />
      </div>
      <figcaption className="px-3 py-2 text-[11px] leading-snug text-muted">
        {solved ? (
          <>
            {photo.attribution}
            {photo.pageUrl && (
              <>
                {" · "}
                <a href={photo.pageUrl} target="_blank" rel="noreferrer" className="underline">
                  {photo.source === "inaturalist" ? "iNaturalist" : "Wikimedia Commons"}
                </a>
              </>
            )}
          </>
        ) : (
          // Credit stays visible while blurred; the link waits until solved because its page names the bird.
          <>
            Photo: {credit} · {LICENSE_LABEL[photo.license]} · via {photo.source === "inaturalist" ? "iNaturalist" : "Wikimedia Commons"}
          </>
        )}
        {onDisable && (
          <button onClick={onDisable} className="ml-2 underline hover:text-ink">
            Don&apos;t auto-show next time
          </button>
        )}
      </figcaption>
    </figure>
  );
}
