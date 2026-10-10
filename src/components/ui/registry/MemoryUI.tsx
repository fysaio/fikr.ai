'use client';

import React from 'react';
import { UIMemorySpec } from '@/types';
import { Checkmark } from '@/components/icons/Icons';

interface Props {
  spec: UIMemorySpec;
  onDone: (val: 'undo' | 'ok') => void;
}

export const MemoryUI: React.FC<Props> = ({ spec, onDone }) => {
  return (
    <div>
      <div className="rem big">
        <span className="ck">
          <Checkmark />
        </span>
        <span className="rt">
          <small>Remembered</small>
          <b>{spec.text}</b>
        </span>
      </div>
      <div className="row2">
        <button
          className="btn g"
          type="button"
          style={{ margin: 0 }}
          onClick={() => onDone('undo')}
        >
          Undo
        </button>
        <button
          className="btn"
          type="button"
          style={{ margin: 0 }}
          onClick={() => onDone('ok')}
        >
          Looks right
        </button>
      </div>
    </div>
  );
};
