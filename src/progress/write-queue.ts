/**
 * The write queue behind optimistic progress (SPEC §8): the UI updates first,
 * writes follow in order. A write is stored before it is sent and removed once
 * the server has answered it. A failed write stays at the head and is retried
 * every 30 s, or at once when the browser comes back online.
 *
 * With IndexedDB the store survives a reload: on load the stored writes are
 * handed to `restore` (to lay them over the server's state), then replayed.
 * The tabs share that store, so only one of them flushes it: the tab holding
 * the queue's Web Lock. It tells the other tabs when their writes land.
 * Without IndexedDB each tab keeps its writes in memory and flushes them
 * itself (M1). Plain TypeScript: no React, no Next.js.
 */

/**
 * Shown in the footer as *Salvato*, *In attesa*, *Offline: non salvato*, or
 * *Offline: salvato su questo computer* while a failed write waits in IndexedDB.
 */
export type SyncStatus = "saved" | "pending" | "offline" | "stored";

export const RETRY_MS = 30_000;

/** A queued write and its id, unique across tabs. */
export type Queued<W> = { id: string; write: W };

/** Where writes wait until the server has them, oldest first. */
export interface WriteStore<W> {
  /** True when the writes survive a reload (IndexedDB). */
  readonly durable: boolean;
  add(queued: Queued<W>): Promise<void>;
  /** Every stored write, oldest first. */
  list(): Promise<Queued<W>[]>;
  remove(id: string): Promise<void>;
}

/** The M1 store: this tab's writes, lost when it closes. */
export class MemoryStore<W> implements WriteStore<W> {
  readonly durable = false;
  private queued: Queued<W>[] = [];

  async add(queued: Queued<W>): Promise<void> {
    this.queued.push(queued);
  }

  async list(): Promise<Queued<W>[]> {
    return [...this.queued];
  }

  async remove(id: string): Promise<void> {
    this.queued = this.queued.filter((queued) => queued.id !== id);
  }
}

/** What the tabs sharing a durable store tell each other. */
export type TabMessage<R> =
  /** A tab stored a write, or opened with stored writes: the flushing tab sends them, or says it is waiting. */
  | { type: "added" }
  /** The flushing tab got the server's answer to a write. */
  | { type: "landed"; id: string; response: R }
  /** Whether a failed write waits for its retry in the flushing tab. */
  | { type: "waiting"; waiting: boolean };

/** How a tab reaches the other tabs of the app (`browserTabs`). */
export type Tabs<R> = {
  /** Runs `lead` once this tab holds the queue's lock (Web Locks); the tab keeps it until `lead`'s promise settles. */
  lock: (lead: () => Promise<void>) => void;
  /** Sends a message to every other tab (BroadcastChannel). */
  post: (message: TabMessage<R>) => void;
  /** Receives the other tabs' messages; returns the function that stops. */
  listen: (receive: (message: TabMessage<R>) => void) => () => void;
};

/** What a queue needs: how to send a write, what to do with the answer, and where writes wait. */
export type WriteQueueOptions<W, R> = {
  /** Resolves with the server's answer once the write is stored there; throws when it should be retried. */
  send: (write: W) => Promise<R>;
  /** The server answered a write this tab queued or restored. Runs in that tab, whichever tab sent it. */
  landed?: (write: W, response: R) => void;
  /** A write found in the store on load, still waiting to be sent: shown before it is replayed. */
  restore?: (write: W) => void;
  /** The durable store, or undefined without IndexedDB. Writes wait in memory until it opens. */
  store?: Promise<WriteStore<W> | undefined>;
  /** The other tabs, for sharing a durable store. Without it, a durable store is this tab's alone. */
  tabs?: Tabs<R>;
};

