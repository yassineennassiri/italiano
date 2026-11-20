import type { ReactNode } from "react";

/** An item's prompt: a speech bubble with an accent border and a tail on the left (SPEC §4.2, §7.1). */
export function PromptBubble({ children }: { children: ReactNode }) {
  return (
    <p className="relative ml-2 inline-block rounded-lg border-2 border-accent bg-background px-4 py-3 font-semibold text-brand after:absolute after:-left-[9px] after:bottom-3 after:size-4 after:rotate-45 after:border-b-2 after:border-l-2 after:border-accent after:bg-background">
      {children}
    </p>
  );
}
