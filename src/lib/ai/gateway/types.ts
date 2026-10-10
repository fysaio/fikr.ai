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
  /** Text fields scanned by the safety gate before any model call. */
  userText?(input: In): string;
  /** Fixed answer when the safety gate trips. Skips the model entirely. */
  safe?(input: In): Out;
}

export interface Usage {
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
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
  tokensIn: number;
  tokensOut: number;
}

export type Transport = (req: TransportRequest) => Promise<TransportResponse>;

export class ProviderError extends Error {
  status?: number;
  retryable: boolean;
  constructor(message: string, opts: { status?: number; retryable?: boolean } = {}) {
    super(message);
    this.status = opts.status;
    this.retryable = opts.retryable ?? true;
  }
}
