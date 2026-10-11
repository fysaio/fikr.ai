import { z } from 'zod';
import {
  ProfileSchema,
  MemorySchema,
  TaskSchema,
  EntrySchema,
  FocusSessionSchema,
  CheckinSchema,
  PushSubscriptionSchema,
  NudgeLogSchema,
  MemoryCategorySchema,
  ConfidenceLevelSchema,
  UISpecSchema,
  UITextSpecSchema,
  UIChipsSpecSchema,
  UIChoiceSpecSchema,
  UIRankSpecSchema,
  UIMemorySpecSchema,
  UITimeSpecSchema,
  UITimerSpecSchema,
  MemoryHistoryEntrySchema,
} from '@/lib/validation/schemas';

export type Profile = z.infer<typeof ProfileSchema>;
export type Memory = z.infer<typeof MemorySchema>;
export type MemoryHistoryEntry = z.infer<typeof MemoryHistoryEntrySchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Entry = z.infer<typeof EntrySchema>;
export type FocusSession = z.infer<typeof FocusSessionSchema>;
export type Checkin = z.infer<typeof CheckinSchema>;
export type PushSubscription = z.infer<typeof PushSubscriptionSchema>;
export type NudgeLog = z.infer<typeof NudgeLogSchema>;

export type MemoryCategory = z.infer<typeof MemoryCategorySchema>;
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

export type UISpec = z.infer<typeof UISpecSchema>;
export type UITextSpec = z.infer<typeof UITextSpecSchema>;
export type UIChipsSpec = z.infer<typeof UIChipsSpecSchema>;
export type UIChoiceSpec = z.infer<typeof UIChoiceSpecSchema>;
export type UIRankSpec = z.infer<typeof UIRankSpecSchema>;
export type UIMemorySpec = z.infer<typeof UIMemorySpecSchema>;
export type UITimeSpec = z.infer<typeof UITimeSpecSchema>;
export type UITimerSpec = z.infer<typeof UITimerSpecSchema>;

export interface QuestionSpec {
  q: string;
  spec: UISpec;
  sample?: any;
  add: (v: any) => [string, string][];
}

export interface ChatItem {
  id: number;
  t: string;
  age: number;
  sn: string;
  mem?: number;
  open?: number;
  pin?: boolean;
}

export interface AppState {
  name: string;
  ans: Record<number, any>;
  firstDone: boolean;
  done: Record<string | number, boolean>;
  /** When each task was marked done (ISO). Yesterday reads this. */
  doneAt?: Record<string | number, string>;
  showDone: boolean;
  undone: Record<number, boolean>;
  all: boolean;
  log: Array<{
    msg: string;
    kind?: string;
    done?: boolean;
    outcome?: string;
    reply?: string;
    tid?: string | number;
    sys?: boolean;
    queued?: boolean;
    loading?: boolean;
    step?: any;
    q?: string;
    tr?: Array<{ q?: string; a?: string }>;
  }>;
  compact: boolean;
  hist: Array<{
    label: string;
    items: Array<{ msg: string; outcome: string }>;
  }>;
  net: 'online' | 'offline' | 'slow' | 'error';
  queue: number;
  synced: number;
  theme: 'dark' | 'light' | 'auto';
  nudge: string;
  tomorrow?: string[];
  touched?: boolean;
  fresh?: boolean;
  eveDone?: boolean;
  /** Local date (YYYY-MM-DD) the evening card was closed or skipped. The card shows once a day. */
  eveDate?: string;
  eve1?: boolean;
  chats?: ChatItem[] | null;
  life?: Record<string, Memory[]> | null;
  tasks?: Task[];
}
