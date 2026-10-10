'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { DeciderResult } from '@/lib/ai';
import { InterventionOutcome } from '@/lib/models/schema';

interface InAppInterventionProps {
  intervention: DeciderResult & { id?: string };
  onOutcome: (outcome: InterventionOutcome) => void;
}

const KIND_LABELS: Record<string, string> = {
  orientation: 'Morning orientation',
  contextual_action: 'Contextual suggestion',
  reflection: 'Reflection',
  relationship: 'Relationship check-in',
};

export const InAppIntervention: React.FC<InAppInterventionProps> = ({
  intervention,
  onOutcome,
}) => {
  const [feedbackGiven, setFeedbackGiven] = useState(false);

  if (intervention.decision === 'silent' || !intervention.text) {
    return null;
  }

  const kindLabel = intervention.kind
    ? KIND_LABELS[intervention.kind] || intervention.kind
    : 'Notice';

  const sourceId = intervention.source_fact_ids?.[0];

  return (
    <div
      className="card"
      style={{
        border: '1.5px solid var(--lime)',
        background: 'var(--remb)',
        padding: '14px 16px',
        borderRadius: '16px',
        marginBottom: '20px',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.05)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--lime)',
          }}
        >
          {kindLabel}
        </span>

        {sourceId && (
          <Link
            href={`/life/item/${sourceId}`}
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--mute)',
              textDecoration: 'underline',
            }}
          >
            Why am I seeing this?
          </Link>
        )}
      </div>

      <p
        style={{
          fontSize: '15px',
          lineHeight: 1.45,
          fontWeight: 600,
          color: 'var(--ink)',
          margin: '0 0 12px',
        }}
      >
        {intervention.text}
      </p>

      {intervention.why && !sourceId && (
        <p
          style={{
            fontSize: '12px',
            color: 'var(--mute)',
            margin: '-6px 0 12px',
            fontStyle: 'italic',
          }}
        >
          {intervention.why}
        </p>
      )}

      {/* Primary and secondary action row */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          className="btn"
          type="button"
          onClick={() => onOutcome('acted')}
          style={{
            margin: 0,
            padding: '8px 14px',
            fontSize: '13px',
            fontWeight: 800,
            flex: 1,
          }}
        >
          {intervention.action_label || 'Take care of it'}
        </button>

        <button
          className="btn g"
          type="button"
          onClick={() => onOutcome('snoozed')}
          style={{
            margin: 0,
            padding: '8px 12px',
            fontSize: '13px',
          }}
        >
          Later
        </button>

        <button
          className="btn g"
          type="button"
          onClick={() => onOutcome('dismissed')}
          style={{
            margin: 0,
            padding: '8px 12px',
            fontSize: '13px',
          }}
        >
          Dismiss
        </button>
      </div>

      {/* Helpful / Not helpful feedback */}
      {!feedbackGiven ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '10px',
            fontSize: '11px',
            color: 'var(--mute)',
          }}
        >
          <span>Was this helpful?</span>
          <button
            type="button"
            onClick={() => {
              setFeedbackGiven(true);
              onOutcome('useful');
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--mute)',
              fontSize: '11px',
              cursor: 'pointer',
              fontWeight: 700,
              padding: 0,
            }}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => {
              setFeedbackGiven(true);
              onOutcome('not_useful');
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--mute)',
              fontSize: '11px',
              cursor: 'pointer',
              fontWeight: 700,
              padding: 0,
            }}
          >
            No
          </button>
        </div>
      ) : (
        <div
          style={{
            textAlign: 'right',
            marginTop: '8px',
            fontSize: '11px',
            color: 'var(--mute)',
          }}
        >
          Feedback noted.
        </div>
      )}
    </div>
  );
};
