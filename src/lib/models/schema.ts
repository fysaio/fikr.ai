/**
 * Core Data Models per Section 4.3 of Master Build Spec
 */

export type NudgeLevel = 'only_when_asked' | 'morning_and_when_helps' | 'often';
export type OnboardingStatus = 'not_started' | 'in_progress' | 'complete';
export type EntityType = 'person' | 'project' | 'goal' | 'place';
export type EntityStatus = 'active' | 'archived';

export interface UserProfile {
  id: string;
  email?: string;
  name: string; // If empty, greeting is just "Hello"
  timezone: string; // Default 'Africa/Lagos'
  quiet_start: string; // Default '22:00'
  quiet_end: string; // Default '07:00'
  nudge_level: NudgeLevel; // Default 'morning_and_when_helps'
  morning_time: string; // Default '07:30'
  evening_time: string; // Default '20:30'
  theme: 'dark' | 'light' | 'auto';
  age_gate_passed_at?: string | null;
  onboarding_status: OnboardingStatus;
  created_at: string;
}

export interface Entity {
  id: string;
  user_id: string;
  type: EntityType;
  name: string;
  relationship?: string | null; // For people
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export type FactCategory =
  | 'people'
  | 'projects'
  | 'goals'
  | 'commitments'
  | 'prefs'
  | 'places'
  | 'history'
  | 'patterns';

export type EpistemicLevel = 'known' | 'stated' | 'observed' | 'hypothesized';
export type FactState = 'open' | 'undecided' | 'done' | 'dropped' | null;
export type DuePrecision = 'exact' | 'approx' | null;
export type FactSource = 'onboarding' | 'think' | 'today' | 'evening' | 'manual' | 'system';
export type FactStatus = 'active' | 'superseded' | 'rejected' | 'deleted';

export interface FactEvidence {
  quote: string;
  source_ref?: string;
  at?: string;
}

export interface Fact {
  id: string;
  user_id: string;
  entity_id?: string | null;
  category: FactCategory;
  text: string; // One complete sentence that names its subject
  epistemic: EpistemicLevel;
  state?: FactState;
  due_text?: string | null;
  due_at?: string | null; // ISO string in UTC with user's timezone applied
  due_precision?: DuePrecision;
  since_text?: string | null;
  evidence: FactEvidence[];
  source: FactSource;
  source_ref?: string;
  supersedes_id?: string | null;
  status: FactStatus;
  observation_count: number;
  first_observed_at?: string | null;
  last_confirmed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Suppression {
  id: string;
  user_id: string;
  text_hash: string;
}

export type ThinkIntent = 'heard' | 'understand' | 'decide' | 'remember' | 'act' | 'unclear';

export interface ThinkEntry {
  id: string;
  user_id: string;
  thread_day: string; // YYYY-MM-DD
  role: 'user' | 'assistant';
  text: string;
  intent: ThinkIntent;
  outcome_line?: string | null;
  created_at: string;
}

export type InterventionKind = 'orientation' | 'contextual_action' | 'reflection' | 'relationship';
export type InterventionDecision = 'act' | 'ask' | 'suggest' | 'silent';
export type InterventionOutcome = 'acted' | 'dismissed' | 'ignored' | 'snoozed' | 'useful' | 'not_useful';

export interface Intervention {
  id: string;
  user_id: string;
  kind: InterventionKind;
  decision: InterventionDecision;
  source_fact_ids: string[];
  text: string;
  why: string;
  silent_reason?: string | null;
  channel: 'in_app' | 'push';
  shown_at?: string | null;
  outcome?: InterventionOutcome | null;
  outcome_at?: string | null;
}

export type OnboardingBranchState = 'none' | 'offered' | 'think_one' | 'get_it_out' | 'asked_permission';

export interface OnboardingState {
  user_id: string;
  user_turns: number;
  skipped_slots: string[];
  branch_state: OnboardingBranchState;
  status: 'not_started' | 'in_progress' | 'complete';
}

export interface SystemEvent {
  id: string;
  user_id: string;
  type: string;
  metadata: Record<string, any>; // JSON metadata only, never raw message text
  at: string;
}
