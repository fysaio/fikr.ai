'use client';

import { Button, Notice } from '@/components/fk';

export default function OfflinePage() {
  return (
    <Notice title="I need a connection once." body="The first time you open Fikr on this phone, it has to download itself. After that it opens without internet.">
      <Button variant="primary" hero onClick={() => window.location.reload()}>Try again</Button>
      <p className="fk-caption" style={{ width: '100%', margin: 0 }}>Nothing is lost. You haven&apos;t written anything yet.</p>
    </Notice>
  );
}
