'use client';

import React from 'react';
import { UIChoiceSpec } from '@/types';

interface Props {
  spec: UIChoiceSpec;
  onDone: (val: string) => void;
}

export const ChoiceUI: React.FC<Props> = ({ spec, onDone }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {spec.options.map((opt) => (
        <button
          key={opt}
          type="button"
          className="btn p"
          style={{ marginTop: 0 }}
          onClick={() => onDone(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
};
