'use client';
import React from 'react';
import { Button, Modal } from './ui';
import { isIOS, promptInstall, usePwaState } from '@/lib/pwa/store';

/** Install help. Android and desktop use the browser's prompt. iPhone has no prompt, so three steps. */
export function InstallSheet({ onClose, onDone }: { onClose: () => void; onDone?: () => void }) {
  const { install } = usePwaState();
  if (isIOS()) {
    const steps = [
      ['Tap Share', 'The square with the arrow, at the bottom of Safari.'],
      ['Add to Home Screen', 'Scroll the list a little to find it.'],
      ['Open Fikr from there', 'Then come back to settings.'],
    ];
    return (
      <Modal title="Keep Fikr on your home screen" onClose={onClose}>
        <p>On iPhone, nudges only work once Fikr is added. Three taps in Safari.</p>
        <ol className="fk-steps">{steps.map(([h, s], n) => <li key={h}><i>{n + 1}</i><span><b>{h}</b><small>{s}</small></span></li>)}</ol>
        <div className="fk-actions"><Button variant="primary" hero onClick={() => { onDone?.(); onClose(); }}>I&apos;ve added it</Button><Button onClick={onClose}>Not now</Button></div>
      </Modal>
    );
  }
  return (
    <Modal title="Put Fikr on your phone" onClose={onClose}>
      <p>It opens faster, works with a weak connection, and can send the nudges you choose.</p>
      <div className="fk-actions">
        {install
          ? <Button variant="primary" hero onClick={async () => { if (await promptInstall()) onDone?.(); onClose(); }}>Install Fikr</Button>
          : <p className="fk-caption" style={{ margin: 0 }}>Open your browser menu and choose Install or Add to Home Screen.</p>}
        <Button onClick={onClose}>Not now</Button>
      </div>
      <p className="fk-caption">It is the same app, not a download from a store.</p>
    </Modal>
  );
}

/** Asked before the phone asks. "Not now" keeps the reminder on Today. */
export function NotifyAsk({ title, onYes, onNo }: { title: string; onYes: () => void; onNo: () => void }) {
  return (
    <Modal title={title} onClose={onNo}>
      <p>I can send one notification. Your phone will ask you to allow it.</p>
      <section className="fk-item-sec" style={{ marginTop: 0 }}><h2 className="fk-h2">What I will not do</h2><p>Send streaks, daily pings or anything about people who didn&apos;t ask. You choose which kinds in settings.</p></section>
      <div className="fk-actions"><Button variant="primary" hero onClick={onYes}>Yes, ask my phone</Button><Button onClick={onNo}>Not now</Button></div>
      <p className="fk-caption">If you say not now, the reminder shows on Today instead.</p>
    </Modal>
  );
}
