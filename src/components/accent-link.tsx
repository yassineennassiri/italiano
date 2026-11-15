import Link from "next/link";
import type { ReactNode } from "react";

/** The accent call to action (Inizia, Avanti, …): a focaccia-yellow pill (SPEC §7.1). */
export function AccentLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={`inline-block rounded-full bg-accent px-8 py-2 font-bold text-foreground hover:brightness-95 ${className}`}
    >
      {children}
    </Link>
  );
}