/** Writes waiting to be sent, in order, with the footer status that goes with them. */
export class WriteQueue<W, R = void> {
  /** The writes this tab queued or restored that haven't landed yet, oldest first. */
  private readonly unlanded = new Map<string, W>();
  private readonly listeners = new Set<() => void>();
  /** Becomes a memory store if IndexedDB fails after opening. */
  private store: Promise<WriteStore<W>>;
  private durable = false;
  /** True in the one tab that flushes the store. */
  private leader = false;
  private tabs: Tabs<R> | undefined;
  private flushing = false;
  /** A write was stored during a flush: look again before stopping. */
  private rescan = false;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  /** A failed write waits for its retry, in this tab or in the flushing tab. */
  private waiting = false;
  /** The database couldn't be read, and no write has landed since. */
  private unreachable = false;
  private current: SyncStatus = "saved";
  private closed = false;
  /** Stop listening to the other tabs, and release the lock. */
  private cleanups: (() => void)[] = [];

  constructor(private readonly options: WriteQueueOptions<W, R>) {
    const store = options.store ?? Promise.resolve(undefined);
    this.store = store.then(
      (opened) => opened ?? new MemoryStore<W>(),
      () => new MemoryStore<W>(),
    );
    void this.start();
  }

  get status(): SyncStatus {
    return this.current;
  }

  /** Called whenever the status changes; returns the unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Stores a write, then sends it, unless a failed write is already waiting for its retry. */
  enqueue(write: W): void {
    const id = crypto.randomUUID();
    this.unlanded.set(id, write);
    this.update();
    void this.store.then((store) => this.add(store, { id, write }));
  }

  /**
   * Resolves once every write this tab queued has landed ("saved"), or as soon
   * as one fails ("offline" or "stored"): a failed write waits for its retry,
   * so the caller shouldn't. For moving on to a page that reads what was just written.
   */
  settled(): Promise<Exclude<SyncStatus, "pending">> {
    const now = this.idleStatus();
    if (now) return Promise.resolve(now);
    return new Promise((resolve) => {
      const unsubscribe = this.subscribe(() => {
        const status = this.idleStatus();
        if (!status) return;
        unsubscribe();
        resolve(status);
      });
    });
  }

  /** The database couldn't be read: show Offline until a write gets through. */
  reportUnreachable(): void {
    if (this.unlanded.size > 0) return;
    this.unreachable = true;
    this.update();
  }

  /** The browser's `online` event: retry now instead of waiting for the timer. */
  online(): void {
    if (this.leader && this.retryTimer !== undefined) void this.flush();
  }

  /** The tab is closing: stop flushing and hand the lock to another tab. A closed tab releases it anyway; tests close explicitly. */
  close(): void {
    this.closed = true;
    this.leader = false;
    clearTimeout(this.retryTimer);
    for (const cleanup of this.cleanups.splice(0)) cleanup();
  }

  /** Restores the stored writes, then flushes them, or waits for the lock when other tabs share the store. */
  private async start(): Promise<void> {
    const store = await this.store;
    this.durable = store.durable;
    const stored = await store.list().catch(() => []);
    for (const { id, write } of stored) {
      if (this.closed || this.unlanded.has(id)) continue;
      this.unlanded.set(id, write);
      this.options.restore?.(write);
    }
    this.update();
    const tabs = this.options.tabs;
    if (!store.durable || !tabs) return this.lead();
    if (this.closed) return;
    this.tabs = tabs;
    this.cleanups.push(tabs.listen((message) => this.receive(message)));
    // The flushing tab may already be waiting for a retry: it answers so.
    if (this.unlanded.size > 0) tabs.post({ type: "added" });
    tabs.lock(
      () =>
        new Promise<void>((release) => {
          this.cleanups.push(release);
          if (this.closed) release();
          else this.lead();
        }),
    );
  }

  private lead(): void {
    if (this.closed) return;
    this.leader = true;
    // Whoever flushed before is gone: nothing waits for its retry any more.
    this.tabs?.post({ type: "waiting", waiting: false });
    void this.flush();
  }

