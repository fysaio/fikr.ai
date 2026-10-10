'use client';

import React from 'react';
import Link from 'next/link';
import { PhoneShell } from '@/components/layout/PhoneShell';
import { Wordmark } from '@/components/icons/Icons';
import { SCREEN_GROUPS } from '@/components/layout/SidebarRail';

export default function ScreensPage() {
  return (
    <PhoneShell>
      <div className="fkr">
        <Wordmark height={20} />
      </div>

      <h1>All screens</h1>
      <p className="m">Tap any route.</p>

      {SCREEN_GROUPS.map(([groupTitle, links]) => (
        <React.Fragment key={groupTitle}>
          <h2>{groupTitle}</h2>
          {links.map(([href, label]) => (
            <Link key={href} className="row" href={href}>
              {label}
              <span className="m">{href}</span>
            </Link>
          ))}
        </React.Fragment>
      ))}
    </PhoneShell>
  );
}
