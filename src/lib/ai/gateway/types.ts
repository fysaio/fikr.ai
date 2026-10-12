import type { ZodType } from 'zod';

/** Where a result came from. Only 'model' and a failed 'fallback' attempt cost tokens. */
export type ResultSource = 'rule' | 'cache' | 'model' | 'fallback';

export interface TaskDef<In, Out> {
  /** Stable id used in cache keys, budgets and metrics. */
  id: string;
  /** Bump whenever the prompt or output shape changes. Old cache entries stop matching. */
  version: string;
  /** Frozen system prompt. Never interpolate user data into it (keeps the prefix cacheable). */
  system: string;
  temperature: number;
  maxOutTokens: number;
  timeoutMs: number;
  inputSchema: ZodType<In>;
  outputSchema: ZodType<Out>;
  /** Builds the only dynamic part of the prompt. Keep it compact. */
  buildUser(input: In): string;
  /** Exact-match cache. Omit for tasks that must never repeat an answer. */
  cache?: { ttlSec: number; scope: 'user' | 'global'; keyOf(input: In): unknown };
  /** Answer from plain code when the model adds nothing. Return null to continue. */
  shortcut?(input: In): Out | null;
  /** Fixed copy used when the model, budget or validation fails. Never throws. */
  fallback(input: In): Out;
  /** Post-process after validation (sanitising, caps). */
  finalize?(out: Out, input: In): Out;
  /** Allow one repair retry when JSON fails validation. Costs about 2x on that call. */
  repair?: boolean;
  /** Wall-clock cap for the whole run (all providers and the repair). Defaults to 1.5x timeoutMs. */
  totalTimeoutMs?: number;
  /** Text fields scanned by the safety gate before any model call. */
  userText?(input: In): string;
  /** Fixed answer when the safety gate trips. Skips the model entirely. */
  safe?(input: In): Out;
}

export interface Usage {
  /** Prompt tokens the provider served from its own prefix cache (billed cheaper or free). 0 when unreported. */
  cachedIn: number;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  /** One entry per provider tried when something went wrong, e.g. "primary:429" or "fallback_2:400/json_validate_failed". Status and code only, never content. */
  attempts: string[];
  provider: string | null;
  model: string | null;
  retried: boolean;
}

export interface TaskResult<Out> {
  data: Out;
  source: ResultSource;
  usage: Usage;
  /** Why a fallback was used. Content-free. */
  reason?: string;
  /** Which provider attempts failed and how, e.g. "primary:400:json_validate_failed fallback:429". Content-free: status and a short error code only, never the message. */
  detail?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProviderConfig {
  name: string;
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface TransportRequest {
  provider: ProviderConfig;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  json: boolean;
}

export interface TransportResponse {
  text: string;
  /** Prompt tokens served from the provider's prefix cache, when the provider reports it. */
  cachedIn?: number;
  tokensIn: number;
  tokensOut: number;
}

export type Transport = (req: TransportRequest) => Promise<TransportResponse>;

export class ProviderError extends Error {
  status?: number;
  /** Short machine code from the provider (for example json_validate_failed). Safe to log. The message is not: it can echo model output. */
  code?: string;
  retryable: boolean;
  constructor(message: string, opts: { status?: number; retryable?: boolean; code?: string } = {}) {
    super(message);
    this.status = opts.status;
    this.code = opts.code;
    this.retryable = opts.retryable ?? true;
  }
}