  private receive(message: TabMessage<R>): void {
    switch (message.type) {
      case "added":
        if (!this.leader) return;
        // The new write waits for the retry; its tab should say so.
        if (this.retryTimer !== undefined) this.tabs?.post({ type: "waiting", waiting: true });
        else this.kick();
        return;
      case "landed":
        this.land(message.id, message.response);
        return;
      case "waiting":
        if (this.leader) return;
        this.waiting = message.waiting;
        this.update();
        return;
    }
  }

  /** Stores a write, then has it sent: by this tab when it flushes, otherwise by the flushing tab. */
  private async add(store: WriteStore<W>, queued: Queued<W>): Promise<void> {
    try {
      await store.add(queued);
    } catch (error) {
      // The write is in `unlanded`, so the memory store gets it.
      this.storeFailed(error);
    }
    if (this.leader) this.kick();
    else this.tabs?.post({ type: "added" });
  }

  /**
   * IndexedDB failed after opening (storage full, or closed for a newer
   * version of the app): from now on this tab keeps its writes in memory and
   * flushes them itself (M1), starting with the ones it hasn't seen land.
   */
  private storeFailed(error: unknown): void {
    if (!this.durable) return;
    console.error("IndexedDB failed: this tab keeps its progress writes in memory from now on.", error);
    const memory = new MemoryStore<W>();
    for (const [id, write] of this.unlanded) void memory.add({ id, write });
    this.store = Promise.resolve(memory);
    this.durable = false;
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    this.tabs = undefined;
    this.waiting = false;
    this.leader = true;
    this.update();
  }

  /** Flushes, unless a retry is scheduled: new writes wait for it rather than hammering a dead network. */
  private kick(): void {
    if (this.retryTimer === undefined) void this.flush();
  }

  private async flush(): Promise<void> {
    if (this.flushing) {
      this.rescan = true;
      return;
    }
    this.flushing = true;
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    this.setWaiting(false);
    try {
      do {
        this.rescan = false;
        while (!this.closed) {
          const store = await this.store;
          let head: Queued<W> | undefined;
          try {
            [head] = await store.list();
          } catch (error) {
            this.storeFailed(error);
            continue;
          }
          if (!head) break;
          let response: R;
          try {
            response = await this.options.send(head.write);
          } catch {
            if (this.closed) return;
            // The timer first: listeners told of Offline see the write waiting for its retry.
            this.retryTimer = setTimeout(() => void this.flush(), RETRY_MS);
            this.setWaiting(true);
            return;
          }
          const removed = await store.remove(head.id).then(
            () => true,
            (error: unknown) => {
              console.error("A sent progress write could not be removed from IndexedDB.", error);
              return false;
            },
          );
          this.tabs?.post({ type: "landed", id: head.id, response });
          this.land(head.id, response);
          if (!removed) this.storeFailed(undefined);
        }
      } while (this.rescan && !this.closed);
    } finally {
      this.flushing = false;
    }
  }

  /** The server answered a write: settle it if this tab knows it. */
  private land(id: string, response: R): void {
    const write = this.unlanded.get(id);
    if (write === undefined) return;
    this.unlanded.delete(id);
    this.unreachable = false;
    this.options.landed?.(write, response);
    this.update();
  }

  /** This tab flushes: record whether a failed write waits, and tell the other tabs. */
  private setWaiting(waiting: boolean): void {
    if (waiting === this.waiting) return;
    this.waiting = waiting;
    this.tabs?.post({ type: "waiting", waiting });
    this.update();
  }

  /**
   * The Offline status while a failed write waits (in IndexedDB, whichever tab
   * made it), "saved" with nothing of this tab's queued, undefined while writes are in flight.
   */
  private idleStatus(): Exclude<SyncStatus, "pending"> | undefined {
    if (this.waiting) return this.durable ? "stored" : "offline";
    if (this.unlanded.size === 0) return "saved";
    return undefined;
  }

  private update(): void {
    const status: SyncStatus = this.idleStatus() ?? "pending";
    const shown = status === "saved" && this.unreachable ? "offline" : status;
    if (shown === this.current) return;
    this.current = shown;
    for (const listener of this.listeners) listener();
  }
}
