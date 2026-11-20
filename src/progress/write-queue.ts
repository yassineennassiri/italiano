/**
 * The in-memory write queue behind optimistic progress (SPEC §8, M1): the UI
 * updates first, writes follow in order. A failed write stays at the head and
 * is retried every 30 s, or at once when the browser comes back online, until
 * it lands or the tab closes. Plain TypeScript: no React, no Next.js.
 */

/** Shown in the footer as *Salvato*, *In attesa* or *Offline: non salvato*. */
export type SyncStatus = "saved" | "pending" | "offline";

export const RETRY_MS = 30_000;

/** Writes waiting to be sent, in order, with the footer status that goes with them. */
export class WriteQueue<W> {
  private readonly writes: W[] = [];
  private readonly listeners = new Set<() => void>();
  private flushing = false;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private current: SyncStatus = "saved";

  /** `send` resolves once the write is stored and throws when it should be retried. */
  constructor(private readonly send: (write: W) => Promise<void>) {}

  get status(): SyncStatus {
    return this.current;
  }

  /** Called whenever the status changes; returns the unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Queues a write and sends it, unless a failed write is already waiting for its retry. */
  enqueue(write: W): void {
    this.writes.push(write);
    // While a retry is scheduled, new writes wait for it rather than hammering a dead network.
    if (this.retryTimer === undefined) void this.flush();
  }

  /** The database couldn't be read: show Offline until a write gets through. */
  reportUnreachable(): void {
    if (this.writes.length === 0) this.setStatus("offline");
  }

  /** The browser's `online` event: retry now instead of waiting for the timer. */
  online(): void {
    if (this.retryTimer !== undefined) void this.flush();
  }

  private async flush(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    this.setStatus("pending");
    try {
      while (this.writes.length > 0) {
        try {
          await this.send(this.writes[0]);
        } catch {
          this.setStatus("offline");
          this.retryTimer = setTimeout(() => void this.flush(), RETRY_MS);
          return;
        }
        this.writes.shift();
      }
      this.setStatus("saved");
    } finally {
      this.flushing = false;
    }
  }

  private setStatus(status: SyncStatus): void {
    if (status === this.current) return;
    this.current = status;
    for (const listener of this.listeners) listener();
  }
}
