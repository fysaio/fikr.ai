'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { createClient } from '@/lib/supabase/client';
import { BackLink, Button, Modal, Row, Screen, TabBar, TellSheet } from '@/components/fk';
import { exportAllUserData } from '@/lib/data/data-access';
import { clearDevice } from '@/lib/session/device';

export default function DataPage() {
  const router = useRouter();
  const { state, showToast, resetToFresh } = useApp();
  const [talk, setTalk] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const exportData = async () => {
    try {
      const blob = new Blob([await exportAllUserData(state)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `fikr-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      showToast('Your export was downloaded');
    } catch { showToast("Export didn't work. Try again."); }
  };

  const deleteAll = async () => {
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/account/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: 'delete' }) });
      // Without a configured backend there is no account, only this device.
      if (!res.ok && res.status !== 401 && res.status !== 503) { setErr((await res.json().catch(() => ({}))).error || 'That did not work. Nothing was changed.'); setBusy(false); return; }
    } catch { setErr("You're offline. Deleting needs a connection."); setBusy(false); return; }
    await clearDevice({ flush: false });
    try { await createClient().auth.signOut(); } catch { /* account is gone */ }
    resetToFresh();
    router.replace('/welcome');
  };

  return (
    <Screen bottom={<TabBar active="memory" onTell={() => setTalk(true)} />} overlay={<>
      <TellSheet open={talk} onClose={() => setTalk(false)} />
      {confirm && (
        <Modal title="Delete everything?" onClose={() => setConfirm(false)}>
          <p>This removes your memory, your account and every note. It can&apos;t be undone.</p>
          <label className="fk-label" htmlFor="del">Type delete to confirm</label>
          <input id="del" className="fk-input" value={typed} autoCapitalize="none" autoComplete="off" onChange={(e) => setTyped(e.target.value)} />
          {err && <p role="alert" style={{ color: 'var(--fk-err)', marginTop: 8 }}>{err}</p>}
          <div className="fk-actions"><Button variant="primary" hero disabled={typed.trim().toLowerCase() !== 'delete' || busy} onClick={deleteAll}>{busy ? 'Deleting…' : 'Delete everything'}</Button><Button onClick={() => setConfirm(false)}>Keep my account</Button></div>
        </Modal>
      )}
    </>}>
      <BackLink href="/profile" label="Back to settings" />
      <h1 className="fk-display fk-life-h">Your data</h1>
      <div className="fk-stack" style={{ marginTop: 16 }}>
        <Row small="Everything I know about you" href="/life">Review, fix or forget</Row>
        <button type="button" className="fk-row" onClick={exportData}><span><small>Export my data</small><span className="fk-row-main">A copy you can keep</span></span></button>
      </div>
      <section className="fk-item-sec"><h2 className="fk-h2">Who sees your messages</h2><p>They go to AI services so I can reply. Details are in the privacy notice.</p></section>
      <div className="fk-actions" style={{ marginTop: 14 }}><Link href="/privacy" className="fk-link">Privacy notice</Link><Link href="/terms" className="fk-link">Terms</Link></div>
      <div className="fk-item-foot" style={{ marginTop: 28 }}><button type="button" className="fk-link fk-danger" onClick={() => { setTyped(''); setErr(''); setConfirm(true); }}>Delete everything</button></div>
    </Screen>
  );
}
