/** The Lanterna, Genoa's lighthouse: two stacked square towers on a rock, with the lantern on top. */
export function LanternaLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 40" className={className} aria-hidden="true" focusable="false">
      {/* light beams */}
      <path d="M16 5 L2 1 L2 9 Z M16 5 L30 1 L30 9 Z" fill="var(--accent)" opacity="0.7" />
      {/* dome and lantern */}
      <path d="M13 4 Q16 1 19 4 Z" fill="var(--brand)" />
      <rect x="13" y="4" width="6" height="4" fill="var(--accent)" stroke="var(--brand)" strokeWidth="1" />
      {/* upper tower with its balcony */}
      <rect x="11.5" y="8" width="9" height="1.5" fill="var(--brand)" />
      <path d="M12.5 9.5 H19.5 L20 20 H12 Z" fill="var(--brand)" />
      {/* lower tower with its balcony */}
      <rect x="10" y="20" width="12" height="1.5" fill="var(--brand)" />
      <path d="M11 21.5 H21 L22 34 H10 Z" fill="var(--brand)" />
      <rect x="15" y="25" width="2" height="3" fill="#ffffff" />
      {/* rock */}
      <path d="M4 40 Q8 33 16 34 Q24 33 28 40 Z" fill="var(--panel)" />
    </svg>
  );
}
