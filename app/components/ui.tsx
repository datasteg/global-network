// Small shared building blocks in Oreum: a lane panel, stat tiles, a source line, tags.
import Link from 'next/link';
import type { ReactNode } from 'react';

export function Panel({ tone = 'none', title, period, children, right, id }: { tone?: 'money' | 'trade' | 'none'; title?: ReactNode; period?: ReactNode; children: ReactNode; right?: ReactNode; id?: string }) {
  return (
    <section id={id} className={`gn-panel gn-lane${tone !== 'none' ? ` gn-lane--${tone}` : ''}`}>
      {(title || period || right) && (
        <div className="gn-panel__head">
          {title && <h2>{title}</h2>}
          {right}
          {period && <span className="gn-period">{period}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Tile({ label, value, unit, sub, subClass, children, big }: { label: ReactNode; value: ReactNode; unit?: ReactNode; sub?: ReactNode; subClass?: string; children?: ReactNode; big?: boolean }) {
  return (
    <div className={`gn-tile${big ? ' gn-tile--big' : ''}`}>
      <span className="gn-tile__label">{label}</span>
      <span className="gn-tile__value">{value}{unit && <small>{unit}</small>}</span>
      {sub && <span className={`gn-tile__sub${subClass ? ` ${subClass}` : ''}`}>{sub}</span>}
      {children}
    </div>
  );
}

export function Source({ children }: { children: ReactNode }) {
  return <p className="gn-source">{children}</p>;
}

export function Tag({ kind, children }: { kind?: 'good' | 'bad' | 'warn' | 'neutral'; children: ReactNode }) {
  return <span className={`gn-tag${kind ? ` gn-tag--${kind}` : ''}`}>{children}</span>;
}

export function Head({ kicker, title, lede, right }: { kicker?: ReactNode; title: ReactNode; lede?: ReactNode; right?: ReactNode }) {
  return (
    <div className="gn-head">
      {kicker && <p className="gn-kicker">{kicker}</p>}
      <div className="gn-head--row"><h1>{title}</h1>{right}</div>
      {lede && <p className="gn-lede">{lede}</p>}
    </div>
  );
}

/** A row of section tabs: links, the current one marked. Wraps instead of scrolling sideways on a phone. */
export function Tabs({ items, label }: { items: { href: string; label: ReactNode; current?: boolean }[]; label: string }) {
  return (
    <nav className="gn-tabs" aria-label={label}>
      {items.map((it, i) => (<Link key={i} href={it.href} aria-current={it.current ? 'page' : undefined}>{it.label}</Link>))}
    </nav>
  );
}
