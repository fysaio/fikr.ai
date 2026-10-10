// Unsent Tell Fikr messages. IndexedDB, on this device only. Cleared on logout.
export interface OutboxItem { id: string; text: string; at: number }

const DB = 'fikr-outbox';
const STORE = 'messages';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no-idb'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(req.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
  }));
}

export async function outboxAdd(text: string): Promise<OutboxItem> {
  const item: OutboxItem = { id: `o_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, text, at: Date.now() };
  await run('readwrite', (s) => s.put(item));
  return item;
}
export async function outboxList(): Promise<OutboxItem[]> {
  try { return ((await run('readonly', (s) => s.getAll())) as OutboxItem[]).sort((a, b) => a.at - b.at); } catch { return []; }
}
export async function outboxRemove(id: string): Promise<void> { try { await run('readwrite', (s) => s.delete(id)); } catch { /* ignore */ } }
export async function outboxClear(): Promise<void> { try { await run('readwrite', (s) => s.clear()); } catch { /* ignore */ } }
