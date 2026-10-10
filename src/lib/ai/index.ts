/**
 * AI Provider Layer (src/lib/ai)
 * Per Section 3 of Build Prompt:
 * One provider interface (lib/ai) so the model can be swapped.
 * Current model is llama-3.3-70b-versatile.
 * Components and routes call this layer rather than the provider directly.
 */

export { runTask, configureGateway } from './gateway/gateway';
export type { TaskResult, TaskDef } from './gateway/types';

export {
  runOnboardingTurn,
} from './onboarding';

export type {
  OnboardingTurnResult,
  OnboardingRawOutput,
} from './onboarding';

export { runChatTurn } from './chat';
export type { ChatTurnResult, ChatExtractedFact, ChatIntent } from './chat';

export {
  decideIntervention,
} from './interventions';

export type {
  DeciderContext,
  DeciderResult,
} from './interventions';

