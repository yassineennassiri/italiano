import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsForm } from "@/components/settings-form";
import { readSettings } from "@/progress/read";
import { ui } from "@/ui-it";

export const metadata: Metadata = { title: ui.settings.pageTitle };

/** Impostazioni (SPEC §3, §10.1), reached from the hamburger. */
export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold text-brand">{ui.settings.heading}</h1>
      <Suspense fallback={null}>
        <SavedSettings />
      </Suspense>
    </div>
  );
}

async function SavedSettings() {
  const { settings, loaded } = await readSettings();
  return <SettingsForm saved={settings} loaded={loaded} />;
}
