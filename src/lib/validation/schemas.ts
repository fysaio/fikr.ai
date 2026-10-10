import { z } from 'zod';

export const MemoryCategorySchema = z.enum([
  'people',
  'projects',
  'goals',
  'commitments',
  'places',
  'prefs',
  'history',
  'patterns',
]);

export const ConfidenceLevelSchema = z.enum([
  'known',
  'stated',
  'observed',
  'hypothesized',
]);

export const MemoryStatusSchema = z.enum(['active', 'rejected', 'deleted']);

export const TaskStatusSchema = z.enum(['open', 'done', 'moved']);
export const TaskSourceSchema = z.enum(['ai', 'user']);

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().default(''),
  age_verified: z.boolean().default(false),
  timezone: z.string().default('UTC'),
  nudge_level: z.string().default('Morning, and when it helps'),
  quiet_start: z.string().default('22:00'),
  quiet_end: z.string().default('07:00'),
  theme: z.enum(['dark', 'light', 'auto']).default('dark'),
  onboarding_status: z.enum(['not_started', 'in_progress', 'complete', 'skipped']).default('not_started'),
  created_at: z.string().optional(),
});

export const MemoryHistoryEntrySchema = z.object({
  action: z.string(), // 'created' | 'edited' | 'corrected' | 'confirmed' | 'rejected' | 'merged'
  at: z.string(),
  note: z.string().optional(),
  previous_text: z.string().optional(),
});

export const MemorySchema = z.object({
  id: z.string(),
  user_id: z.string().uuid().optional(),
  category: MemoryCategorySchema,
  text: z.string().min(1),
  confidence: ConfidenceLevelSchema,
  source: z.string().default(''),
  evidence: z.array(z.string()).default([]),
  status: MemoryStatusSchema.default('active'),
  when_label: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  gone: z.boolean().optional(),
  rejected: z.boolean().optional(),
  snooze: z.boolean().optional(),
  history: z.array(MemoryHistoryEntrySchema).optional(),
});

export const TaskSchema = z.object({
  id: z.union([z.string(), z.number()]),
  user_id: z.string().uuid().optional(),
  title: z.string().min(1),
  starts_at: z.string().optional(),
  at: z.string().optional(), // Prototype time string '10:15'
  duration_min: z.number().int().positive().default(25),
  dur: z.number().optional(), // Prototype shorthand
  in: z.number().optional(), // Minutes from now
  why: z.string().default(''),
  status: TaskStatusSchema.default('open'),
  source: TaskSourceSchema.default('user'),
  mine: z.boolean().optional(),
  created_at: z.string().optional(),
});

export const EntrySchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  message: z.string(),
  kind: z.string().optional(),
  transcript: z.array(z.record(z.string(), z.any())).default([]),
  outcome: z.string().default(''),
  queued: z.boolean().default(false),
  created_at: z.string().optional(),
});

export const FocusSessionSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  task_id: z.string().uuid().optional(),
  started_at: z.string(),
  planned_min: z.number().int().positive(),
  actual_min: z.number().int().nullable().optional(),
});

export const CheckinSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  date: z.string(),
  answers: z.record(z.string(), z.any()).default({}),
  created_at: z.string().optional(),
});

export const PushSubscriptionSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

export const NudgeLogSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  task_id: z.string().uuid(),
  type: z.string(),
  sent_at: z.string(),
});

// UI Spec Schemas
export const UITextSpecSchema = z.object({
  type: z.literal('text'),
  ph: z.string().optional(),
  initialValue: z.string().optional(),
});

export const UIChipsSpecSchema = z.object({
  type: z.literal('chips'),
  options: z.array(z.string()),
});

export const UIChoiceSpecSchema = z.object({
  type: z.literal('choice'),
  options: z.array(z.string()),
});

export const UIRankSpecSchema = z.object({
  type: z.literal('rank'),
  items: z.array(z.string()),
});

export const UIMemorySpecSchema = z.object({
  type: z.literal('memory'),
  text: z.string(),
});

export const UITimeSpecSchema = z.object({
  type: z.literal('time'),
  title: z.string(),
});

export const UITimerSpecSchema = z.object({
  type: z.literal('timer'),
  task: z.object({
    id: z.union([z.string(), z.number()]),
    t: z.string(),
    at: z.string(),
    dur: z.number(),
  }),
});

export const UISpecSchema = z.discriminatedUnion('type', [
  UITextSpecSchema,
  UIChipsSpecSchema,
  UIChoiceSpecSchema,
  UIRankSpecSchema,
  UIMemorySpecSchema,
  UITimeSpecSchema,
  UITimerSpecSchema,
]);

// Auth and User Inputs
export const AuthInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const YouInputSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z.number().int().min(1).max(120),
});

export const AIOnboardingResponseSchema = z.object({
  extracted_facts: z.array(z.object({
    category: z.enum(['people', 'projects', 'commitments', 'how_i_work', 'overtime', 'prefs', 'places']),
    value: z.string(),
    epistemic_state: z.enum(['stated', 'observed', 'hypothesized']).default('stated'),
  })).describe("Facts extracted from the user's latest response."),
  
  next_question: z.string().describe("The natural, conversational follow-up question."),
  
  ui_spec: z.object({
    type: z.enum(['text', 'chips', 'choice']),
    ph: z.string().optional().describe("Placeholder text if type is 'text'"),
    options: z.array(z.string()).optional().describe("Options if type is 'chips' or 'choice'"),
  }).describe("The UI component specification required to answer the next_question."),
  
  is_complete: z.boolean().describe("True if sufficient information across 4+ categories has been gathered, or if max turns reached.")
});
