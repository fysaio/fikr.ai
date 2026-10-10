/**
 * AI Provider Layer (src/lib/ai)
 * Per Section 3 of Build Prompt:
 * One provider interface (lib/ai) so the model can be swapped.
 * Current model is llama-3.3-70b-versatile.
 * Components and routes call this layer rather than the provider directly.
 */

export {
  getAIClient,
  getAIModelName,
  callAI,
  extractJSON,
} from './provider';

export type {
  AIModelOptions,
  AICallResult,
} from './provider';

export {
  runOnboardingTurn,
} from './onboarding';

export type {
  OnboardingTurnResult,
  OnboardingRawOutput,
} from './onboarding';

export {
  runThinkTurn,
} from './think';

export type {
  ThinkTurnResult,
  ThinkTurnOutput,
  ExtractedThinkFact,
  ThinkIntent,
} from './think';

export {
  decideIntervention,
} from './interventions';

export type {
  DeciderContext,
  DeciderResult,
} from './interventions';

