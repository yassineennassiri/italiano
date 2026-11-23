/**
 * This tab's settings (SPEC §10.1): the saved ones, with the settings writes
 * still queued laid over them until the server answers, as `LocalProgress`
 * does for exercises. A write shows when the learner changes a setting, and
 * again when a reload restores it from IndexedDB. Plain TypeScript.
 */
import type { ProgressResponse } from "@/progress/local";
import { DEFAULT_SETTINGS, type Settings, type SettingsWrite, withWrite } from "./settings";

/** The settings this tab uses, and the subscribers told of each change. */
export class LocalSettings {
  /** The settings as the server last sent them; undefined until it has. */
  private saved: Settings | undefined;
  /** Writes the server saved before it sent any settings: they hold over a page's stand-in. */
  private landedBeforeSaved: SettingsWrite[] = [];
  /** The writes not answered yet, oldest first. */
  private readonly pending: SettingsWrite[] = [];
  /** How many restored writes lead `pending`: they are older than this tab's own. */
  private restored = 0;
  private readonly listeners = new Set<() => void>();
  private changes = 0;

  /** Subscribes to every change, for `useSyncExternalStore`. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Changes on every change, for `useSyncExternalStore`. */
  get version(): number {
    return this.changes;
  }

  /**
   * The settings this tab uses: the saved ones and its unanswered writes over
   * them. Until the server has sent any, `standIn` (a page's own saved
   * settings) or the defaults take their place.
   */
  current(standIn: Settings = DEFAULT_SETTINGS): Settings {
    const saved = this.saved ?? this.landedBeforeSaved.reduce(withWrite, standIn);
    return this.pending.reduce(withWrite, saved);
  }

  /** The settings as the server has them now. */
  receive(saved: Settings): void {
    this.saved = saved;
    this.landedBeforeSaved = [];
    this.changed();
  }

  /** Shows a new write until the server answers it. */
  show(write: SettingsWrite): void {
    this.pending.push(write);
    this.changed();
  }

  /** Shows a write restored from IndexedDB after a reload: older than anything changed in this tab. */
  restore(write: SettingsWrite): void {
    this.pending.splice(this.restored++, 0, write);
    this.changed();
  }

  /** The server answered a write: once saved, it is part of the saved settings; otherwise it is dropped. */
  landed(write: SettingsWrite, response: Pick<ProgressResponse, "result">): void {
    const index = this.pending.indexOf(write);
    if (index === -1) return;
    this.pending.splice(index, 1);
    if (index < this.restored) this.restored--;
    if (response.result === "saved") {
      if (this.saved) this.saved = withWrite(this.saved, write);
      else this.landedBeforeSaved.push(write);
    }
    this.changed();
  }

  private changed(): void {
    this.changes++;
    for (const listener of this.listeners) listener();
  }
}
