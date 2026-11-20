import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RETRY_MS, WriteQueue } from "./write-queue";

/** A send() whose network can be cut and restored. */
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
    },
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("WriteQueue", () => {
  it("is Salvato when idle, In attesa while a write is in flight, Salvato once it lands", async () => {
    const server = fakeServer();
    const queue = new WriteQueue(server.send);
    expect(queue.status).toBe("saved");

    queue.enqueue("a");
    expect(queue.status).toBe("pending");
    await vi.runAllTimersAsync();
    expect(queue.status).toBe("saved");
    expect(server.received).toEqual(["a"]);
  });

  it("goes Offline when a write fails, keeps it, and retries every 30 s", async () => {
    const server = fakeServer();
    const queue = new WriteQueue(server.send);
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
    const queue = new WriteQueue(server.send);
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
    const queue = new WriteQueue(server.send);
    queue.reportUnreachable();
    expect(queue.status).toBe("offline");

    queue.enqueue("a");
    await vi.advanceTimersByTimeAsync(0);
    expect(server.received).toEqual(["a"]);
    expect(queue.status).toBe("saved");
  });

  it("tells subscribers when the status changes", async () => {
    const server = fakeServer();
    const queue = new WriteQueue(server.send);
    const seen: string[] = [];
    queue.subscribe(() => seen.push(queue.status));

    queue.enqueue("a");
    await vi.runAllTimersAsync();
    expect(seen).toEqual(["pending", "saved"]);
  });
});
