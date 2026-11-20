import { contentVersion } from "@/content/version";
import { ui } from "@/ui-it";
import { SyncIndicator } from "./sync-indicator";

/**
 * The minimal footer (SPEC §3.1): app name, content version and the sync
 * status (Salvato / In attesa / Offline: non salvato).
 */
export function Footer() {
  return (
    <footer className="mt-12 bg-tint">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-4 text-sm text-muted">
        <span className="font-semibold text-brand">{ui.appName}</span>
        <span>{ui.footer.contentVersion(contentVersion())}</span>
        <SyncIndicator />
      </div>
    </footer>
  );
}
