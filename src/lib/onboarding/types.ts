export type EpistemicState = 'stated' | 'hypothesized';
export type FactState = 'open' | 'undecided' | 'done' | null;
export type FactStatus = 'active' | 'superseded';
export type FactCategory = 'people' | 'projects' | 'commitments' | 'how_i_work' | 'history';

export interface OnboardingFact {
  id: string;
  user_id: string | null;
  category: FactCategory;
  entity: string | null;
  value: string;
  evidence: string;
  epistemic_state: EpistemicState;
  state: FactState;
  due_text: string | null;
  due_at: string | null;
  supersedes_id: string | null;
  status: FactStatus;
  created_at: string;
  source_turn: number;
}

export type Slot = 'project' | 'people' | 'commitment' | 'help_style' | 'week_shape' | 'quiet_times';
export type TargetSlot = Slot | 'thread' | 'close' | 'how_they_want_help';

export type ChoiceOption = string | { label: string; sub?: string };

export type UISpec =
  | { type: 'text'; ph?: string; multiline?: boolean; label?: string }
  | {
      type: 'choice';
      options: ChoiceOption[];
      submit_on_tap?: boolean;
      allow_text?: boolean;
      text_label?: string;
      text_ph?: string;
    }
  | {
      type: 'chips';
      options: string[];
      allow_text?: boolean;
      text_label?: string;
      text_ph?: string;
    }
  | {
      type: 'rank';
      items: string[];
      allow_text?: boolean;
      text_label?: string;
      text_ph?: string;
    }
  | {
      type: 'time';
      chips?: string[];
      from?: string;
      to?: string;
      allow_text?: boolean;
      text_label?: string;
      text_ph?: string;
    }
  | { type: 'none' };

export interface ExtractorRawFact {
  category: FactCategory;
  entity: string | null;
  value: string;
  evidence: string;
  epistemic_state: EpistemicState;
  supersedes: string | null;
  due_text: string | null;
  state: FactState;
}

export interface ExtractorSignals {
  wants_to_be_heard: boolean;
  correction: boolean;
}

export type ExtractedFact = ExtractorRawFact;

export interface ExtractorResult {
  new_facts: ExtractorRawFact[];
  signals: ExtractorSignals;
}

export interface TurnResult {
  reflection?: string;
  facts: ExtractedFact[];
  next_question: string;
  ui_spec: UISpec;
  slot_target: TargetSlot;
  wants_to_be_heard?: boolean;
  correction?: boolean;
  slots: Record<Slot, boolean>;
}

export interface TurnLogMetadata {
  turn_index: number;
  target: TargetSlot;
  signals: ExtractorSignals;
  facts_added: number;
  facts_superseded: number;
  latency_extractor_ms: number;
  latency_guide_ms: number;
  tokens_extractor?: number;
  tokens_guide?: number;
  model: string;
  errors: string[];
}
