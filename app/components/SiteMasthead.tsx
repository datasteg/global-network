'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { t, other } from '@/lib/i18n';
import type { Lang } from '@/lib/types';
import { SiteMark } from './DatastegBar';
import { ThemeToggle } from './ThemeToggle';

type NavKey = 'overview' | 'stress' | 'economies' | 'shocks' | 'about';
/** Five sections (Stress signals since 3 Nov 2026, in the place the Fiscal Stress Monitor held). `match` lists the path prefixes (after /<lang>) that belong to each, so sub-pages light their section. */
const NAV: { key: NavKey; href: string; match: string[] }[] = [
  { key: 'overview', href: '', match: ['', '/changes', '/digest'] },
  { key: 'stress', href: '/stress', match: ['/stress'] },
  { key: 'economies', href: '/c/KOR', match: ['/c/'] },
  { key: 'shocks', href: '/shocks', match: ['/shocks'] },
  { key: 'about', href: '/about', match: ['/about'] },
];

export function SiteMasthead({ lang }: { lang: Lang; names?: Record<string, string>; shocks?: Record<string, string> }) {
  const L = t(lang);
  const pathname = usePathname() ?? `/${lang}`;
  const rest = pathname.replace(/^\/(en|ko)/, '').replace(/\/$/, '');
  const o = other(lang);
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [pathname]);
  const current = (n: (typeof NAV)[number]) => n.match.some((m) => (m === '' ? rest === '' : rest === m || rest.startsWith(m.endsWith('/') ? m : `${m}/`) || rest === m.replace(/\/$/, '')));
  const here = NAV.find(current);
  return (
    <header className="gn-masthead" data-open={open ? 'true' : undefined}>
      {/* The masthead sits in the fluid frame (1600px) on every page (site.css), so the menu never moves between pages. */}
      <div className="gn-wrap">
        <Link className="gn-wordmark" href={`/${lang}`}><SiteMark id="global-network" size={24} className="ds-wordmark-mark" />{L.siteName}</Link>
        <button type="button" className="gn-menu-btn" aria-expanded={open} aria-controls="gn-site-nav" onClick={() => setOpen((v) => !v)}>
          <span aria-hidden="true" className="gn-menu-btn__icon" />
          <span>{open ? L.nav.close : here ? L.nav[here.key] : L.nav.menu}</span>
        </button>
        <nav aria-label="Site" id="gn-site-nav">
          <ul className="gn-nav">
            {NAV.map((n) => (
              <li key={n.key}><Link href={`/${lang}${n.href}`} aria-current={current(n) ? 'page' : undefined}>{L.nav[n.key]}</Link></li>
            ))}
          </ul>
        </nav>
        <div className="gn-masthead__end">
          {/* the sibling sites are in the datasteg bar above (family/DatastegBar.tsx), which replaced the "Other sites" menu */}
          <div className="gn-lang" aria-label="Language">
            <span aria-current="true">{lang.toUpperCase()}</span>
            <Link href={`/${o}${rest}`} hrefLang={o} lang={o} onClick={() => { try { document.cookie = `datasteg-lang=${o}; path=/; max-age=31536000; samesite=lax`; } catch { /* ignore */ } }}>{o.toUpperCase()}</Link>
          </div>
          <ThemeToggle labels={{ night: L.night, day: L.dayTheme }} />
        </div>
      </div>
    </header>
  );
}
