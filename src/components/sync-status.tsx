"use client";

import { useSyncExternalStore } from "react";
import { progressQueue } from "@/progress/client";
import { ui } from "@/ui-it";

/** The footer's sync status (SPEC §3.1, §8): Salvato, In attesa or Offline: non salvato. */
export function SyncStatus() {
  const status = useSyncExternalStore(
    (listener) => progressQueue.subscribe(listener),
    () => progressQueue.status,
    () => "saved" as const,
  );
  return (
    <span role="status" aria-live="polite" className={status === "offline" ? "font-semibold text-bad" : undefined}>
      {ui.footer.sync[status]}
    </span>
  );
}
