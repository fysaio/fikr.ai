'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { createClient } from '@/lib/supabase/client';
import { BackLink, Button, Modal, Row, Screen, Segmented, TabBar, TellSheet } from '@/components/fk';
import { useSettings } from '@/lib/settings/useSettings';
import { clearDevice } from '@/lib/session/device';
import { disablePush } from '@/lib/pwa/push';
import { fmt12 } from '@/lib/today/derive';

export default function ProfilePage() {
  const router = useRouter();
  const { state, setTheme, resetToFresh } = useApp();
  const [settings] = useSettings();
  const [email, setEmail] = useState('');
  const [talk, setTalk] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    try { createClient().auth.getUser().then(({ data }) => { if (live) setEmail(data.user?.email || ''); }).catch(() => {}); } catch { /* not configured */ }
    return () => { live = false; };
  }, []);

  const on = Object.values(settings.speak).filter(Boolean).length;
  const speak = on === 4 ? 'Everything' : on === 0 ? 'Nothing' : 'Only what matters';
  const q = settings.quiet;
  const quiet = q.late ? `After ${fmt12(q.lateFrom).replace(':00', '')}` : Object.values(q).some((v) => v === true) ? 'On' : 'Off';
  const name = state.name || 'You';

  const logout = async () => {
    setBusy(true);
    try { await clearDevice({ flush: true }); } catch { /* keep going */ }
    await disablePush();
    try { await createClient().auth.signOut(); } catch { /* offline or not configured */ }
    resetToFresh();
    router.replace('/welcome');
  };

  return (
    <Screen bottom={<TabBar active="memory" onTell={() => setTalk(true)} />} overlay={<>
      <TellSheet open={talk} onClose={() => setTalk(false)} />
      {confirmOut && (
        <Modal title="Log out?" onClose={() => setConfirmOut(false)}>
          <p>Your memory stays safe. Anything waiting to send goes first.</p>
          <div className="fk-actions"><Button variant="primary" hero onClick={logout} disabled={busy}>{busy ? 'Logging out…' : 'Log out'}</Button><Button onClick={() => setConfirmOut(false)}>Stay</Button></div>
        </Modal>
      )}
    </>}>
      <BackLink href="/life" label="Back to Life" />
      <div className="fk-settings-who">
        <div className="fk-avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</div>
        <div><h1 className="fk-display fk-life-h" style={{ margin: 0 }}>You</h1><p className="fk-caption" style={{ margin: 0 }}>{[state.name, email].filter(Boolean).join(' · ')}</p></div>
      </div>

      <h2 className="fk-h2">Appearance</h2>
      <Segmented label="Appearance" value={state.theme || 'dark'} onChange={setTheme}
        options={[{ value: 'auto', text: 'Match phone' }, { value: 'light', text: 'Light' }, { value: 'dark', text: 'Dark' }]} />

      <div className="fk-stack" style={{ marginTop: 20 }}>
        <Row small="When I speak up" href="/profile/speak">{speak}</Row>
        <Row small="Quiet times" href="/profile/quiet">{quiet}</Row>
        <Row small="Your data" href="/profile/data">See, export or delete</Row>
      </div>
      <div className="fk-item-foot" style={{ marginTop: 24 }}><Button onClick={() => setConfirmOut(true)}>Log out</Button></div>
    </Screen>
  );
}
