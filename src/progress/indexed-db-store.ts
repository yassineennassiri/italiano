/**
 * The write queue's IndexedDB store (SPEC §8): writes wait here until the
 * server has them, so they survive a reload. The tabs of the app share it.
 * Plain TypeScript over the browser's IndexedDB: no React, no Next.js.
 */
import type { Queued, WriteStore } from "./write-queue";

const DATABASE = "italiano-progress";
const STORE = "writes";
const VERSION = 1;

/** A stored write: `seq` is IndexedDB's auto-incremented key, which keeps the order across tabs. */
type Row<W> = Queued<W> & { seq?: number };

class IndexedDbStore<W> implements WriteStore<W> {
  readonly durable = true;

  constructor(private readonly db: IDBDatabase) {
    // Another tab opened a newer version of the app: let it upgrade the database.
    db.onversionchange = () => db.close();
  }

  async add({ id, write }: Queued<W>): Promise<void> {
    await this.run("readwrite", (store) => store.add({ id, write } satisfies Row<W>));
  }

  async list(): Promise<Queued<W>[]> {
    const rows = await this.run<Row<W>[]>("readonly", (store) => store.getAll());
    return rows.map(({ id, write }) => ({ id, write }));
  }

  async remove(id: string): Promise<void> {
    await this.run("readwrite", (store) => {
      const key = store.index("id").getKey(id);
      key.onsuccess = () => {
        if (key.result !== undefined) store.delete(key.result);
      };
    });
  }

  /** Runs one transaction; resolves with the request's result once it has committed. */
  private run<T>(mode: IDBTransactionMode, body: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(STORE, mode);
      const request = body(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request?.result as T);
      transaction.onerror = transaction.onabort = () => reject(transaction.error);
    });
  }
}

/**
 * Opens the store, or resolves undefined without IndexedDB (a private window,
 * blocked storage): the queue then keeps its writes in memory (M1).
 */
export function openIndexedDbStore<W>(factory: IDBFactory | undefined): Promise<WriteStore<W> | undefined> {
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      if (!factory) return resolve(undefined);
      request = factory.open(DATABASE, VERSION);
    } catch {
      return resolve(undefined);
    }
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: "seq", autoIncrement: true });
      store.createIndex("id", "id", { unique: true });
    };
    request.onsuccess = () => resolve(new IndexedDbStore<W>(request.result));
    request.onerror = () => resolve(undefined);
  });
}
