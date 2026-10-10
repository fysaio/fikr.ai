'use client';

import React, { useState, useRef } from 'react';
import { UITimeSpec } from '@/types';

interface Props {
  spec: UITimeSpec;
  onDone: (val: { title: string; at: string; dur: number }) => void;
}

export const TimeUI: React.FC<Props> = ({ spec, onDone }) => {
  const nowMinutes = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };
  const NOW = nowMinutes();

  const formatMinutes = (m: number) => {
    const wrapped = ((m % 1440) + 1440) % 1440;
    return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(
      wrapped % 60
    ).padStart(2, '0')}`;
  };

  const [whenMode, setWhenMode] = useState<number>(1); // 0: Now, 1: In 1 hour, 2: This evening, 3: Custom time
  const [customAt, setCustomAt] = useState<string>(formatMinutes(NOW + 60));
  const [durMode, setDurMode] = useState<number | 'Custom'>(25);
  const [customDur, setCustomDur] = useState<number>(25);

  const goRef = useRef<HTMLButtonElement>(null);

  const whenOptions: Array<[string, number | null]> = [
    ['Now', NOW],
    ['In 1 hour', NOW + 60],
    ['This evening', 1170],
    ['Pick a time', null],
  ];

  const durationOptions: Array<number | 'Custom'> = [15, 25, 45, 'Custom'];

  const getEffectiveAt = () => {
    const opt = whenOptions[whenMode];
    if (opt[1] !== null) {
      return formatMinutes(opt[1]);
    }
    return customAt;
  };

  const getEffectiveDur = () => {
    if (durMode === 'Custom') {
      return customDur;
    }
    return durMode;
  };

  const formatDurLabel = (d: number) => {
    if (d < 60) return `${d} min`;
    const h = Math.floor(d / 60);
    const rem = d % 60;
    return `${h} h${rem ? ` ${rem} min` : ''}`;
  };

  const handleDone = () => {
    onDone({
      title: spec.title,
      at: getEffectiveAt(),
      dur: getEffectiveDur(),
    });
  };

  return (
    <div className="tm">
      <div className="ttl">{spec.title}</div>
      <h4>When</h4>
      <div className="chips w">
        {whenOptions.map(([label], i) => (
          <button
            key={label}
            type="button"
            className={`chip ${whenMode === i ? 'sel' : ''}`}
            onClick={() => setWhenMode(i)}
          >
            {label}
          </button>
        ))}
      </div>
      {whenMode === 3 && (
        <div className="pk">
          <input
            type="time"
            aria-label="Pick a time"
            value={customAt}
            onChange={(e) => setCustomAt(e.target.value)}
          />
        </div>
      )}

      <h4>How long</h4>
      <div className="chips d">
        {durationOptions.map((d) => (
          <button
            key={String(d)}
            type="button"
            className={`chip ${durMode === d ? 'sel' : ''}`}
            onClick={() => {
              setDurMode(d);
              if (d === 'Custom') {
                setTimeout(() => {
                  goRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                  });
                }, 60);
              }
            }}
          >
            {d === 'Custom' ? 'Custom' : `${d} min`}
          </button>
        ))}
      </div>

      {durMode === 'Custom' && (
        <div className="cu">
          <button
            type="button"
            aria-label="Less"
            onClick={() => setCustomDur((prev) => Math.max(5, prev - 5))}
          >
            −
          </button>
          <div>{formatDurLabel(customDur)}</div>
          <button
            type="button"
            aria-label="More"
            onClick={() => setCustomDur((prev) => Math.min(480, prev + 5))}
          >
            +
          </button>
        </div>
      )}

      <button
        ref={goRef}
        className="btn p go"
        type="button"
        style={{ marginTop: '18px' }}
        onClick={handleDone}
      >
        Add to today
      </button>
    </div>
  );
};
