'use client';
// The family of flow sites in Oreum: the strip at the top of the footer on every page
// (kicker and three cards, the current site marked, each sibling with its context link) and the same cards behind the
// masthead's "Other sites" item. The context comes from the path: a country sheet links to the same economy, a pair page
// to the bank cell and the flow, a shock replay to trade-flow's event page, the dollar channel to money-flow's World
// page; elsewhere the home pages. Cross-site links keep the reader's language, open in the same tab, carry no UTM.
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { FAMILY, familyCards, type FamilyCard, type FamilyContext } from '@/lib/family';
import type { Lang } from '@/lib/types';

/** What the page under `pathname` is about; `names` are economy names in the page language, `shocks` the replay ids
 *  with their labels. */
export function contextOf(pathname: string, names: Record<string, string>, shocks: Record<string, string>): FamilyContext {
  const rest = pathname.replace(/^\/(en|ko)(?=\/|$)/, '').replace(/\/$/, '');
  let m: RegExpExecArray | null;
  if ((m = /^\/c\/([A-Za-z]{3})\/with\/([A-Za-z]{3})$/.exec(rest))) {
    const a = m[1].toUpperCase(), b = m[2].toUpperCase();
    if (names[a] && names[b]) return { kind: 'pair', a, b, aName: names[a], bName: names[b] };
  }
  if ((m = /^\/c\/([A-Za-z]{3})$/.exec(rest))) {
    const iso3 = m[1].toUpperCase();
    if (names[iso3]) return { kind: 'economy', iso3, name: names[iso3] };
  }
  if (rest === '/shocks/dollar') return { kind: 'dollar' };
  if ((m = /^\/shocks\/([a-z0-9-]+)$/.exec(rest)) && shocks[m[1]]) return { kind: 'shock', id: m[1], title: shocks[m[1]] };
  return { kind: 'home' };
}

export function useFamily(lang: Lang, names: Record<string, string>, shocks: Record<string, string>): FamilyCard[] {
  const path = usePathname() ?? `/${lang}`;
  return familyCards(lang, contextOf(path, names, shocks));
}

export function FamilyCards({ lang, cards, compact }: { lang: Lang; cards: FamilyCard[]; compact?: boolean }) {
  return (
    <ul className={`gn-family__cards${compact ? ' gn-family__cards--compact' : ''}`}>
      {cards.map((c) => (
        <li key={c.id} className={`gn-family__card gn-family__card--${c.id}${c.current ? ' is-current' : ''}`} aria-current={c.current ? 'true' : undefined}>
          <p className="gn-family__name"><span lang="en">{c.name}</span>{c.current ? <span className="gn-family__here">{FAMILY.current[lang]}</span> : null}</p>
          <p className="gn-family__role">{c.role}</p>
          {c.href ? <a className="gn-family__link" href={c.href}>{c.text}<span aria-hidden="true"> →</span></a> : null}
        </li>
      ))}
    </ul>
  );
}

/** The strip: kicker and the three cards. Rendered inside the footer, above the site's own lines. */
export function FamilyStrip({ lang, names, shocks }: { lang: Lang; names: Record<string, string>; shocks: Record<string, string> }) {
  const cards = useFamily(lang, names, shocks);
  return (
    <section className="gn-family" aria-label={FAMILY.kicker[lang]}>
      <p className="gn-kicker">{FAMILY.kicker[lang]}</p>
      <FamilyCards lang={lang} cards={cards} />
    </section>
  );
}

/** The masthead item: a disclosure that opens the same three cards (reachable without scrolling). Closes on a click
 *  outside, on Escape and on navigation; without scripts it still opens and closes on its summary. */
export function FamilyMenu({ lang, names, shocks }: { lang: Lang; names: Record<string, string>; shocks: Record<string, string> }) {
  const cards = useFamily(lang, names, shocks);
  const path = usePathname();
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (ref.current) ref.current.open = false; }, [path]);
  useEffect(() => {
    const close = (e: MouseEvent | KeyboardEvent) => {
      const el = ref.current;
      if (!el || !el.open) return;
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', close); };
  }, []);
  return (
    <details ref={ref} className="gn-other">
      <summary>{FAMILY.menu[lang]}</summary>
      <div className="gn-other__pop" role="region" aria-label={FAMILY.kicker[lang]}>
        <p className="gn-kicker">{FAMILY.kicker[lang]}</p>
        <FamilyCards lang={lang} cards={cards} compact />
      </div>
    </details>
  );
}
