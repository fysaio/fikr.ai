'use client';

import React, { useState, useRef } from 'react';
import { UIRankSpec } from '@/types';

interface Props {
  spec: UIRankSpec;
  onDone: (val: string[]) => void;
}

export const RankUI: React.FC<Props> = ({ spec, onDone }) => {
  const [items, setItems] = useState<string[]>([...spec.items]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const [rowHeight, setRowHeight] = useState<number>(56);

  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const targetIndexRef = useRef<number>(0);

  const swap = (i: number, j: number) => {
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    const temp = next[i];
    next[i] = next[j];
    next[j] = temp;
    setItems(next);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      swap(i, i - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      swap(i, i + 1);
    }
  };

  const handlePointerDown = (i: number, e: React.PointerEvent) => {
    e.preventDefault();
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);

    const row = handle.closest('.rk') as HTMLElement;
    const H = row ? row.offsetHeight + 8 : 56;
    setRowHeight(H);
    startYRef.current = e.clientY;
    targetIndexRef.current = i;

    setDragIndex(i);
    setDragOffset(0);
    setTargetIndex(i);

    const onPointerMove = (moveEv: PointerEvent) => {
      const dy = moveEv.clientY - startYRef.current;
      const n = items.length;
      const tgt = Math.max(0, Math.min(n - 1, Math.round(i + dy / H)));
      targetIndexRef.current = tgt;
      setDragOffset(dy);
      setTargetIndex(tgt);
    };

    const onPointerUp = () => {
      handle.removeEventListener('pointermove', onPointerMove);
      handle.removeEventListener('pointerup', onPointerUp);
      handle.removeEventListener('pointercancel', onPointerUp);

      const finalTgt = targetIndexRef.current;
      setDragIndex(null);
      setDragOffset(0);
      setTargetIndex(null);

      if (finalTgt !== i) {
        setItems((prev) => {
          const next = [...prev];
          const [removed] = next.splice(i, 1);
          next.splice(finalTgt, 0, removed);
          return next;
        });
      }
    };

    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerUp);
    handle.addEventListener('pointercancel', onPointerUp);
  };

  return (
    <div>
      <div ref={containerRef}>
        {items.map((item, i) => {
          const isDragging = dragIndex === i;
          let shift = 0;
          if (dragIndex !== null && !isDragging && targetIndex !== null) {
            const H = rowHeight;
            if (dragIndex < targetIndex && i > dragIndex && i <= targetIndex) {
              shift = -H;
            } else if (dragIndex > targetIndex && i < dragIndex && i >= targetIndex) {
              shift = H;
            }
          }

          const style: React.CSSProperties = isDragging
            ? {
                transform: `translateY(${dragOffset}px)`,
                zIndex: 5,
                position: 'relative',
              }
            : shift !== 0
            ? {
                transform: `translateY(${shift}px)`,
              }
            : {};

          return (
            <div
              key={item}
              className={`rk ${isDragging ? 'drag' : ''}`}
              style={style}
            >
              <i>{i + 1}</i>
              <span>{item}</span>
              <span
                className="gp"
                tabIndex={0}
                role="button"
                aria-label={`Drag to reorder ${item}`}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPointerDown={(e) => handlePointerDown(i, e)}
              >
                ⋮⋮
              </span>
            </div>
          );
        })}
      </div>
      <button
        className="btn p"
        type="button"
        onClick={() => onDone(items)}
      >
        This order
      </button>
    </div>
  );
};
