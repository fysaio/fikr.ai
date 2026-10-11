'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Screen, Icon } from '@/components/fk';
import { MetricsSummary } from '@/lib/ai/metrics';
import { useApp } from '@/context/AppContext';

export default function CostMetricsPage() {
  const router = useRouter();
  const { showToast } = useApp();
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/metrics');
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (e) {
      console.warn('Failed to fetch metrics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const first = setTimeout(fetchMetrics, 0);
    const interval = setInterval(fetchMetrics, 10000);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, []);

  const handleClear = async () => {
    try {
      await fetch('/api/metrics', { method: 'DELETE' });
      showToast('Telemetry cleared');
      fetchMetrics();
    } catch {
      showToast('Could not clear metrics');
    }
  };

  return (
    <Screen>
      <div style={{ paddingBottom: '32px' }}>
        <button
          className="fk-iconbtn"
          aria-label="Back"
          type="button"
          onClick={() => router.back()}
        >
          <span style={{ display: 'flex', transform: 'rotate(180deg)' }}><Icon name="chev" size={20} /></span>
        </button>

        <h1 className="fk-h1" style={{ fontSize: '32px', marginBottom: '4px' }}>
          Cost & Latency
        </h1>
        <p className="fk-caption" style={{ marginBottom: '16px' }}>
          Operational metrics & AI model telemetry
        </p>

        {/* Content-free guarantee banner */}
        <div
          style={{
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: '12px',
            padding: '12px 14px',
            fontSize: '12px',
            lineHeight: '1.4',
            color: 'var(--fk-ink)',
            marginBottom: '18px',
          }}
        >
          <strong>Content-Free Telemetry:</strong> All metrics log tokens, latency, and model identifiers only. Zero prompts, user thoughts, or memory contents are recorded.
        </div>

        {/* Primary KPIs */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '10px',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              background: 'var(--fk-card)',
              border: '1px solid var(--fk-line)',
              borderRadius: '14px',
              padding: '14px',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--fk-mute)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Est. Spend (USD)
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--fk-ink)', marginTop: '4px' }}>
              ${metrics ? metrics.totalCostUsd.toFixed(4) : '0.0000'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--fk-mute)', marginTop: '2px' }}>
              Llama 3.3 70B rates
            </div>
          </div>

          <div
            style={{
              background: 'var(--fk-card)',
              border: '1px solid var(--fk-line)',
              borderRadius: '14px',
              padding: '14px',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--fk-mute)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              AI Requests
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--fk-ink)', marginTop: '4px' }}>
              {metrics ? metrics.totalCalls : 0}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--fk-mute)', marginTop: '2px' }}>
              {metrics ? `${metrics.successfulCalls} ok · ${metrics.retriedCalls} retries` : '0 ok'}
            </div>
          </div>

          <div
            style={{
              background: 'var(--fk-card)',
              border: '1px solid var(--fk-line)',
              borderRadius: '14px',
              padding: '14px',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--fk-mute)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Tokens Used
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--fk-ink)', marginTop: '4px' }}>
              {metrics ? (metrics.totalTokensIn + metrics.totalTokensOut).toLocaleString() : 0}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--fk-mute)', marginTop: '2px' }}>
              {metrics ? `${metrics.totalTokensIn.toLocaleString()} in / ${metrics.totalTokensOut.toLocaleString()} out` : ''}
            </div>
          </div>

          <div
            style={{
              background: 'var(--fk-card)',
              border: '1px solid var(--fk-line)',
              borderRadius: '14px',
              padding: '14px',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--fk-mute)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Latency
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--fk-ink)', marginTop: '4px' }}>
              {metrics ? `${metrics.avgLatencyMs}ms` : '0ms'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--fk-mute)', marginTop: '2px' }}>
              p95: {metrics ? `${metrics.p95LatencyMs}ms` : '0ms'}
            </div>
          </div>
        </div>

        {/* Endpoint Breakdown */}
        {metrics && Object.keys(metrics.callsByEndpoint).length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h4 className="fk-h2" style={{ marginBottom: '10px' }}>Calls by Feature</h4>
            <div
              style={{
                background: 'var(--fk-card)',
                border: '1px solid var(--fk-line)',
                borderRadius: '14px',
                padding: '12px 16px',
              }}
            >
              {Object.entries(metrics.callsByEndpoint).map(([ep, count]) => {
                const cost = metrics.costByEndpoint[ep] || 0;
                return (
                  <div
                    key={ep}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      fontSize: '13px',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--fk-ink)', textTransform: 'capitalize' }}>
                        {ep.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--fk-mute)', marginLeft: '8px' }}>
                        {count} call{count > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--fk-mute)' }}>
                      ${cost.toFixed(5)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Telemetry Log */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 className="fk-h2" style={{ margin: 0 }}>Recent Call Log</h4>
            <span style={{ fontSize: '11px', color: 'var(--fk-mute)' }}>
              Last {metrics?.recentCalls.length || 0} calls
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {(!metrics || metrics.recentCalls.length === 0) ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--fk-mute)', fontSize: '13px' }}>
                No telemetry recorded yet in this session.
              </div>
            ) : (
              metrics.recentCalls.map((rec) => (
                <div
                  key={rec.id}
                  style={{
                    background: 'var(--fk-card)',
                    border: '1px solid var(--fk-line)',
                    borderRadius: '12px',
                    padding: '10px 12px',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--fk-ink)' }}>
                      {rec.endpoint}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: rec.success ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: rec.success ? '#4ade80' : '#f87171',
                      }}
                    >
                      {rec.success ? (rec.retried ? 'retried' : 'ok') : 'failed'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--fk-mute)', fontSize: '11px' }}>
                    <span>
                      {rec.latencyMs}ms · {rec.tokensIn + rec.tokensOut} toks ({rec.tokensIn} in / {rec.tokensOut} out)
                    </span>
                    <span style={{ fontFamily: 'monospace' }}>
                      ${rec.estimatedCostUsd.toFixed(5)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button
            className="fk-btn"
            type="button"
            style={{ flex: 1 }}
            onClick={fetchMetrics}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            className="fk-btn"
            type="button"
            onClick={handleClear}
            style={{ padding: '0 16px', fontSize: '12px' }}
          >
            Clear Log
          </button>
        </div>
      </div>
    </Screen>
  );
}
