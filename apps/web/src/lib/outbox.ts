/**
 * Offline outbox for chat messages.
 *
 * When a user sends a message while offline (or the request times out),
 * we push the payload into an IndexedDB-backed queue and try to flush
 * whenever the browser goes back online. We deliberately DON'T use
 * localStorage — a single 5MB budget shared across the whole app is easy
 * to blow past with a queued voice note.
 *
 * The API accepts a `clientId` field on send; we round-trip it so the
 * server can dedupe if the client retries after a flaky ack.
 */

const DB_NAME = 'apex-outbox-v1';
const STORE = 'messages';

export interface OutboxItem {
  clientId: string; // stable per attempt
  conversationId: string;
  body?: string;
  attachmentUrl?: string;
  attachmentType?: string;
  attachmentMeta?: Record<string, unknown>;
  replyToId?: string;
  queuedAt: number; // ms epoch
  attempts: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'clientId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result: T | undefined;
    const maybe = fn(store);
    if (maybe)
      maybe.onsuccess = () => {
        result = maybe.result as T;
      };
    t.oncomplete = () => resolve(result as T);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function enqueue(item: Omit<OutboxItem, 'queuedAt' | 'attempts'>): Promise<void> {
  await tx('readwrite', (s) => s.put({ ...item, queuedAt: Date.now(), attempts: 0 }));
}

export async function remove(clientId: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(clientId));
}

export async function list(): Promise<OutboxItem[]> {
  if (typeof indexedDB === 'undefined') return [];
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly');
    const req = t.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as OutboxItem[]);
    req.onerror = () => reject(req.error);
  });
}

export async function bump(clientId: string): Promise<void> {
  await tx('readwrite', (s) => {
    const req = s.get(clientId);
    req.onsuccess = () => {
      const row = req.result as OutboxItem | undefined;
      if (row) s.put({ ...row, attempts: row.attempts + 1 });
    };
  });
}
