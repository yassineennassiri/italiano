/** The play and pause icons of the scene player and the clip player (SPEC §11.3). */
export const PLAY_PATH = "M8 5 L19 12 L8 19 Z";
export const PAUSE_PATH = "M7 5 H10.5 V19 H7 Z M13.5 5 H17 V19 H13.5 Z";

/** A 24 × 24 icon from one SVG path, hidden from screen readers (its button carries the label). */
export function PlayerIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" focusable="false">
      <path d={path} fill="currentColor" />
    </svg>
  );
}
