import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Queued, RETRY_MS, type TabMessage, type Tabs, WriteQueue, type WriteStore } from "./write-queue";

/** A send() whose network can be cut and restored. It answers each write with `ok:<write>`. */
function fakeServer() {
  const received: string[] = [];
  let up = true;
  return {
    received,
    cut: () => (up = false),
    restore: () => (up = true),
    send: async (write: string) => {
      await Promise.resolve();
      if (!up) throw new Error("fetch failed");
      received.push(write);
      return `ok:${write}`;
    },
  };
}

/** A store that survives a reload, like IndexedDB: the tabs of one fake browser share it. */
class DurableStore implements WriteStore<string> {
  readonly durable = true;
  private queued: Queued<string>[] = [];
  async add(queued: Queued<string>) {
    this.queued.push(queued);
  }
  async list() {
    return [...this.queued];
  }
  async remove(id: string) {
    this.queued = this.queued.filter((queued) => queued.id !== id);
  }
  writes = () => this.queued.map(({ write }) => write);
}

/** One browser: a shared store, one lock (Web Locks) and one channel (BroadcastChannel) between its tabs. */
function fakeBrowser() {
  const store = new DurableStore();
  let lock = Promise.resolve();
  const receivers = new Set<(message: TabMessage<string>) => void>();
  const tabs = (): Tabs<string> => {
    let own: ((message: TabMessage<string>) => void) | undefined;
    return {
      lock: (lead) => {
        lock = lock.then(lead);
      },
      post: (message) => {
        // Like BroadcastChannel: a copy, later, to every other tab.
        const copy = structuredClone(message);
        for (const receive of receivers) if (receive !== own) void Promise.resolve().then(() => receive(copy));
      },
      listen: (receive) => {
        own = receive;
        receivers.add(receive);
        return () => receivers.delete(receive);
      },
    };
  };
  return { store, tabs };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("WriteQueue in memory (no IndexedDB)", () => {
  it("is Salvato when idle, In attesa while a write is in flight, Salvato once it lands", async () => {
    const server = fakeServer();
    const queue = new WriteQueue({ send: server.send });
    expect(queue.status).toBe("saved");

    queue.enqueue("a");
    expect(queue.status).toBe("pending");
    await vi.runAllTimersAsync();
    expect(queue.status).toBe("saved");
    expect(server.received).toEqual(["a"]);
  });

  it("goes Offline: non salvato when a write fails, keeps it, and retries every 30 s", async () => {
    const server = fakeServer();
    const queue = new WriteQueue({ send: server.send });
    server.cut();

    queue.enqueue("a");
    await vi.advanceTimersByTimeAsync(0);
    expect(queue.status).toBe("offline");

    await vi.advanceTimersByTimeAsync(RETRY_MS - 1_000);
    expect(server.received).toEqual([]);
    server.restore();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(server.received).toEqual(["a"]);
    expect(queue.status).toBe("saved");
  });

  it("flushes at once when the browser comes back online, in order", async () => {
    const server = fakeServer();
    const queue = new WriteQueue({ send: server.send });
    server.cut();
    queue.enqueue("a");
    await vi.advanceTimersByTimeAsync(0);
    queue.enqueue("b");
    expect(queue.status).toBe("offline");

    server.restore();
    queue.online();
    await vi.advanceTimersByTimeAsync(0);
    expect(server.received).toEqual(["a", "b"]);
    expect(queue.status).toBe("saved");
    await vi.advanceTimersByTimeAsync(RETRY_MS);
    expect(server.received).toEqual(["a", "b"]);
  });

  it("shows Offline when progress could not be loaded, and sends the next write at once", async () => {
    const server = fakeServer();
    const queue = new WriteQueue({ send: server.send });
    queue.reportUnreachable();
    expect(queue.status).toBe("offline");

    queue.enqueue("a");
    await vi.advanceTimersByTimeAsync(0);
    expect(server.received).toEqual(["a"]);
    expect(queue.status).toBe("saved");
  });

  it("tells subscribers when the status changes", async () => {
    const server = fakeServer();
    const queue = new WriteQueue({ send: server.send });
    const seen: string[] = [];
    queue.subscribe(() => seen.push(queue.status));

    queue.enqueue("a");
    await vi.runAllTimersAsync();
    expect(seen).toEqual(["pending", "saved"]);
  });

  it("hands each write and the server's answer to `landed`, in order", async () => {
    const server = fakeServer();
    const landed: string[] = [];
    const queue = new WriteQueue({ send: server.send, landed: (write, response) => landed.push(`${write}→${response}`) });
    queue.enqueue("a");
    queue.enqueue("b");
    await vi.runAllTimersAsync();
    expect(landed).toEqual(["a→ok:a", "b→ok:b"]);
  });
});

describe("WriteQueue.settled", () => {
  it("resolves at once when nothing is queued", async () => {
    const queue = new WriteQueue({ send: fakeServer().send });
    await expect(queue.settled()).resolves.toBe("saved");
  });

  it("resolves once the queued writes have landed", async () => {
    const server = fakeServer();
    const queue = new WriteQueue({ send: server.send });
    queue.enqueue("a");
    queue.enqueue("b");
    const settled = queue.settled();
    await vi.runAllTimersAsync();
    await expect(settled).resolves.toBe("saved");
    expect(server.received).toEqual(["a", "b"]);
  });

  it("resolves as offline when a write fails, rather than waiting for the retry", async () => {
    const server = fakeServer();
    const queue = new WriteQueue({ send: server.send });
    server.cut();
    queue.enqueue("a");
    const settled = queue.settled();
    await vi.advanceTimersByTimeAsync(0);
    await expect(settled).resolves.toBe("offline");
  });
});

describe("WriteQueue with a durable store (IndexedDB)", () => {
  it("stores a write before sending it and removes it once acknowledged", async () => {
    const browser = fakeBrowser();
    const held: string[][] = [];
    const queue = new WriteQueue({
      send: async (write: string) => {
        held.push(browser.store.writes());
        return `ok:${write}`;
      },
      store: Promise.resolve(browser.store),
      tabs: browser.tabs(),
    });
    queue.enqueue("a");
    await vi.advanceTimersByTimeAsync(0);
    expect(held).toEqual([["a"]]);
    expect(browser.store.writes()).toEqual([]);
    expect(queue.status).toBe("saved");
  });
});

describe("WriteQueue after a reload (IndexedDB)", () => {
  it("says Offline: salvato su questo computer while a stored write waits", async () => {
    const browser = fakeBrowser();
    const server = fakeServer();
    server.cut();
    const queue = new WriteQueue({ send: server.send, store: Promise.resolve(browser.store), tabs: browser.tabs() });
    queue.enqueue("a");
    await vi.advanceTimersByTimeAsync(0);
    expect(queue.status).toBe("stored");
    await expect(queue.settled()).resolves.toBe("stored");
  });

  it("restores the writes left by the last visit, then replays them in order before new ones", async () => {
    const browser = fakeBrowser();
    const server = fakeServer();
    server.cut();
    const before = new WriteQueue({ send: server.send, store: Promise.resolve(browser.store), tabs: browser.tabs() });
    before.enqueue("a");
    before.enqueue("b");
    await vi.advanceTimersByTimeAsync(0);
    before.close();

    server.restore();
    const restored: string[] = [];
    const landed: string[] = [];
    const after = new WriteQueue({
      send: server.send,
      restore: (write) => restored.push(write),
      landed: (write) => landed.push(write),
      store: Promise.resolve(browser.store),
      tabs: browser.tabs(),
    });
    after.enqueue("c");
    await vi.advanceTimersByTimeAsync(0);
    expect(restored).toEqual(["a", "b"]);
    expect(server.received).toEqual(["a", "b", "c"]);
    expect(landed).toEqual(["a", "b", "c"]);
    expect(browser.store.writes()).toEqual([]);
    expect(after.status).toBe("saved");
  });

  it("keeps the stored writes when the reload is still offline, and replays them once back online", async () => {
    const browser = fakeBrowser();
    const server = fakeServer();
    server.cut();
    const before = new WriteQueue({ send: server.send, store: Promise.resolve(browser.store), tabs: browser.tabs() });
    before.enqueue("a");
    await vi.advanceTimersByTimeAsync(0);
    before.close();

    const after = new WriteQueue({ send: server.send, store: Promise.resolve(browser.store), tabs: browser.tabs() });
    await vi.advanceTimersByTimeAsync(0);
    expect(after.status).toBe("stored");
    expect(browser.store.writes()).toEqual(["a"]);

    server.restore();
    after.online();
    await vi.advanceTimersByTimeAsync(0);
    expect(server.received).toEqual(["a"]);
    expect(after.status).toBe("saved");
  });
});

describe("WriteQueue with two tabs", () => {
  it("flushes from one tab only, and tells the other tab when its writes land", async () => {
    const browser = fakeBrowser();
    const sentBy: string[] = [];
    const tab = (name: string, landed: string[]) =>
      new WriteQueue({
        send: async (write: string) => {
          sentBy.push(`${name}:${write}`);
          return `ok:${write}`;
        },
        landed: (write, response) => landed.push(`${write}→${response}`),
        store: Promise.resolve(browser.store),
        tabs: browser.tabs(),
      });
    const firstLanded: string[] = [];
    const secondLanded: string[] = [];
    const first = tab("first", firstLanded);
    const second = tab("second", secondLanded);
    await vi.advanceTimersByTimeAsync(0);

    first.enqueue("a");
    second.enqueue("b");
    await vi.advanceTimersByTimeAsync(0);
    expect(sentBy).toEqual(["first:a", "first:b"]);
    expect(firstLanded).toEqual(["a→ok:a"]);
    expect(secondLanded).toEqual(["b→ok:b"]);
    expect(second.status).toBe("saved");
  });

  it("shows the other tab Offline: salvato su questo computer while the flushing tab is offline", async () => {
    const browser = fakeBrowser();
    const server = fakeServer();
    server.cut();
    const first = new WriteQueue({ send: server.send, store: Promise.resolve(browser.store), tabs: browser.tabs() });
    const second = new WriteQueue({ send: server.send, store: Promise.resolve(browser.store), tabs: browser.tabs() });
    await vi.advanceTimersByTimeAsync(0);

    first.enqueue("a");
    await vi.advanceTimersByTimeAsync(0);
    second.enqueue("b");
    await vi.advanceTimersByTimeAsync(0);
    expect(second.status).toBe("stored");

    server.restore();
    await vi.advanceTimersByTimeAsync(RETRY_MS);
    expect(server.received).toEqual(["a", "b"]);
    expect(first.status).toBe("saved");
    expect(second.status).toBe("saved");
  });

  it("hands the flushing to the other tab when the flushing tab closes", async () => {
    const browser = fakeBrowser();
    const server = fakeServer();
    server.cut();
    const first = new WriteQueue({ send: server.send, store: Promise.resolve(browser.store), tabs: browser.tabs() });
    const secondLanded: string[] = [];
    const second = new WriteQueue({
      send: server.send,
      landed: (write) => secondLanded.push(write),
      store: Promise.resolve(browser.store),
      tabs: browser.tabs(),
    });
    await vi.advanceTimersByTimeAsync(0);
    second.enqueue("b");
    await vi.advanceTimersByTimeAsync(0);
    expect(server.received).toEqual([]);

    server.restore();
    first.close();
    await vi.advanceTimersByTimeAsync(0);
    expect(server.received).toEqual(["b"]);
    expect(secondLanded).toEqual(["b"]);
    expect(second.status).toBe("saved");
  });
});
