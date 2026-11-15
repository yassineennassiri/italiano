/** A down chevron that turns up when its panel is open. */
export function ChevronIcon({ open, className = "size-6" }: { open: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`transition ${open ? "rotate-180" : ""} ${className}`} aria-hidden="true" focusable="false">
      <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
