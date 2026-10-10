'use client';

import React, { useState, useRef, useEffect } from 'react';
import { UITextSpec } from '@/types';

interface Props {
  spec: UITextSpec;
  onDone: (val: string) => void;
}

export const TextUI: React.FC<Props> = ({ spec, onDone }) => {
  const [value, setValue] = useState(spec.initialValue || '');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (spec.initialValue !== undefined) {
      setValue(spec.initialValue);
    }
  }, [spec.initialValue]);

  // Auto-resize: deforms and matches the text dynamically
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    // Reset to measure actual scrollHeight
    el.style.height = 'auto';
    const scrollH = el.scrollHeight;
    const maxHeight = 280;
    const nextHeight = Math.min(maxHeight, Math.max(54, scrollH));
    el.style.height = `${nextHeight}px`;
    if (scrollH > maxHeight) {
      el.style.overflowY = 'auto';
    } else {
      el.style.overflowY = 'hidden';
    }
  }, [value]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      onDone(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift+Enter creates a new line (allowing multi-line thoughts)
        return;
      }
      // Enter submits
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasContent = value.trim().length > 0;

  return (
    <div style={{ width: '100%' }}>
      <div style={{ position: 'relative', width: '100%' }}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={spec.ph || 'Type your thought...'}
          aria-label="Your answer"
          rows={1}
          autoFocus
          style={{
            width: '100%',
            minHeight: '54px',
            maxHeight: '280px',
            background: 'var(--s1)',
            border: `2px solid ${isFocused ? 'var(--pur)' : 'var(--s2)'}`,
            borderRadius: '16px',
            padding: '14px 16px',
            color: 'var(--ink)',
            font: '700 16px/1.4 var(--f)',
            resize: 'vertical', // Deformable: user can also manually resize vertically
            boxSizing: 'border-box',
            outline: 'none',
            display: 'block',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255, 255, 255, 0.16) transparent',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            boxShadow: isFocused ? '0 0 0 3px rgba(179, 155, 255, 0.2)' : 'none',
          }}
        />
      </div>

      <button
        className="btn"
        type="button"
        disabled={!hasContent}
        onClick={() => handleSubmit()}
        style={{
          marginTop: '12px',
          opacity: hasContent ? 1 : 0.45,
          cursor: hasContent ? 'pointer' : 'not-allowed',
          transition: 'opacity 0.2s ease',
        }}
      >
        Continue
      </button>
    </div>
  );
};
