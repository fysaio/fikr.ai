'use client';

import React from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { Icon, type IconName } from './Icon';

type Cls = string | false | null | undefined;
const cx = (...c: Cls[]) => c.filter(Boolean).join(' ');

/* ---------------------------------------------------------------- Button */
interface BtnBase { children: React.ReactNode; icon?: IconName; block?: boolean; className?: string; external?: boolean }
type BtnProps =
  | (BtnBase & { href: string; onClick?: never } & { variant?: 'primary' | 'second'; hero?: boolean; disabled?: never })
  | (BtnBase & { href?: undefined; onClick?: () => void } & { variant?: 'primary' | 'second'; hero?: boolean; disabled?: boolean });

/** Lime primary is the single "do this" per screen. Hero adds the hard shadow (use once). */
export function Button(props: BtnProps) {
  const { children, icon, block, variant = 'second', hero, className } = props;
  const cls = cx('fk-btn', variant === 'primary' && 'fk-btn-primary', variant === 'second' && 'fk-btn-second', hero && 'fk-btn-hero', block && 'fk-btn-block', className);
  const inner = (<>{children}{icon && <Icon name={icon} size={icon === 'check' ? 18 : 20} stroke={variant === 'primary' ? 2.8 : 2.4} />}</>);
  if (props.href !== undefined) return props.external ? <a href={props.href} className={cls} target="_blank" rel="noopener noreferrer">{inner}</a> : <Link href={props.href} className={cls}>{inner}</Link>;
  return <button type="button" className={cls} onClick={props.onClick} disabled={props.disabled}>{inner}</button>;
}

export function IconButton({ icon, label, href, onClick, size = 22 }: { icon: IconName; label: string; href?: string; onClick?: () => void; size?: number }) {
  const inner = <Icon name={icon} size={size} />;
  if (href) {
    // External schemes (wa.me, tel:) must be plain anchors.
    const external = /^(https?:|tel:|mailto:)/.test(href);
    return external
      ? <a className="fk-iconbtn" aria-label={label} href={href} onClick={onClick} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">{inner}</a>
      : <Link className="fk-iconbtn" aria-label={label} href={href} onClick={onClick}>{inner}</Link>;
  }
  return <button type="button" className="fk-iconbtn" aria-label={label} onClick={onClick}>{inner}</button>;
}

export function TextLink({ children, href, onClick }: { children: React.ReactNode; href?: string; onClick?: () => void }) {
  return href ? <Link className="fk-link" href={href}>{children}</Link> : <button type="button" className="fk-link" onClick={onClick}>{children}</button>;
}

/* ------------------------------------------------------------------- Tag */
export type TagKind = 'follow' | 'due' | 'free' | 'soon';
export function Tag({ kind, children }: { kind: TagKind; children: React.ReactNode }) {
  return <span className={`fk-tag fk-tag-${kind}`}>{children}</span>;
}

/* ------------------------------------------------------------------ Card */
export function Card({ children, hero, className, id }: { children: React.ReactNode; hero?: boolean; className?: string; id?: string }) {
  return <div id={id} className={cx('fk-card', hero && 'fk-card-hero', className)}>{children}</div>;
}

/** A proposal card. Always shows "Why:". Time and tag are optional. */
export function ItemCard(p: { tag?: { kind: TagKind; text: string }; time?: string; title: string; why?: string; href?: string; note?: React.ReactNode; actions?: React.ReactNode; hero?: boolean; id?: string }) {
  return (
    <Card hero={p.hero} id={p.id}>
      <div className="fk-card-meta">
        {p.tag && <Tag kind={p.tag.kind}>{p.tag.text}</Tag>}
        {p.time && <span className="fk-card-time">{p.time}</span>}
      </div>
      {p.href ? <Link href={p.href} className="fk-card-title">{p.title}</Link> : <div className="fk-card-title">{p.title}</div>}
      {p.why && <div className="fk-card-why"><b>Why:</b> {p.why}</div>}
      {p.note && <div className="fk-card-note"><Icon name="timer" size={15} />{p.note}</div>}
      {p.actions && <div className="fk-actions">{p.actions}</div>}
    </Card>
  );
}

