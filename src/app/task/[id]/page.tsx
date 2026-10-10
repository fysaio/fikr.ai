'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TaskRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/today?ask=timer&tid=${id}`);
  }, [id, router]);

  return null;
}
