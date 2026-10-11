'use client';

import { Button, Notice } from '@/components/fk';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <Notice title="That one's on me." body="Something broke on my side. Nothing you wrote is lost.">
      <Button variant="primary" hero onClick={reset}>Try again</Button>
      <Button href="/today">Go to Today</Button>
    </Notice>
  );
}
