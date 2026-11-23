"use client";

import { useEffect, useSyncExternalStore } from "react";
import { currentSettings, receiveSettings, refreshSettings, settingsVersion, subscribeSettings } from "@/progress/client";
import type { Settings } from "@/settings/settings";

/**
 * This tab's synced settings (SPEC §10.1), re-rendering when they change.
 * With `saved`, the settings the page read from the server, those count from
 * the first render; without, the component asks the server for them once it
 * mounts, so a scene player that opens gets the latest ones, also when they
 * were changed on the other computer. Until then the defaults hold.
 */
export function useSettings(saved?: Settings): Settings {
  // Re-render on every change; the server snapshot has none.
  useSyncExternalStore(subscribeSettings, settingsVersion, () => 0);
  useEffect(() => {
    if (saved) receiveSettings(saved);
    else void refreshSettings();
  }, [saved]);
  return currentSettings(saved);
}
