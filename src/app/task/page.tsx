'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TaskIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/today');
  }, [router]);

  return null;
}
