'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { BackLink, Button, Screen, TabBar, TellSheet, Toggle } from '@/components/fk';
import { useSettings } from '@/lib/settings/useSettings';
import { dayKey } from '@/lib/settings/settings';

type Perm = 'default' | 'granted' | 'denied' | 'unsupported';
interface InstallEvent extends Event { prompt: () => Promise<void> }

export default function SpeakPage() {
  const { showToast } = useApp();
  const [s, update] = useSettings();
  const [talk, setTalk] = useState(false);
  const [perm, setPerm] = useState<Perm>('default');
  const [install, setInstall] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setPerm(typeof Notification === 'undefined' ? 'unsupported' : (Notification.permission as Perm)), 0);
    const h = (e: Event) => { e.preventDefault(); setInstall(e as InstallEvent); };
    window.addEventListener('beforeinstallprompt', h);
    return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', h); };
  }, []);

  const set = (k: keyof typeof s.speak) => (v: boolean) => update((p) => ({ ...p, speak: { ...p.speak, [k]: v } }));
  const today = dayKey(new Date());
  const quietToday = s.quietToday === today;

  const askPermission = async () => {
    if (perm === 'unsupported') return showToast("This browser can't show nudges.");
    const r = await Notification.requestPermission();
    setPerm(r as Perm);
    showToast(r === 'granted' ? 'Nudges are on for this phone' : 'Nudges stay off. You can change this in your phone settings.');
  };
  const addToHome = async () => {
    if (install) { await install.prompt(); setInstall(null); } else showToast('Open your browser menu and choose Add to Home Screen.');
  };

  return (
    <Screen bottom={<TabBar active="memory" onTell={() => setTalk(true)} />} overlay={<TellSheet open={talk} onClose={() => setTalk(false)} />}>
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
        <Toggle label="Nudges on this phone" sub={perm === 'granted' ? 'On' : perm === 'denied' ? 'Blocked in your phone settings' : 'Needs your phone\'s okay'} on={perm === 'granted'} onChange={(v) => { if (v) askPermission(); else showToast('Turn nudges off in your phone settings.'); }} />
        <Button onClick={addToHome}>Put Fikr on your home screen</Button>
        <p className="fk-caption" style={{ margin: 0 }}>Opens faster, works with weak signal</p>
      </div>
      <div className="fk-item-foot" style={{ marginTop: 20 }}>
        <Button onClick={() => { update((p) => ({ ...p, quietToday: quietToday ? null : today })); showToast(quietToday ? 'Back to normal.' : 'Quiet for the rest of today.'); }}>{quietToday ? 'Undo quiet for today' : 'Quiet for today'}</Button>
      </div>
    </Screen>
  );
}
