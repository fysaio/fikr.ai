'use client';

import React, { useState } from 'react';
import { UITimerSpec } from '@/types';

interface Props {
  spec: UITimerSpec;
  onDone: (val: number) => void;
}

export const TimerUI: React.FC<Props> = ({ spec, onDone }) => {
  const [selectedDuration, setSelectedDuration] = useState<number>(
    spec.task.dur || 25
  );

  const durationOptions = Array.from(
    new Set([15, 25, 45, spec.task.dur || 25])
  ).sort((a, b) => a - b);

  return (
    <div className="tm">
      <div className="ttl">{spec.task.t}</div>
      <p className="m" style={{ margin: '0 0 10px' }}>
        Starts when you tap, not at {spec.task.at}.
      </p>
      <h4>How long</h4>
      <div className="chips d">
        {durationOptions.map((m) => (
          <button
            key={m}
            type="button"
            className={`chip ${selectedDuration === m ? 'sel' : ''}`}
            onClick={() => setSelectedDuration(m)}
          >
            {m} min
          </button>
        ))}
      </div>
      <button
        className="btn p go"
        type="button"
        style={{ marginTop: '18px' }}
        onClick={() => onDone(selectedDuration)}
      >
        Start focus
      </button>
    </div>
  );
};
