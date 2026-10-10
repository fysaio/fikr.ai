import Link from 'next/link';
import { Icon } from './Icon';

export interface LegalSection { h: string; p: string }

/** Draft notice pages. The copy is a draft for legal review and must not be shipped as final. */
export function LegalPage({ title, lead, sections, other }: {
  title: string; lead: string; sections: LegalSection[]; other: { href: string; label: string };
}) {
  return (
    <div className="fk-screen">
      <main className="fk-scroll">
        <Link href="/welcome" className="fk-iconbtn" aria-label="Back"><span style={{ display: "flex", transform: "rotate(180deg)" }}><Icon name="chev" size={20} /></span></Link>
        <h1 className="fk-display fk-legal-h">{title}</h1>
        <p className="fk-caption">{lead}</p>
        <p className="fk-legal-draft">Draft for legal review</p>
        {sections.map((s) => (
          <section key={s.h} className="fk-legal-sec">
            <h2 className="fk-display">{s.h}</h2>
            <p>{s.p}</p>
          </section>
        ))}
        <p style={{ marginTop: 28 }}><Link href={other.href} className="fk-link">{other.label}</Link></p>
      </main>
    </div>
  );
}
