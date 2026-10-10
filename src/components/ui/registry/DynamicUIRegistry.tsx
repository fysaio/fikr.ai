'use client';

import React from 'react';
import { UISpec } from '@/types';
import { TextUI } from './TextUI';
import { ChipsUI } from './ChipsUI';
import { ChoiceUI } from './ChoiceUI';
import { RankUI } from './RankUI';
import { MemoryUI } from './MemoryUI';
import { TimeUI } from './TimeUI';
import { TimerUI } from './TimerUI';

interface Props {
  spec: UISpec;
  onDone: (val: any) => void;
}

export const DynamicUIComponent: React.FC<Props> = ({ spec, onDone }) => {
  switch (spec.type) {
    case 'text':
      return <TextUI spec={spec} onDone={onDone} />;
    case 'chips':
      return <ChipsUI spec={spec} onDone={onDone} />;
    case 'choice':
      return <ChoiceUI spec={spec} onDone={onDone} />;
    case 'rank':
      return <RankUI spec={spec} onDone={onDone} />;
    case 'memory':
      return <MemoryUI spec={spec} onDone={onDone} />;
    case 'time':
      return <TimeUI spec={spec} onDone={onDone} />;
    case 'timer':
      return <TimerUI spec={spec} onDone={onDone} />;
    default:
      return null;
  }
};
