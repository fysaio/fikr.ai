'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LifeItemIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/life');
  }, [router]);

  return null;
}
