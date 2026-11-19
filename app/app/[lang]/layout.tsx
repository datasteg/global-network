import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import '../../../design/tokens.css';
import '../../../design/oreum.css';
import '../site.css';
// the datasteg type (www's fonts, family/fonts.ts), loaded last: it points Oreum's font tokens at Newsreader, Libre Franklin and JetBrains Mono
import '@/lib/ds-fonts';
import { DatastegBar } from '@/components/DatastegBar';
import { JsonLd } from '@/components/JsonLd';
import { PageCount } from '@/components/PageCount';
import { SiteMasthead } from '@/components/SiteMasthead';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteInfoProvider } from '@/components/SiteInfo';
import { readEarn, readMeta, readShocks } from '@/lib/data';
import { glossary } from '@/lib/glossary';
import { glossaryFacts } from '@/lib/glossary-facts';
import { isLang, LANGS, t } from '@/lib/i18n';
import { pageMeta, SITE, webSiteLd } from '@/lib/seo';
import type { Lang } from '@/lib/types';

export const dynamicParams = false;
export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isLang(lang) ? lang : 'en';
  const google = process.env.GOOGLE_SITE_VERIFICATION, naver = process.env.NAVER_SITE_VERIFICATION;
  return {
    metadataBase: new URL(SITE),
    // Open to search engines since the refurbish of 2 Nov 2026; robots.ts allows everything
    // but /health. Each route's generateMetadata replaces title, description, canonical and the language alternates.
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
    ...(google || naver ? { verification: { ...(google ? { google } : {}), ...(naver ? { other: { 'naver-site-verification': naver } } : {}) } } : {}),
    ...pageMeta(l, '', { title: `${t(l).tagline} · ${t(l).siteName}`, description: t(l).description, absolute: true }),
    title: { default: `${t(l).tagline} · ${t(l).siteName}`, template: `%s — ${t(l).siteName}` },
  };
}

// Before the first paint: the saved theme, else the system setting.
const THEME = `try{var t=localStorage.getItem('oreum-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`;

export default async function LangLayout({ children, params }: { children: ReactNode; params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;
  const L = t(lang);
  const meta = readMeta();
  const info = { lang, gloss: glossary(lang, glossaryFacts()), reads: { vintages: meta.money.vintages, wdi: readEarn().read, trade: meta.trade.built.slice(0, 10) } };
  // the family strip's context: economy names and replay labels in the page language (components/Family.tsx)
  const names: Record<string, string> = { ...Object.fromEntries(meta.economies.map((e) => [e.code, e[lang]])), ...Object.fromEntries(Object.entries(meta.hub_names).map(([c, e]) => [c, e[lang]])) };
  const shocks = Object.fromEntries(readShocks().replays.map((r) => [r.id, r.label[lang]]));
  return (
    <html lang={lang} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME }} /></head>
      <body>
        <a className="gn-skip" href="#main">{L.skip}</a>
        <DatastegBar lang={lang} site="global-network" />
        <SiteInfoProvider value={info}>
        <Suspense><SiteMasthead lang={lang} names={names} shocks={shocks} /></Suspense>
        <main id="main" tabIndex={-1}>{children}</main>
        <SiteFooter lang={lang} names={names} shocks={shocks} />
        </SiteInfoProvider>
        <Suspense><PageCount /></Suspense>
        <JsonLd data={webSiteLd(lang, L.description)} />
      </body>
    </html>
  );
}
