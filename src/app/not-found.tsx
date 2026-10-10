import Link from 'next/link';
import { PhoneShell } from '@/components/layout/PhoneShell';
import { Arrow } from '@/components/icons/Icons';

export default function NotFound() {
  return (
    <PhoneShell>
      <div className="fill" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <h1 className="oq" style={{ marginBottom: '16px' }}>404</h1>
        <p className="m" style={{ marginBottom: '32px' }}>
          This page could not be found.
        </p>
        
        <Link href="/today" className="btn p" style={{ textDecoration: 'none' }}>
          <span style={{ display: 'inline-block', marginRight: '8px', verticalAlign: 'middle' }}>
            <Arrow dir="l" />
          </span>
          Return Home
        </Link>
      </div>
    </PhoneShell>
  );
}