export function Row({ small, children, href }: { small: string; children: React.ReactNode; href: string }) {
  return (
    <Link href={href} className="fk-row">
      <span><small>{small}</small><span className="fk-row-main">{children}</span></span>
      <Icon name="chev" size={22} stroke={2.6} />
    </Link>
  );
}

export function Section({ title, caption, children }: { title: string; caption?: string; children?: React.ReactNode }) {
  return (
    <div className="fk-section">
      <h2 className="fk-h2">{title}</h2>
      {caption && <div className="fk-caption">{caption}</div>}
      {children && <div className="fk-stack">{children}</div>}
    </div>
  );
}

/* ----------------------------------------------------------------- Strip */
export function Strip({ kind, children, action }: { kind: 'off' | 'slow' | 'update'; children: React.ReactNode; action?: { label: string; onClick: () => void } }) {
  const icon: IconName = kind === 'off' ? 'wifioff' : kind === 'slow' ? 'wifi' : 'refresh';
  return (
    <div className="fk-strip" role="status">
      <Icon name={icon} size={20} stroke={2.3} />
      <span>{children}</span>
      {action && <button type="button" className="fk-btn fk-btn-primary" onClick={action.onClick}>{action.label}</button>}
    </div>
  );
}

/* ----------------------------------------------------------------- Toast */
export function Toast({ children, onUndo, tone = 'plain' }: { children: React.ReactNode; onUndo?: () => void; tone?: 'plain' | 'ok' }) {
  return (
    <div className={cx('fk-toast', tone === 'ok' && 'fk-toast-ok')} role="status">
      {tone === 'ok' && <Icon name="check" size={20} stroke={3} />}
      <span>{children}</span>
      {onUndo && <button type="button" onClick={onUndo}>Undo</button>}
    </div>
  );
}

/* ------------------------------------------------------------------ Menu */
export function Menu({ items, onClose }: { items: Array<{ title: string; sub?: string; onSelect: () => void }>; onClose: () => void }) {
  return (
    <div className="fk-menu" role="menu">
      {items.map((it) => (
        <button key={it.title} role="menuitem" type="button" onClick={() => { it.onSelect(); onClose(); }}>
          <b>{it.title}</b>{it.sub && <small>{it.sub}</small>}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Screen */
export function Screen({ children, bottom, overlay, bare }: { children: React.ReactNode; bottom?: React.ReactNode; overlay?: React.ReactNode; bare?: boolean }) {
  const { toastMessage } = useApp();
  return (
    <div className="fk-screen">
      <main className={cx('fk-scroll', bare && 'fk-scroll-bare')}>{children}</main>
      {bottom}
      {overlay}
      {toastMessage && <div className="fk-toast fk-toast-ok" role="status">{toastMessage}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- TabBar */
/** Today | Tell Fikr | Memory. Three targets, no more. `dot` marks unread Memory updates. */
export function TabBar({ active, dot, onTell, hint }: { active: 'today' | 'memory'; dot?: boolean; onTell: () => void; hint?: string }) {
  return (
    <>
      {hint && (
        <div className="fk-hint" aria-hidden="true">
          <span className="fk-hand">{hint}</span>
          <Icon name="chev" size={28} stroke={2.4} />
        </div>
      )}
      <nav className="fk-tabs" aria-label="Main">
        <Link href="/today" className="fk-tab" aria-current={active === 'today' ? 'page' : undefined}>
          <Icon name="home" size={25} stroke={2.2} /><span style={{ marginTop: 2 }}>Today</span><i />
        </Link>
        <button type="button" className="fk-tell" onClick={onTell} aria-label="Tell Fikr">
          <span><Icon name="tell" size={27} stroke={2.3} /></span><span>Tell Fikr</span>
        </button>
        <Link href="/life" className="fk-tab" aria-current={active === 'memory' ? 'page' : undefined}>
          <Icon name="memory" size={25} stroke={2.2} /><span style={{ marginTop: 2 }}>Memory</span><i />
          {dot && <span className="fk-dot" role="img" aria-label="New things to look at" />}
        </Link>
      </nav>
    </>
  );
}
