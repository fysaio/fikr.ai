import {
  syncMemoryWithSupabase,
  forgetMemoryWithSupabase,
  syncThinkEntryWithSupabase,
  syncCheckinWithSupabase,
} from './data-access';

export type QueuedSyncAction =
  | 'think_entry'
  | 'memory_create'
  | 'memory_update'
  | 'memory_forget'
  | 'checkin';

export interface QueuedSyncItem {
  id: string;
  action: QueuedSyncAction;
  payload: any;
  created_at: string;
  retry_count: number;
}

const QUEUE_STORAGE_KEY = 'fikr_offline_queue_v1';

export function getSyncQueue(): QueuedSyncItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Failed to read sync queue:', e);
    return [];
  }
}

export function saveSyncQueue(queue: QueuedSyncItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('Failed to save sync queue:', e);
  }
}

export function addToSyncQueue(
  action: QueuedSyncAction,
  payload: any,
  customId?: string
): QueuedSyncItem {
  const item: QueuedSyncItem = {
    id: customId || `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    action,
    payload,
    created_at: new Date().toISOString(),
    retry_count: 0,
  };

  const queue = getSyncQueue();
  // Deduplicate by customId if provided
  const filtered = customId ? queue.filter((q) => q.id !== customId) : queue;
  filtered.push(item);
  saveSyncQueue(filtered);

  // Dispatch custom event for immediate UI updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('fikr:queue-updated', { detail: { count: filtered.length } })
    );
  }

  return item;
}

export function removeFromSyncQueue(id: string): void {
  const queue = getSyncQueue();
  const filtered = queue.filter((item) => item.id !== id);
  saveSyncQueue(filtered);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('fikr:queue-updated', { detail: { count: filtered.length } })
    );
  }
}

export function getPendingQueueCount(): number {
  return getSyncQueue().length;
}

/**
 * Processes queued items when connectivity is restored
 */
export async function processSyncQueue(): Promise<{
  syncedCount: number;
  remainingCount: number;
}> {
  const queue = getSyncQueue();
  if (queue.length === 0) {
    return { syncedCount: 0, remainingCount: 0 };
  }

  let syncedCount = 0;
  const remainingQueue: QueuedSyncItem[] = [];

  for (const item of queue) {
    try {
      if (item.action === 'think_entry') {
        const { text, messageId } = item.payload;
        // 1. Sync to Supabase think_entries
        await syncThinkEntryWithSupabase({
          role: 'user',
          text,
          intent: 'heard',
        });

        // 2. Call /api/think to extract facts
        const res = await fetch('/api/think', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        });

        if (res.ok) {
          const data = await res.json();
          // Dispatch event with extracted facts so thread and memory update
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('fikr:think-synced', {
                detail: {
                  messageId,
                  text,
                  facts: data.extracted_facts || [],
                  reply: data.reply,
                  intent: data.intent,
                  outcome_line: data.outcome_line,
                },
              })
            );
          }
        }
        syncedCount++;
      } else if (item.action === 'memory_create') {
        await syncMemoryWithSupabase(item.payload);
        syncedCount++;
      } else if (item.action === 'memory_update') {
        await syncMemoryWithSupabase(item.payload);
        syncedCount++;
      } else if (item.action === 'memory_forget') {
        const { id, text } = item.payload;
        await forgetMemoryWithSupabase(id, text);
        syncedCount++;
      } else if (item.action === 'checkin') {
        await syncCheckinWithSupabase(item.payload);
        syncedCount++;
      }
    } catch (err) {
      console.warn(`Sync failed for item ${item.id}, action ${item.action}:`, err);
      item.retry_count++;
      if (item.retry_count < 5) {
        remainingQueue.push(item);
      }
    }
  }

  saveSyncQueue(remainingQueue);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('fikr:queue-updated', { detail: { count: remainingQueue.length } })
    );
  }

  return { syncedCount, remainingCount: remainingQueue.length };
}
