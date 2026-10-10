'use client';

import React, { useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PhoneShell } from '@/components/layout/PhoneShell';
import { Arrow } from '@/components/icons/Icons';
import { useApp } from '@/context/AppContext';

function BuildingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auto = searchParams.get('auto') === '1';

  const { state } = useApp();

  const lifeItems: any[] = Array.isArray(state.life) ? state.life : [];
  const rows: Array<[string, string, string]> = lifeItems.slice(-6).reverse().map((item: any) => {
    let color = 'w';
    let label = 'You remembered';

    if (item.category === 'projects') { color = 'pu'; label = "You're working on"; }
    if (item.category === 'people') { color = 'o'; label = 'Someone who matters'; }
    if (item.category === 'places') { color = 'l'; label = 'You spend time at'; }
    if (item.category === 'prefs' || item.category === 'how_i_work') { color = 'w'; label = 'How you work'; }
    if (item.category === 'commitments') { color = 'pu'; label = 'Open commitment'; }

    return [color, label, item.text || item.value || ''];
  });

  const step = 0.5;
  const end = rows.length * step + 0.4;

  useEffect(() => {
    if (auto) {
      const timer = setTimeout(() => {
        router.push('/today');
      }, (end + 2.6) * 1000);
      return () => clearTimeout(timer);
    }
  }, [auto, end, router]);

  return (
    <PhoneShell>
      <div className="af">
        <h1 className="bh">
          Reading what
          <br />
          you told me.
        </h1>
        <p className="m" style={{ margin: '0 0 18px', textAlign: 'left' }}>
          Using only that. Nothing else.
        </p>

        {rows.length > 0 ? (
          rows.map((r, i) => (
            <div
              key={i}
              className="bl"
              style={{ animationDelay: `${(i * step).toFixed(2)}s` }}
            >
              <i className={`dt ${r[0]}`} />
              <span>
                <small>{r[1]}</small>
                {r[2]}
              </span>
            </div>
          ))
        ) : (
          <div className="bl" style={{ animationDelay: '0s' }}>
            <span>Starting from a blank page. I&apos;ll learn as we go.</span>
          </div>
        )}

        <div
          className="bready"
          style={{ animationDelay: `${end.toFixed(2)}s` }}
        >
          <b>Your first day is ready.</b>
          <Link className="btn inl" href="/today">
            See my day <Arrow dir="r" />
          </Link>
        </div>
      </div>
    </PhoneShell>
  );
}

export default function BuildingPage() {
  return (
    <Suspense fallback={null}>
      <BuildingContent />
    </Suspense>
  );
}
