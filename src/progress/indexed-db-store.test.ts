import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { openIndexedDbStore } from "./indexed-db-store";

type Write = { type: string; at: string };
const write = (type: string): Write => ({ type, at: "2026-11-22T10:00:00.000Z" });

describe("openIndexedDbStore", () => {
  it("keeps writes in the order they were added, and removes one by its id", async () => {
    const store = await openIndexedDbStore<Write>(new IDBFactory());
    expect(store?.durable).toBe(true);
    await store!.add({ id: "1", write: write("exercise") });
    await store!.add({ id: "2", write: write("visit") });
    await store!.add({ id: "3", write: write("finish") });
    await store!.remove("2");
    expect(await store!.list()).toEqual([
      { id: "1", write: write("exercise") },
      { id: "3", write: write("finish") },
    ]);
  });

  it("still has the writes after a reload", async () => {
    const browser = new IDBFactory();
    const before = await openIndexedDbStore<Write>(browser);
    await before!.add({ id: "1", write: write("exercise") });
    const after = await openIndexedDbStore<Write>(browser);
    expect(await after!.list()).toEqual([{ id: "1", write: write("exercise") }]);
  });

  it("removing an unknown id changes nothing", async () => {
    const store = await openIndexedDbStore<Write>(new IDBFactory());
    await store!.add({ id: "1", write: write("exercise") });
    await store!.remove("missing");
    expect(await store!.list()).toHaveLength(1);
  });

  it("is undefined without IndexedDB, or when the browser refuses it (private window, blocked storage)", async () => {
    await expect(openIndexedDbStore(undefined)).resolves.toBeUndefined();
    const refusing = {
      open: () => {
        throw new DOMException("The user denied permission to access the database.", "SecurityError");
      },
    } as unknown as globalThis.IDBFactory;
    await expect(openIndexedDbStore(refusing)).resolves.toBeUndefined();
  });

  it("is undefined when opening the database fails", async () => {
    const failing = {
      open: () => {
        const request = { error: new DOMException("Storage is blocked.", "InvalidStateError") } as {
          error: DOMException;
          onerror?: () => void;
        };
        setTimeout(() => request.onerror?.());
        return request;
      },
    } as unknown as globalThis.IDBFactory;
    await expect(openIndexedDbStore(failing)).resolves.toBeUndefined();
  });
});
