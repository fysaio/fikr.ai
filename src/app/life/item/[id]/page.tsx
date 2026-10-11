'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { FIXTURE_LIFE_DATA } from '@/fixtures';
import { Memory } from '@/types';
import { Button, Card, Icon, IconButton, Screen, TabBar, TellSheet } from '@/components/fk';
import { telLink, tidyPhone, waLink } from '@/lib/today/derive';

const TITLES: Record<string, string> = { people: 'People', projects: 'Projects', goals: 'Goals', commitments: 'Commitments', prefs: 'Preferences', places: 'Preferences', history: 'History', patterns: 'Patterns' };

function when(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function LifeItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { state, updateLifeItem, forgetLifeItem, showToast } = useApp();
  const [talk, setTalk] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit' | 'forget' | 'number' | 'confirmNumber'>('view');
  const [draft, setDraft] = useState('');
  const [numberText, setNumberText] = useState('');
  useEffect(() => { const t = setTimeout(() => setMounted(true), 0); return () => clearTimeout(t); }, []);

  const find = (src: Record<string, Memory[]> | null | undefined) => {
    for (const cat in src || {}) { const f = (src as Record<string, Memory[]>)[cat].find((x) => x.id === id); if (f) return f; }
    return undefined;
  };
  const item = find(state.life) || (mounted ? find(FIXTURE_LIFE_DATA) : undefined);

  const shell = (children: React.ReactNode) => (
    <Screen bottom={<TabBar active="memory" onTell={() => setTalk(true)} />} overlay={<TellSheet open={talk} onClose={() => setTalk(false)} />}>{children}</Screen>
  );

  if (!item) {
    return shell(<>
      <IconButton icon="chev" label="Back to Life" href="/life" />
      <p className="fk-caption" style={{ marginTop: 20 }}>{mounted ? 'This is gone or was forgotten.' : ''}</p>
    </>);
  }

  const cat = TITLES[item.category] ? item.category : 'people';
  const back = `/life/${cat === 'places' ? 'prefs' : cat}`;
  const guess = item.confidence === 'hypothesized';
  const first = item.text.split(/\s+/)[0];
  const tidy = tidyPhone(numberText);
  const wa = waLink(item.phone);
  const tel = telLink(item.phone);
  const date = when(item.created_at);
  const source = (item.source || '').replace(/^Learned from /, '');

  const saveEdit = () => {
    const t = draft.trim();
    if (!t) return;
    updateLifeItem(item.id, { text: t, confidence: 'stated', source: 'You edited this' });
    setMode('view');
    showToast('Updated');
  };
  const forget = async () => { await forgetLifeItem(item.id); showToast("Forgotten. I won't bring this up again."); router.push(back); };
  const startTimer = () => { router.push(`/focus?title=${encodeURIComponent(item.text)}`); };

  return shell(
    <>
      <Link href={back} className="fk-iconbtn" aria-label={`Back to ${TITLES[cat]}`}><span style={{ display: 'flex', transform: 'rotate(180deg)' }}><Icon name="chev" size={20} /></span></Link>
      <p className="fk-eyebrow">{guess ? 'A guess' : TITLES[cat]}</p>

      {mode === 'edit' ? (
        <div className="fk-stack">
          <textarea className="fk-textarea" aria-label="Change this" value={draft} rows={3} maxLength={400} autoFocus onChange={(e) => setDraft(e.target.value)} />
          <div className="fk-actions"><Button variant="primary" hero onClick={saveEdit}>Save</Button><Button onClick={() => setMode('view')}>Cancel</Button></div>
        </div>
      ) : (
        <h1 className="fk-display fk-item-h">{item.text}</h1>
      )}

      {cat === 'people' && mode !== 'edit' && (
        item.phone && mode !== 'number' && mode !== 'confirmNumber' ? (
          <Card>
            <small className="fk-label">Reach {first}</small>
            <b className="fk-phone">{tidyPhone(item.phone)?.display || item.phone}</b>
            <div className="fk-actions">
              {wa && <Button variant="primary" href={wa} external>WhatsApp</Button>}
              {tel && <Button href={tel}>Call</Button>}
            </div>
            <p className="fk-caption">Opens WhatsApp or your phone. I never message {first} for you.</p>
            <button className="fk-link" onClick={() => { setNumberText(''); setMode('number'); }}>Change number</button>
          </Card>
        ) : mode === 'number' ? (
          <Card>
            <b>What&apos;s {first}&apos;s number?</b>
            <p className="fk-caption">Type it however you have it. I&apos;ll tidy it.</p>
            <textarea className="fk-textarea" aria-label="Number" rows={2} autoFocus value={numberText} placeholder="Her WhatsApp is 0801 234 5678" onChange={(e) => setNumberText(e.target.value)} />
            <div className="fk-actions"><Button variant="primary" hero onClick={() => (tidy ? setMode('confirmNumber') : showToast("I couldn't find a number in that."))}>Tidy it</Button><Button onClick={() => setMode('view')}>Cancel</Button></div>
          </Card>
        ) : mode === 'confirmNumber' && tidy ? (
          <Card>
            <b>Is this right?</b>
            <b className="fk-phone">{first} · {tidy.display}</b>
            <p className="fk-caption">For WhatsApp and calls. Only on your account. I never message {first}.</p>
            <div className="fk-actions"><Button variant="primary" hero onClick={() => { updateLifeItem(item.id, { phone: tidy.display }); setMode('view'); showToast('Number saved'); }}>Yes, save it</Button><Button onClick={() => setMode('number')}>Fix it</Button></div>
          </Card>
        ) : (
          <Card>
            <b>No number yet</b>
            <p className="fk-caption">Add {first}&apos;s number to message or call from here.</p>
            <div className="fk-actions"><Button variant="primary" onClick={() => { setNumberText(''); setMode('number'); }}>Add number</Button></div>
          </Card>
        )
      )}

      {guess ? (
        <>
          <section className="fk-item-sec"><h2 className="fk-h2">Why I think this</h2><p>{(item.evidence || []).join(' ') || 'I noticed it more than once.'}</p></section>
          <section className="fk-item-sec"><h2 className="fk-h2">How sure am I?</h2><p>Not very. I worked this out. You didn&apos;t tell me, so I won&apos;t treat it as fact.</p></section>
          <div className="fk-actions fk-item-actions">
            <Button onClick={() => { updateLifeItem(item.id, { snooze: true }); showToast("No problem. I'll keep it as a guess."); router.push(back); }}>Not sure yet</Button>
            <Button variant="primary" hero onClick={() => { updateLifeItem(item.id, { confidence: 'stated', source: 'You confirmed this', evidence: [] }); showToast('Saved as something you told me'); }}>Feels true</Button>
            <Button onClick={() => { updateLifeItem(item.id, { rejected: true, status: 'rejected' }); showToast("Okay. I won't say that again."); router.push(back); }}>Not really</Button>
          </div>
        </>
      ) : (
        <>
          <section className="fk-item-sec"><h2 className="fk-h2">Where this came from</h2><p>{source || 'You told me.'}{date ? ` ${date}.` : ''}</p></section>
          {cat === 'projects' && <div className="fk-actions fk-item-actions"><Button variant="primary" hero onClick={startTimer}>Start timer</Button></div>}
          {cat === 'goals' && <div className="fk-actions fk-item-actions"><Button variant="primary" hero onClick={() => { updateLifeItem(item.id, { category: 'projects' }); showToast('Now a project'); router.push('/life/projects'); }}>Turn it into a project</Button></div>}
        </>
      )}

      {mode === 'forget' ? (
        <Card>
          <b>Forget this?</b>
          <p className="fk-caption">I won&apos;t remember it or bring it up again.</p>
          <div className="fk-actions"><Button variant="primary" hero onClick={forget}>Forget</Button><Button onClick={() => setMode('view')}>Keep</Button></div>
        </Card>
      ) : (
        mode === 'view' && !guess && (
          <div className="fk-item-foot">
            <Button onClick={() => { setDraft(item.text); setMode('edit'); }}>Change something</Button>
            <button className="fk-link fk-danger" onClick={() => setMode('forget')}>Forget</button>
          </div>
        )
      )}
    </>
  );
}
