'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { BackLink, Button, InstallSheet, NotifyAsk, Screen, TabBar, TellSheet, Toggle } from '@/components/fk';
import { enablePush, disablePush } from '@/lib/pwa/push';
import { isIOS, isStandalone } from '@/lib/pwa/store';
import { useSettings } from '@/lib/settings/useSettings';
import { dayKey } from '@/lib/settings/settings';

type Perm = 'default' | 'granted' | 'denied' | 'unsupported';

export default function SpeakPage() {
  const { showToast } = useApp();
  const [s, update] = useSettings();
  const [talk, setTalk] = useState(false);
  const [perm, setPerm] = useState<Perm>('default');
  const [standalone, setStandalone] = useState(false);
  const [sheet, setSheet] = useState<null | 'install' | 'ask'>(null);

  useEffect(() => {
    const t = setTimeout(() => { setStandalone(isStandalone()); setPerm(typeof Notification === 'undefined' ? 'unsupported' : (Notification.permission as Perm)); }, 0);
    return () => clearTimeout(t);
  }, []);

  const set = (k: keyof typeof s.speak) => (v: boolean) => update((p) => ({ ...p, speak: { ...p.speak, [k]: v } }));
  const today = dayKey(new Date());
  const quietToday = s.quietToday === today;

  // iPhone only delivers nudges from an installed app, so install comes first.
  const wantNudges = () => setSheet(isIOS() && !isStandalone() ? 'install' : 'ask');
  const askPhone = async () => {
    setSheet(null);
    const r = await enablePush();
    setPerm(r === 'unsupported' ? 'unsupported' : r);
    showToast(r === 'granted' ? 'Nudges are on for this phone' : r === 'denied' ? "Okay. I'll show everything on Today." : "This browser can't show nudges.");
  };

  return (
    <Screen bottom={<TabBar active="memory" onTell={() => setTalk(true)} />} overlay={<>
      <TellSheet open={talk} onClose={() => setTalk(false)} />
      {sheet === 'install' && <InstallSheet onClose={() => setSheet(null)} onDone={() => setSheet('ask')} />}
      {sheet === 'ask' && <NotifyAsk title="Allow nudges?" onYes={askPhone} onNo={() => setSheet(null)} />}
    </>}>
      <BackLink href="/profile" label="Back to settings" />
      <h1 className="fk-display fk-life-h">When I speak up</h1>
      <p className="fk-caption">I&apos;d rather say less. Pick what&apos;s worth an interruption.</p>
      <div className="fk-stack" style={{ marginTop: 16 }}>
        <Toggle label="Orientation" sub="A short read of your day" on={s.speak.orientation} onChange={set('orientation')} />
        <Toggle label="Right moment" sub="A free window for something you planned" on={s.speak.moment} onChange={set('moment')} />
        <Toggle label="Reflection" sub="Something I've noticed, as a question" on={s.speak.reflection} onChange={set('reflection')} />
        <Toggle label="People" sub="Someone you said you'd follow up with" on={s.speak.people} onChange={set('people')} />
      </div>
      <div className="fk-stack" style={{ marginTop: 20 }}>
        <Toggle label="Nudges on this phone" sub={perm === 'granted' ? 'On' : perm === 'denied' ? 'Blocked in your phone settings' : 'Needs your phone\'s okay'} on={perm === 'granted'} onChange={(v) => { if (v) wantNudges(); else { disablePush(); showToast('Nudges are off for this phone. Your phone settings have the last word.'); } }} />
        {perm === 'denied' && <div className="fk-card"><b>Notifications are off on this phone</b><p className="fk-caption">I&apos;ll show everything on Today instead. To turn them on, open your phone settings, find Fikr, and allow notifications.</p></div>}
        {!standalone && <Button onClick={() => setSheet('install')}>Put Fikr on your home screen</Button>}
        <p className="fk-caption" style={{ margin: 0 }}>Opens faster, works with weak signal</p>
      </div>
      <div className="fk-item-foot" style={{ marginTop: 20 }}>
        <Button onClick={() => { update((p) => ({ ...p, quietToday: quietToday ? null : today })); showToast(quietToday ? 'Back to normal.' : 'Quiet for the rest of today.'); }}>{quietToday ? 'Undo quiet for today' : 'Quiet for today'}</Button>
      </div>
    </Screen>
  );
}
