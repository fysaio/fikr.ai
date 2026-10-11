'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { Task } from '@/types';
import { Button, Screen } from '@/components/fk';
import { snoozeUntil, visibleTasks } from '@/lib/today/derive';
import { dayKey } from '@/lib/settings/settings';
import { writeDay } from '@/lib/day/log';
import { syncCheckinWithSupabase, syncTaskWithSupabase } from '@/lib/data/data-access';

type Choice = 'done' | 'tomorrow' | 'let go';
const CHIPS = ['Early class', "I'm tired", 'Nothing'];

export default function EveningPage() {
  const { state, setState, completeTask } = useApp();
  const [step, setStep] = useState<'ended' | 'tomorrow' | 'closed'>('ended');
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [note, setNote] = useState('');
  const [mountedAt] = useState(() => Date.now());

  const open = useMemo(() => visibleTasks((state.tasks || []) as Task[], state.done, new Date(mountedAt)), [state.tasks, state.done, mountedAt]);
  const counts = { done: Object.values(choices).filter((c) => c === 'done').length, carried: Object.values(choices).filter((c) => c === 'tomorrow').length };
  const clean = note.trim() && note.trim().toLowerCase() !== 'nothing' ? note.trim() : '';

  const pick = (t: Task, c: Choice) => setChoices((p) => (p[String(t.id)] === c ? Object.fromEntries(Object.entries(p).filter(([k]) => k !== String(t.id))) : { ...p, [String(t.id)]: c }));

  const close = () => {
    const now = new Date();
    const by = (c: Choice) => open.filter((t) => choices[String(t.id)] === c).map((t) => t.title);
    for (const t of open) {
      const c = choices[String(t.id)];
      if (c === 'done') completeTask(t.id);
      else if (c === 'tomorrow') {
        const until = snoozeUntil('tomorrow', now).toISOString();
        setState((p) => ({ ...p, tasks: (p.tasks || []).map((x) => (x.id === t.id ? { ...x, hidden_until: until } : x)) }));
      } else if (c === 'let go') {
        setState((p) => ({ ...p, tasks: (p.tasks || []).map((x) => (x.id === t.id ? { ...x, status: 'moved' } : x)) }));
        syncTaskWithSupabase({ id: String(t.id), status: 'moved' });
      }
    }
    writeDay({ date: dayKey(now), done: by('done'), carried: by('tomorrow'), letGo: by('let go'), note: clean });
    setState((p) => ({ ...p, eveDone: true, eveDate: dayKey(now), tomorrow: clean ? [clean] : [] }));
    if (clean) syncCheckinWithSupabase({ date: dayKey(now), answers: { what_tomorrow_should_know: clean } });
    setStep('closed');
  };

  if (step === 'closed') {
    const n = clean ? 1 : 0;
    return (
      <Screen>
        <h1 className="fk-display fk-life-h" style={{ marginTop: 80 }}>Tomorrow knows.</h1>
        <p className="fk-caption" style={{ fontSize: 16 }}>{counts.done} done, {counts.carried} carried over, {n} {n === 1 ? 'note' : 'notes'}. I&apos;ll stay quiet until morning.</p>
        <div className="fk-actions" style={{ marginTop: 24 }}><Button variant="primary" hero href="/today">Go to Today</Button></div>
      </Screen>
    );
  }

  if (step === 'tomorrow') {
    return (
      <Screen>
        <h1 className="fk-display fk-life-h" style={{ marginTop: 40 }}>What should tomorrow know?</h1>
        <p className="fk-caption">Anything. Or nothing.</p>
        <div className="fk-chips" role="group" aria-label="Quick notes">
          {CHIPS.map((c) => <button key={c} type="button" className="fk-chip" onClick={() => setNote((n) => (c === 'Nothing' ? 'Nothing' : n && n !== 'Nothing' ? `${n}, ${c.toLowerCase()}` : c))}>{c}</button>)}
        </div>
        <textarea className="fk-textarea" style={{ marginTop: 14 }} rows={3} maxLength={400} aria-label="Write it" placeholder="Or write it" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="fk-actions" style={{ marginTop: 16 }}><Button variant="primary" hero onClick={close}>That&apos;s it</Button></div>
      </Screen>
    );
  }

  return (
    <Screen>
      <Link href="/today" className="fk-link">Today</Link>
      <h1 className="fk-display fk-life-h" style={{ marginTop: 12 }}>Where did these end up?</h1>
      <p className="fk-caption">Only if you want to say. Skip any.</p>
      <div className="fk-stack" style={{ marginTop: 16 }}>
        {open.length === 0 && <p className="fk-caption">Nothing was left open.</p>}
        {open.map((t) => (
          <div key={t.id} className="fk-card">
            <b>{t.title}</b>
            <div className="fk-seg" role="radiogroup" aria-label={`Where did ${t.title} end up`} style={{ marginTop: 10 }}>
              {(['done', 'tomorrow', 'let go'] as Choice[]).map((c) => (
                <button key={c} type="button" role="radio" aria-checked={choices[String(t.id)] === c} className={choices[String(t.id)] === c ? 'on' : ''} onClick={() => pick(t, c)}>{c === 'done' ? 'Done' : c === 'tomorrow' ? 'Tomorrow' : 'Let it go'}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="fk-actions" style={{ marginTop: 18 }}><Button variant="primary" hero onClick={() => setStep('tomorrow')}>That&apos;s it</Button></div>
    </Screen>
  );
}
