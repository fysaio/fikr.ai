/**
 * Content-Free AI Instrumentation & Telemetry
 * Tracks latency, token counts, and estimated cost without ever retaining user text or prompts.
 */

export interface AIMetricRecord {
  id: string;
  timestamp: string;
  endpoint: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  success: boolean;
  retried: boolean;
  estimatedCostUsd: number;
}

export interface MetricsSummary {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  retriedCalls: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  callsByEndpoint: Record<string, number>;
  costByEndpoint: Record<string, number>;
  recentCalls: AIMetricRecord[];
}

// Pricing rates for Llama 3.3 70B (Groq)
// Input: $0.59 / 1M tokens ($0.00000059 / token)
// Output: $0.79 / 1M tokens ($0.00000079 / token)
const RATE_INPUT_PER_TOKEN = 0.59 / 1_000_000;
const RATE_OUTPUT_PER_TOKEN = 0.79 / 1_000_000;

// Server-side persistent ring buffer across route hot-reloads
const globalStore = globalThis as unknown as {
  __fikr_metrics_store__?: AIMetricRecord[];
};

if (!globalStore.__fikr_metrics_store__) {
  globalStore.__fikr_metrics_store__ = [];
}

const MAX_STORED_RECORDS = 500;

export function calculateEstimatedCost(tokensIn: number, tokensOut: number): number {
  return Number((tokensIn * RATE_INPUT_PER_TOKEN + tokensOut * RATE_OUTPUT_PER_TOKEN).toFixed(6));
}

export function recordCallMetric(params: {
  endpoint?: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  success: boolean;
  retried?: boolean;
}): AIMetricRecord {
  const estimatedCostUsd = calculateEstimatedCost(params.tokensIn, params.tokensOut);
  
  const record: AIMetricRecord = {
    id: `met_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    endpoint: params.endpoint || 'general',
    model: params.model,
    tokensIn: params.tokensIn,
    tokensOut: params.tokensOut,
    latencyMs: Math.max(0, params.latencyMs),
    success: params.success,
    retried: !!params.retried,
    estimatedCostUsd,
  };

  const store = globalStore.__fikr_metrics_store__!;
  store.unshift(record);
  if (store.length > MAX_STORED_RECORDS) {
    store.pop();
  }

  return record;
}

export function getMetricsSummary(): MetricsSummary {
  const store = globalStore.__fikr_metrics_store__ || [];

  if (store.length === 0) {
    return {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      retriedCalls: 0,
      totalTokensIn: 0,
      totalTokensOut: 0,
      totalCostUsd: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      callsByEndpoint: {},
      costByEndpoint: {},
      recentCalls: [],
    };
  }

  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let totalCostUsd = 0;
  let totalLatency = 0;
  let successfulCalls = 0;
  let failedCalls = 0;
  let retriedCalls = 0;

  const callsByEndpoint: Record<string, number> = {};
  const costByEndpoint: Record<string, number> = {};
  const latencies: number[] = [];

  for (const r of store) {
    totalTokensIn += r.tokensIn;
    totalTokensOut += r.tokensOut;
    totalCostUsd += r.estimatedCostUsd;
    totalLatency += r.latencyMs;
    latencies.push(r.latencyMs);

    if (r.success) successfulCalls++;
    else failedCalls++;

    if (r.retried) retriedCalls++;

    callsByEndpoint[r.endpoint] = (callsByEndpoint[r.endpoint] || 0) + 1;
    costByEndpoint[r.endpoint] = Number(
      ((costByEndpoint[r.endpoint] || 0) + r.estimatedCostUsd).toFixed(6)
    );
  }

  latencies.sort((a, b) => a - b);
  const p95Index = Math.min(
    latencies.length - 1,
    Math.floor(latencies.length * 0.95)
  );
  const p95LatencyMs = latencies[p95Index] || 0;
  const avgLatencyMs = Math.round(totalLatency / store.length);

  return {
    totalCalls: store.length,
    successfulCalls,
    failedCalls,
    retriedCalls,
    totalTokensIn,
    totalTokensOut,
    totalCostUsd: Number(totalCostUsd.toFixed(6)),
    avgLatencyMs,
    p95LatencyMs,
    callsByEndpoint,
    costByEndpoint,
    recentCalls: store.slice(0, 50),
  };
}

export function clearMetrics(): void {
  if (globalStore.__fikr_metrics_store__) {
    globalStore.__fikr_metrics_store__.length = 0;
  }
}
