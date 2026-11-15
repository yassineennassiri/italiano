import { contentVersion } from "@/content/version";
import { ui } from "@/ui-it";

/**
 * The minimal footer (SPEC §3.1): app name, content version and a slot for the
 * sync status (Salvato / In attesa / Offline: non salvato), filled once
 * progress is saved.
 */
export function Footer() {
  return (
    <footer className="mt-12 bg-tint">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-4 text-sm text-muted">
        <span className="font-semibold text-brand">{ui.appName}</span>
        <span>{ui.footer.contentVersion(contentVersion())}</span>
        <span role="status" aria-live="polite" data-slot="sync-status" />
      </div>
    </footer>
  );
}
