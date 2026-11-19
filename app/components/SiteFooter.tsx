import Link from 'next/link';
import { FamilyStrip } from './Family';
import { readMeta } from '@/lib/data';
import { articlesUrl, siteUrl } from '@/lib/family';
import { day, month, quarter } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { Lang } from '@/lib/types';

/** The footer: the family strip first, then the site's own note, the provenance line (both parents'
 *  releases and this build) and the bare links. `names` and `shocks` give the strip its context on country, pair and
 *  shock pages. */
export function SiteFooter({ lang, names, shocks }: { lang: Lang; names: Record<string, string>; shocks: Record<string, string> }) {
  const L = t(lang);
  let line = '';
  try {
    const m = readMeta();
    line = lang === 'ko'
      ? `자금: money-flow 릴리스 ${m.money.release} (방법론 ${m.money.method}), ${quarter(m.money.quarter, lang)} · 교역: trade-flow ${day(m.trade.built, lang)} 빌드, ${month(m.trade.shown, lang)}까지 · 이 사이트 빌드 ${day(m.built, lang)}`
      : `Funding: money-flow release ${m.money.release} (method ${m.money.method}), ${quarter(m.money.quarter, lang)} · Trade: trade-flow built ${day(m.trade.built, lang)}, to ${month(m.trade.shown, lang)} · This build ${day(m.built, lang)}`;
  } catch { line = ''; }
  return (
    <footer className="gn-footer">
      <div className="gn-wrap">
        <FamilyStrip lang={lang} names={names} shocks={shocks} />
        <p>{L.footerNote}</p>
        {line && <p className="gn-mono">{line}</p>}
        <p>
          <Link href={`/${lang}/about#method`}>{L.nav.method}</Link> · <Link href={`/${lang}/about#sources`}>{L.nav.sources}</Link> · <a href="/feed" type="application/rss+xml">{L.feed}</a> · <a href={siteUrl('money-flow', 'home', lang)}>money-flow</a> · <a href={siteUrl('trade-flow', 'home', lang)}>trade-flow</a> · <a href={articlesUrl(lang)}>articles</a> · datasteg
        </p>
      </div>
    </footer>
  );
}
