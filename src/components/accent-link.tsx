import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";

/** The accent call to action (Inizia, Avanti, …): a focaccia-yellow pill (SPEC §7.1). */
export function AccentLink({
  href,
  children,
  className = "",
  onClick,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  /** For a link that must do something before it navigates (it calls `preventDefault`). */
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`inline-block rounded-full bg-accent px-8 py-2 font-bold text-foreground hover:brightness-95 ${className}`}
    >
      {children}
    </Link>
  );
}
