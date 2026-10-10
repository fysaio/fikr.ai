'use client';

import React, { useState } from 'react';
import { UIChipsSpec } from '@/types';

interface Props {
  spec: UIChipsSpec;
  onDone: (val: string[]) => void;
}

export const ChipsUI: React.FC<Props> = ({ spec, onDone }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [customText, setCustomText] = useState('');

  const toggle = (option: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(option)) {
        next.delete(option);
      } else {
        next.add(option);
      }
      return next;
    });
  };

  const handleContinue = () => {
    const list = Array.from(selected);
    if (customText.trim()) {
      list.push(customText.trim());
    }
    onDone(list);
  };

  const hasAnySelection = selected.size > 0 || customText.trim().length > 0;

  return (
    <div>
      <div className="chips">
        {spec.options.map((opt) => {
          const isSel = selected.has(opt);
          return (
            <button
              key={opt}
              type="button"
              className={`chip ${isSel ? 'sel' : ''}`}
              aria-pressed={isSel}
              onClick={() => toggle(opt)}
            >
              {opt}
            </button>
          );
        })}
      </div>

      <input
        type="text"
        placeholder="Or type here..."
        value={customText}
        onChange={(e) => setCustomText(e.target.value)}
        style={{
          width: '100%',
          marginTop: '10px',
          background: 'var(--s1)',
          border: '1px solid var(--s2)',
          borderRadius: '12px',
          padding: '10px 14px',
          color: 'var(--ink)',
          fontSize: '14px',
          boxSizing: 'border-box',
          outline: 'none',
        }}
      />

      <button
        className="btn"
        type="button"
        disabled={!hasAnySelection}
        style={{
          opacity: hasAnySelection ? 1 : 0.45,
          cursor: hasAnySelection ? 'pointer' : 'not-allowed',
        }}
        onClick={handleContinue}
      >
        Continue
      </button>
    </div>
  );
};
