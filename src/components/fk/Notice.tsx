import React from 'react';

/** Full-screen message: one line, one sentence, up to two actions. Used by not-found, error, offline and session. */
export function Notice({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="fk-screen">
      <main className="fk-scroll fk-notice">
        <div className="fk-notice-mark" aria-hidden="true">f</div>
        <h1 className="fk-display fk-life-h">{title}</h1>
        <p className="fk-caption" style={{ fontSize: 16 }}>{body}</p>
        <div className="fk-actions" style={{ marginTop: 20 }}>{children}</div>
      </main>
    </div>
  );
}
