'use client';

import React, { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PhoneShell } from '@/components/layout/PhoneShell';
import { Arrow } from '@/components/icons/Icons';
import { useApp } from '@/context/AppContext';
import { Memory } from '@/types';
import { FIXTURE_LIFE_DATA } from '@/fixtures';

const CF_INFO: Record<string, [string, string]> = {
  known: ['Known', 'Supported by something reliable, like your calendar.'],
  stated: ['You told me', 'You said or chose this yourself.'],
  observed: ['I noticed', 'I saw this happen more than once.'],
  hypothesized: ['A guess', 'An interpretation. I might be wrong.'],
};

const CONF_LEVELS: Record<string, number> = {
  known: 4,
  stated: 3,
  observed: 2,
  hypothesized: 1,
};

export default function LifeItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { state, updateLifeItem, forgetLifeItem, mergeLifeItems, showToast } =
    useApp();

  const lifeData = state.life || {};
  let currentItem: Memory | undefined;

  for (const cat in lifeData) {
    const found = lifeData[cat].find((x) => x.id === id);
    if (found) {
      currentItem = found;
      break;
    }
  }

  // Fallback to fixture data if item not yet created in user state
  if (!currentItem) {
    for (const cat in FIXTURE_LIFE_DATA) {
      const found = FIXTURE_LIFE_DATA[cat].find((x) => x.id === id);
      if (found) {
        currentItem = found;
        break;
      }
    }
  }

  const [isMounted, setIsMounted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(currentItem?.text || '');
  const [isMerging, setIsMerging] = useState(false);
  const [selectedMergeId, setSelectedMergeId] = useState<string>('');
  const [mergedDraft, setMergedDraft] = useState<string>('');
  const [showForgetConfirm, setShowForgetConfirm] = useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  React.useEffect(() => {
    if (currentItem?.text) {
      setEditText(currentItem.text);
    }
  }, [currentItem?.text]);

  if (!isMounted) {
    return (
      <PhoneShell>
        <button
          className="back"
          aria-label="Back"
          type="button"
          onClick={() => router.push('/life')}
        >
          <Arrow dir="l" />
        </button>
        <p className="m" style={{ color: 'var(--mute)' }}>Loading...</p>
      </PhoneShell>
    );
  }

  if (!currentItem) {
    return (
      <PhoneShell>
        <button
          className="back"
          aria-label="Back"
          type="button"
          onClick={() => router.push('/life')}
        >
          <Arrow dir="l" />
        </button>
        <p className="m" style={{ marginTop: '20px' }}>Item not found or already forgotten.</p>
        <button
          className="btn"
          type="button"
          onClick={() => router.push('/life')}
          style={{ marginTop: '12px' }}
        >
          Back to Life
        </button>
      </PhoneShell>
    );
  }

  const confInfo = CF_INFO[currentItem.confidence] || CF_INFO.stated;
  const level = CONF_LEVELS[currentItem.confidence] || 3;

  // Candidates for merging (items in the same category or all active items)
  const candidateItems: Memory[] = [];
  if (state.life) {
    const catItems = state.life[currentItem.category] || [];
    catItems.forEach((x) => {
      if (x.id !== currentItem?.id && !x.gone && !x.rejected && x.status !== 'deleted') {
        candidateItems.push(x);
      }
    });
  }

  const handleFeelsTrue = () => {
    updateLifeItem(currentItem.id, {
      confidence: 'stated',
      source: 'You confirmed this',
      evidence: [],
    });
    showToast('Saved as something you told me');
  };

  const handleSaveEdit = () => {
    const trimmed = editText.trim();
    if (trimmed) {
      updateLifeItem(currentItem.id, {
        text: trimmed,
        confidence: 'stated',
        source: 'You edited this',
      });
      setIsEditing(false);
      showToast('Updated');
    }
  };

  const handleWrongOrReject = () => {
    updateLifeItem(currentItem.id, { rejected: true, status: 'rejected' });
    showToast('Okay. I won’t say that again.');
    router.push(`/life/${currentItem.category}`);
  };

  const handleConfirmForget = async () => {
    await forgetLifeItem(currentItem.id);
    showToast('Forgotten. I won’t remember or bring this up again.');
    router.push(`/life/${currentItem.category}`);
  };

  const handleStartMerge = () => {
    setIsMerging(true);
    if (candidateItems.length > 0) {
      const first = candidateItems[0];
      setSelectedMergeId(first.id);
      setMergedDraft(`${currentItem.text}. ${first.text}`);
    }
  };

  const handleSelectMergeTarget = (targetId: string) => {
    setSelectedMergeId(targetId);
    const target = candidateItems.find((x) => x.id === targetId);
    if (target) {
      setMergedDraft(`${currentItem.text}. ${target.text}`);
    }
  };

  const handleExecuteMerge = async () => {
    if (!selectedMergeId || !mergedDraft.trim()) return;
    await mergeLifeItems(currentItem.id, selectedMergeId, mergedDraft.trim());
    setIsMerging(false);
    showToast('Merged successfully');
  };

  // Build clean display history
  const historyList = currentItem.history && currentItem.history.length > 0
    ? currentItem.history
    : [
        {
          action: 'created',
          at: currentItem.created_at || 'Earlier',
          note: currentItem.source || 'Learned during conversation',
        },
      ];

  return (
    <PhoneShell>
      <button
        className="back"
        aria-label="Back"
        type="button"
        onClick={() => router.back()}
      >
        <Arrow dir="l" />
      </button>

      <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className={`cf ${currentItem.confidence}`}>{confInfo[0]}</span>
        <small style={{ color: 'var(--mute)', textTransform: 'capitalize' }}>
          {currentItem.category}
        </small>
      </div>

      {isEditing ? (
        <div style={{ marginTop: '12px' }}>
          <textarea
            id="ei"
            aria-label="Edit memory"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            autoFocus
            rows={3}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid var(--lime)',
              background: 'var(--bg)',
              color: 'var(--cink)',
              fontSize: '16px',
              lineHeight: 1.4,
              resize: 'vertical',
            }}
          />
          <div className="row2" style={{ marginTop: '8px' }}>
            <button className="btn" type="button" onClick={handleSaveEdit} style={{ margin: 0 }}>
              Save
            </button>
            <button
              className="btn g"
              type="button"
              onClick={() => {
                setEditText(currentItem.text);
                setIsEditing(false);
              }}
              style={{ margin: 0 }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <h1 id="tt" style={{ marginTop: '12px', lineHeight: 1.3 }}>
          {currentItem.text}
        </h1>
      )}

      {/* Merge Panel */}
      {isMerging && (
        <div className="card" style={{ border: '1px solid var(--lime)', marginTop: '12px' }}>
          <b>Merge with another memory</b>
          <p className="m" style={{ margin: '4px 0 8px' }}>
            Combine this item with another and keep one clear record.
          </p>
          {candidateItems.length > 0 ? (
            <>
              <label style={{ fontSize: '13px', color: 'var(--mute)', display: 'block', marginBottom: '4px' }}>
                Select item to combine with:
              </label>
              <select
                value={selectedMergeId}
                onChange={(e) => handleSelectMergeTarget(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--cink)',
                  marginBottom: '10px',
                  fontSize: '14px',
                }}
              >
                {candidateItems.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.text.length > 50 ? `${c.text.slice(0, 50)}...` : c.text}
                  </option>
                ))}
              </select>

              <label style={{ fontSize: '13px', color: 'var(--mute)', display: 'block', marginBottom: '4px' }}>
                Merged text (edit as needed):
              </label>
              <textarea
                value={mergedDraft}
                onChange={(e) => setMergedDraft(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--cink)',
                  fontSize: '14px',
                  marginBottom: '10px',
                }}
              />

              <div className="row2">
                <button className="btn" type="button" onClick={handleExecuteMerge} style={{ margin: 0 }}>
                  Confirm merge
                </button>
                <button
                  className="btn g"
                  type="button"
                  onClick={() => setIsMerging(false)}
                  style={{ margin: 0 }}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="m">No other memories in this category to merge with.</p>
              <button
                className="btn g"
                type="button"
                onClick={() => setIsMerging(false)}
                style={{ marginTop: '8px' }}
              >
                Close
              </button>
            </>
          )}
        </div>
      )}

      {/* Forget confirmation modal / card */}
      {showForgetConfirm && (
        <div className="card" style={{ border: '1px solid #ff4d4f', marginTop: '12px' }}>
          <b style={{ color: '#ff4d4f' }}>Forget this memory?</b>
          <p className="m" style={{ margin: '6px 0 10px' }}>
            Fikr will permanently erase this knowledge, leave no personal content, and never bring it up again.
          </p>
          <div className="row2">
            <button
              className="btn"
              type="button"
              onClick={handleConfirmForget}
              style={{ margin: 0, background: '#ff4d4f', color: '#fff' }}
            >
              Yes, forget
            </button>
            <button
              className="btn g"
              type="button"
              onClick={() => setShowForgetConfirm(false)}
              style={{ margin: 0 }}
            >
              Keep
            </button>
          </div>
        </div>
      )}

      {/* Confidence scale card */}
      <div className="card" style={{ marginTop: '12px' }}>
        <b>
          {currentItem.confidence === 'hypothesized'
            ? 'This is a guess'
            : 'How sure am I?'}
        </b>
        <p className="m" style={{ margin: '6px 0 0' }}>
          {confInfo[1]}
        </p>
        <div className="scale">
          {[1, 2, 3, 4].map((i) => (
            <i key={i} className={i <= level ? 'on' : ''} />
          ))}
        </div>
        <div className="scale-l">
          <span>Less sure</span>
          <span>More sure</span>
        </div>
      </div>

      {/* Provenance card */}
      <div className="card">
        <b>Where this came from</b>
        <p className="m" style={{ margin: '6px 0 0' }}>
          {currentItem.source || 'You told me, in conversation'}
        </p>
        {currentItem.evidence && currentItem.evidence.length > 0 && (
          <div className="ev" style={{ marginTop: '8px' }}>
            {currentItem.evidence.map((e, idx) => (
              <div key={idx}>• {e}</div>
            ))}
          </div>
        )}
      </div>

      {/* History of changes card */}
      <div className="card">
        <b>History of changes</b>
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {historyList.map((h, idx) => (
            <div
              key={idx}
              style={{
                fontSize: '13px',
                borderLeft: '2px solid var(--border)',
                paddingLeft: '10px',
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--cink)', textTransform: 'capitalize' }}>
                {h.action === 'created'
                  ? 'Learned'
                  : h.action === 'edited'
                  ? 'Corrected'
                  : h.action === 'confirmed'
                  ? 'Confirmed'
                  : h.action === 'merged'
                  ? 'Merged'
                  : h.action}
                <span style={{ fontWeight: 400, color: 'var(--mute)', marginLeft: '8px', fontSize: '12px' }}>
                  {h.at && h.at.includes('T') ? new Date(h.at).toLocaleDateString() : h.at}
                </span>
              </div>
              {h.previous_text && (
                <div style={{ color: 'var(--mute)', fontSize: '12px', marginTop: '2px' }}>
                  Previous: "{h.previous_text}"
                </div>
              )}
              {h.note && (
                <div style={{ color: 'var(--mute)', fontSize: '12px', marginTop: '2px' }}>
                  {h.note}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      {currentItem.confidence === 'hypothesized' && (
        <button
          className="btn"
          id="tr"
          type="button"
          onClick={handleFeelsTrue}
          style={{ marginTop: '8px' }}
        >
          Feels true
        </button>
      )}

      <div className="row2" style={{ marginTop: '10px' }}>
        <button
          className="btn g"
          id="ed"
          type="button"
          onClick={() => {
            if (isEditing) {
              handleSaveEdit();
            } else {
              setEditText(currentItem.text);
              setIsEditing(true);
            }
          }}
          style={{ margin: 0 }}
        >
          {isEditing ? 'Save' : 'Edit / Correct'}
        </button>
        <button
          className="btn g"
          id="wr"
          type="button"
          onClick={handleWrongOrReject}
          style={{ margin: 0 }}
        >
          {currentItem.confidence === 'hypothesized' ? 'Reject pattern' : 'That’s wrong'}
        </button>
      </div>

      <div className="row2" style={{ marginTop: '8px' }}>
        <button
          className="btn g"
          type="button"
          onClick={handleStartMerge}
          style={{ margin: 0 }}
        >
          Merge
        </button>
        <button
          className="btn g"
          type="button"
          onClick={() => setShowForgetConfirm(true)}
          style={{ margin: 0, color: '#ff4d4f' }}
        >
          Forget
        </button>
      </div>
    </PhoneShell>
  );
}
