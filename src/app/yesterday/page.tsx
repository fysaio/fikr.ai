'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Section 2 Route Notes:
 * Yesterday is a panel inside /today, not a route. It expands the morning interpretation.
 * No story or swipe format.
 */
export default function YesterdayPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/today');
  }, [router]);

  return null;
}
