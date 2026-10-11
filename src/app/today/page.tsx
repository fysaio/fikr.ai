'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { syncTaskWithSupabase } from '@/lib/data/data-access';
import { Memory, Task } from '@/types';
import { DeciderResult } from '@/lib/ai';
import { InterventionOutcome } from '@/lib/models/schema';
import { ChatSheet, Button, Card, IconButton, ItemCard, Menu, Row, Screen, Section, Strip, TabBar, TextLink, Toast, Icon } from '@/components/fk';
import { dayKey } from '@/lib/settings/settings';
import { flushOutbox, type TellReply } from '@/lib/outbox/tell';
import { buildChatContext, reconcileChatFacts } from '@/lib/memory/chat-facts';
import { firstName, fmt12, isEvening, lockedUntil, opensIn, mmss, snoozeUntil, soonTask, telLink, visibleTasks, waLink } from '@/lib/today/derive';

const WA_KEY = 'gist_wa_pending_v1';
const OPENED_KEY = 'gist_yesterday_seen_v1';

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const t0 = setTimeout(() => setNow(new Date()), 0);
    const t = setInterval(() => setNow(new Date()), intervalMs);
    const onVis = () => document.visibilityState === 'visible' && setNow(new Date());
    document.addEventListener('visibilitychange', onVis);
    return () => { clearTimeout(t0); clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [intervalMs]);
  return now;
}

function TodayContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { state, setState, focusTimer, completeTask } = useApp();
  const now = useNow();

  const [menuFor, setMenuFor] = useState<string | number | null>(null);
  const [undo, setUndo] = useState<{ id: string | number; label: string } | null>(null);
  const [okToast, setOkToast] = useState<string | null>(null);
  const [talkOpen, setTalkOpen] = useState(params.get('talk') === '1');
  const [waPending, setWaPending] = useState<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tasks = useMemo(() => (state.tasks || []) as Task[], [state.tasks]);
  const open = useMemo(() => (now ? visibleTasks(tasks, state.done, now) : []), [tasks, state.done, now]);
  const soon = useMemo(() => (now ? soonTask(open, now) : null), [open, now]);
  const focusId = params.get('focus');

  /* ---- timer: always recompute from `end`, never from a counter ---- */
  const [nowMs, setNowMs] = useState(0);
  useEffect(() => {
    if (!focusTimer || focusTimer.paused) return;
    const t0 = setTimeout(() => setNowMs(Date.now()), 0);
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => { clearTimeout(t0); clearInterval(t); };
  }, [focusTimer]);
  const timerLeft = focusTimer ? (focusTimer.paused || !nowMs ? focusTimer.left : Math.max(0, Math.round((focusTimer.end - nowMs) / 1000))) : 0;


  /* ---- Gist me: facts go to Memory, nothing else is kept ---- */
  const { addLifeItem, updateLifeItem } = useApp();
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const memoryFacts = useCallback(() => buildChatContext(stateRef.current.life as Record<string, Memory[]> | null), []);
  const takeFacts = useCallback((r: TellReply) => {
    const stored = Object.values((stateRef.current.life || {}) as Record<string, Memory[]>).flat();
    const { add, update } = reconcileChatFacts(r.extracted_facts || [], stored);
    add.forEach((f) => addLifeItem(f.text, f.category, 'From Gist me'));
    update.forEach((u) => updateLifeItem(u.id, { text: u.text, source: 'Corrected in Gist me' }));
    if (add.length || update.length) { setOkToast(add.length ? 'Added to Memory' : 'Memory updated'); setTimeout(() => setOkToast(null), 3000); }
  }, [addLifeItem, updateLifeItem]);
  useEffect(() => {
    const run = () => { flushOutbox({ history: [], facts: memoryFacts() }, takeFacts).then((n) => { if (n > 0) { setOkToast(`Back online. ${n} ${n === 1 ? 'thing' : 'things'} sent.`); setTimeout(() => setOkToast(null), 4000); } }); };
    run();
    window.addEventListener('online', run);
    return () => window.removeEventListener('online', run);
  }, [memoryFacts, takeFacts]);

  /* ---- coming back from WhatsApp ---- */
  useEffect(() => {
    const check = () => { try { const id = sessionStorage.getItem(WA_KEY); if (id && document.visibilityState === 'visible') setWaPending(id); } catch { /* private mode */ } };
    check();
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);
  const waTask = waPending ? tasks.find((t) => String(t.id) === waPending && t.status !== 'done' && !state.done[t.id]) : null;
  const clearWa = () => { try { sessionStorage.removeItem(WA_KEY); } catch { /* ignore */ } setWaPending(null); };

  /* ---- actions ---- */
  const flash = (msg: string) => { setOkToast(msg); setTimeout(() => setOkToast(null), 3000); };

  const markDone = useCallback((t: Task) => {
    completeTask(t.id);
    setUndo({ id: t.id, label: `Done: ${t.title}` });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 6000);
  }, [completeTask]);

  const undoDone = () => {
    if (!undo) return;
    setState((p) => ({ ...p, done: { ...p.done, [undo.id]: false } }));
    syncTaskWithSupabase({ id: String(undo.id), status: 'open' });
    setUndo(null);
  };

  const startTimer = (t: Task) => { router.push(`/focus?task=${encodeURIComponent(String(t.id))}`); };

  const openWhatsApp = (t: Task) => { try { sessionStorage.setItem(WA_KEY, String(t.id)); } catch { /* ignore */ } };

  const snooze = (t: Task, kind: 'evening' | 'tomorrow') => {
    const until = snoozeUntil(kind, new Date()).toISOString();
    setState((p) => ({ ...p, tasks: (p.tasks || []).map((x) => (x.id === t.id ? { ...x, hidden_until: until } : x)) }));
    flash(kind === 'evening' ? 'Back this evening.' : 'Back tomorrow morning.');
  };
  const notToday = (t: Task) => {
    setState((p) => ({ ...p, tasks: (p.tasks || []).map((x) => (x.id === t.id ? { ...x, status: 'moved' as const } : x)) }));
    syncTaskWithSupabase({ id: String(t.id), status: 'moved' });
    flash('Off today. It stays in Memory.');
  };

  /* ---- nudge from the decider (code decides, the model only words it) ---- */
  const [nudge, setNudge] = useState<(DeciderResult & { id?: string }) | null>(null);
  const life = state.life;
  const memCount = life ? Object.values(life).reduce((n, a) => n + (Array.isArray(a) ? a.length : 0), 0) : 0;
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const today = JSON.parse(localStorage.getItem('gist_interventions_today_v1') || '[]');
        const outcomes = JSON.parse(localStorage.getItem('gist_intervention_outcomes_v1') || '[]');
        const memories: Memory[] = [];
        Object.values(life || {}).forEach((arr) => Array.isArray(arr) && arr.forEach((m) => { if (!m.gone && !m.rejected && m.status !== 'deleted') memories.push(m); }));
        const res = await fetch('/api/interventions/decide', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_profile: { quiet_start: '22:00', quiet_end: '07:00', nudge_level: state.nudge || 'morning_and_when_helps' }, memories, interventions_today: today, recent_outcomes: outcomes }),
        });
        if (!res.ok || !live) return;
        const data = await res.json();
        setNudge(data.decision !== 'silent' && data.text ? data : null);
      } catch { if (live) setNudge(null); }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memCount]);

  const nudgeOutcome = (outcome: InterventionOutcome) => {
    if (!nudge) return;
    try {
      const outs = JSON.parse(localStorage.getItem('gist_intervention_outcomes_v1') || '[]'); outs.push({ kind: nudge.kind, outcome, at: new Date().toISOString() });
      localStorage.setItem('gist_intervention_outcomes_v1', JSON.stringify(outs));
      const day = JSON.parse(localStorage.getItem('gist_interventions_today_v1') || '[]'); day.push({ id: nudge.id, kind: nudge.kind, decision: nudge.decision, shown_at: new Date().toISOString(), outcome });
      localStorage.setItem('gist_interventions_today_v1', JSON.stringify(day));
    } catch { /* ignore */ }
    if (nudge.id) fetch('/api/interventions/outcome', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intervention_id: nudge.id, outcome }) }).catch(() => {});
    setNudge(null);
  };

  /* ---- derived copy ---- */
  const hasYesterday = Boolean((state.hist && state.hist.length > 0) || (state.tomorrow && state.tomorrow.length > 0));
  const [yesterdayNew, setYesterdayNew] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => { try { setYesterdayNew(hasYesterday && sessionStorage.getItem(OPENED_KEY) !== '1'); } catch { setYesterdayNew(hasYesterday); } }, 0);
    return () => clearTimeout(t);
  }, [hasYesterday]);
  const evening = now ? (params.get('eve') === '1' || (state.eveDate !== dayKey(now) && isEvening(now))) : false;
  const dateLabel = now ? now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  const name = firstName(state.name);
  const main = open.slice(0, 3);
  const rest = open.slice(3);

  const openCount = open.length;
  const hasMemoryNews = (life?.patterns || []).some((m) => m.confidence === 'hypothesized' && !m.gone && !m.rejected && !m.snooze);

  const card = (t: Task, hero = false) => {
    const link = waLink(t.contact_phone);
    const call = telLink(t.contact_phone);
    const person = t.contact_name || 'them';
    const isFollow = t.kind === 'follow';
    const mins = t.duration_min || t.dur;
    const lock = now ? lockedUntil(t, now) : null;
    const opens = lock ? fmt12(`${lock.getHours()}:${String(lock.getMinutes()).padStart(2, '0')}`) : '';
    return (
      <div key={String(t.id)} id={`card-${t.id}`}>
        <ItemCard
          hero={hero || focusId === String(t.id)}
          tag={t.kind ? { kind: t.kind, text: t.tag_text || (t.kind === 'follow' ? 'Follow-up' : t.kind === 'due' ? 'Due' : 'Free window') } : undefined}
          time={fmt12(t.at)}
          title={t.title}
          why={t.why || undefined}
          href={`/task/${t.id}`}
          note={lock && now ? `${opensIn(lock, now)}. You can mark it done once it starts.` : t.kind === 'free' && mins ? `${mins} min free` : undefined}
          actions={
            <>
              {lock ? <Button disabled>Opens at {opens}</Button> : <Button variant="primary" hero={hero} icon="check" onClick={() => markDone(t)}>Done</Button>}
              {isFollow && link && <IconButton icon="whatsapp" label={`WhatsApp ${person}`} href={link} onClick={() => openWhatsApp(t)} />}
              {isFollow && call && <IconButton icon="call" label={`Call ${person}`} href={call} />}
              {!isFollow && <Button icon="timer" onClick={() => startTimer(t)}>Start timer</Button>}
              <span className="fk-spacer" />
              <IconButton icon="more" label={`More options for ${t.title}`} onClick={() => setMenuFor(menuFor === t.id ? null : t.id)} />
            </>
          }
        />
        {menuFor === t.id && (
          <Menu onClose={() => setMenuFor(null)} items={[
            { title: 'Snooze to this evening', sub: 'Back at 6:00 PM', onSelect: () => snooze(t, 'evening') },
            { title: 'Snooze to tomorrow', sub: 'Back at 9:00 AM', onSelect: () => snooze(t, 'tomorrow') },
            { title: 'Not today', sub: 'Take it off today. It stays in Memory.', onSelect: () => notToday(t) },
          ]} />
        )}
      </div>
    );
  };

  const connection = state.net === 'offline'
    ? <Strip kind="off">Offline. Saved on this phone, sending when you&apos;re back.</Strip>
    : state.net === 'slow'
    ? <Strip kind="slow">Slow connection. Showing what I had.</Strip>
    : state.net === 'error'
    ? <Strip kind="off">Can&apos;t reach me right now. Your messages are saved.</Strip>
    : null;

  const firstDay = Boolean(state.fresh && !state.touched);

  return (
    <Screen
      bottom={<TabBar active="today" dot={hasMemoryNews} onTell={() => setTalkOpen(true)} hint={firstDay ? 'type it here' : undefined} />}
      overlay={
        <>
          {undo ? <Toast onUndo={undoDone}>{undo.label}</Toast>
          : okToast ? <Toast tone="ok">{okToast}</Toast>
          : state.synced > 0 ? <Toast tone="ok">Back online. {state.synced} {state.synced === 1 ? 'thing' : 'things'} sent.</Toast>
          : null}
          <ChatSheet open={talkOpen} onClose={() => setTalkOpen(false)} getContext={memoryFacts} onFacts={takeFacts} />
        </>
      }
    >
      {connection}
      <div className="fk-date" suppressHydrationWarning>{dateLabel}</div>
      <h1 className="fk-h1" suppressHydrationWarning>Hello{name ? <>, <span className="fk-mark">{name}.</span></> : <span className="fk-mark">.</span>}</h1>

      {state.net === 'offline' && state.queue > 0 && (
        <div style={{ marginTop: 14 }}><span className="fk-btn" style={{ minHeight: 34, cursor: 'default' }}><Icon name="clock" size={16} />{state.queue} {state.queue === 1 ? 'thing' : 'things'} waiting to send</span></div>
      )}

      {hasYesterday && (
        <Row href="/yesterday" small={yesterdayNew ? 'Yesterday is ready' : 'Yesterday'}>
          {state.hist?.[0]?.items?.length ? `${state.hist[0].items.length} ${state.hist[0].items.length === 1 ? 'thing' : 'things'} came up. See where they ended.` : 'See how it went.'}
        </Row>
      )}

      {focusTimer && (
        <a href="/focus" className="fk-timerchip" aria-label={`Timer running, ${mmss(timerLeft)} left on ${focusTimer.task.title}`}>
          <span className="fk-ring"><Icon name="timer" size={24} /></span>
          <span style={{ flex: 1 }}><b>{focusTimer.paused ? 'Paused' : `${mmss(timerLeft)} left`}</b><span className="fk-sub">{focusTimer.task.title}</span></span>
          <Icon name="chev" size={22} stroke={2.8} />
        </a>
      )}

      {waTask && (
        <div style={{ marginTop: 14 }}>
          <Card hero>
            <div className="fk-card-time">Back from WhatsApp</div>
            <div className="fk-card-title" style={{ marginTop: 4 }}>Did you reply to {waTask.contact_name || 'them'}?</div>
            <div className="fk-actions">
              <Button variant="primary" hero icon="check" onClick={() => { markDone(waTask); clearWa(); }}>Yes, I did</Button>
              <Button onClick={clearWa}>Not yet</Button>
            </div>
          </Card>
        </div>
      )}

      {nudge && (
        <div style={{ marginTop: 14 }}>
          <Card>
            <div className="fk-card-time">From your nudges</div>
            <div className="fk-card-title" style={{ marginTop: 4 }}>{nudge.text}</div>
            {nudge.why && <div className="fk-card-why"><b>Why:</b> {nudge.why}</div>}
            <div className="fk-actions">
              <Button variant="primary" onClick={() => nudgeOutcome('acted')}>Noted</Button>
              <Button onClick={() => nudgeOutcome('snoozed')}>Later</Button>
              <span className="fk-spacer" />
              <TextLink onClick={() => nudgeOutcome('dismissed')}>Not now</TextLink>
            </div>
          </Card>
        </div>
      )}

      {soon && (
        <div style={{ marginTop: 14 }}>
          <Card hero>
            <span className="fk-tag fk-tag-soon">Starting soon</span>
            <div className="fk-card-title">{soon.title} starts at {fmt12(soon.at)}.</div>
            <div className="fk-card-why">Want a timer, or just a reminder?</div>
            <div className="fk-actions">
              <Button variant="primary" hero icon="timer" onClick={() => startTimer(soon)}>Start timer</Button>
              <Button onClick={() => setTalkOpen(true)}>Just a time</Button>
            </div>
          </Card>
        </div>
      )}

      {evening && (
        <div style={{ marginTop: 14 }}>
          <Card hero>
            <div className="fk-card-time">Evening</div>
            <div className="fk-card-title" style={{ marginTop: 4 }}>Where did things end up?</div>
            <div className="fk-card-why">Optional. A minute, and tomorrow starts knowing.</div>
            <div className="fk-actions"><Button variant="primary" hero href="/evening">Close the day</Button><TextLink onClick={() => setState((p) => ({ ...p, eveDone: true, eveDate: dayKey(new Date()) }))}>Not tonight</TextLink></div>
          </Card>
        </div>
      )}

      {now && openCount === 0 ? (
        <Section title="Nothing planned yet">
          <Card>
            <div className="fk-card-title" style={{ marginTop: 0 }}>Say what is on your mind.</div>
            <div className="fk-card-why">I will turn what you tell me into a few things that matter today. Nothing gets added unless you say so.</div>
            <div className="fk-actions"><Button variant="primary" hero onClick={() => setTalkOpen(true)}>Gist me</Button></div>
          </Card>
        </Section>
      ) : (
        <>
          <Section title="What matters today" caption="Suggested. Tap ⋯ to change.">{main.map((t, i) => card(t, i === 0 && !soon && !waTask))}</Section>
          {rest.length > 0 && <Section title="The rest of today">{rest.map((t) => card(t))}</Section>}
        </>
      )}
    </Screen>
  );
}

export default function TodayPage() {
  return (
    <Suspense fallback={<Screen><div className="fk-skel" style={{ marginTop: 80 }}><i style={{ width: '40%' }} /><i /><i style={{ width: '70%' }} /></div></Screen>}>
      <TodayContent />
    </Suspense>
  );
}
