import { flushOutbox } from '@/lib/outbox/tell';
import { outboxClear } from '@/lib/outbox/outbox';

/** Send what is waiting (briefly), then wipe everything stored on this device. Used on logout and delete. */
export async function clearDevice(opts: { flush: boolean }): Promise<void> {
  if (opts.flush && typeof navigator !== 'undefined' && navigator.onLine) {
    await Promise.race([flushOutbox({ history: [], facts: [] }, () => {}), new Promise((r) => setTimeout(r, 4000))]).catch(() => {});
  }
  await outboxClear();
  try {
    if (typeof caches !== 'undefined') await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
  } catch { /* ignore */ }
  try {
    const dbs = (await indexedDB.databases?.()) || [];
    await Promise.all(dbs.map((d) => new Promise<void>((res) => { if (!d.name) return res(); const r = indexedDB.deleteDatabase(d.name); r.onsuccess = r.onerror = r.onblocked = () => res(); })));
  } catch { /* ignore */ }
  try { sessionStorage.clear(); Object.keys(localStorage).filter((k) => k.startsWith('gist_') || k.startsWith('fikr_') || k === 'cil-theme').forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
}
