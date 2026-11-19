import Link from 'next/link';
import type { Metadata } from 'next';
import { plain, rich } from '@/lib/rich';
import { ShocksTabs } from '@/components/SectionTabs';
import { Head, Panel, Tag } from '@/components/ui';
import { readMeta, readShocks } from '@/lib/data';
import { siteUrl } from '@/lib/family';
import { month, quarter, window12 } from '@/lib/format';
import { pageMeta } from '@/lib/seo';
import { shock } from '@/lib/strings/shock';
import { shocks } from '@/lib/strings/shocks';
import type { Lang } from '@/lib/types';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang = raw as Lang;
  const S = shocks(lang);
  const m = readMeta();
  return pageMeta(lang, '/shocks', { title: S.title, description: `${plain(S.lede)} ${lang === 'ko' ? `자금은 ${quarter(m.money.quarter, lang)}, 교역은 ${month(m.trade.shown, lang)}까지.` : `Funding as of ${quarter(m.money.quarter, lang)}, trade to ${month(m.trade.shown, lang)}.`}` });
}

export default async function ShocksPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang = raw as Lang;
  const S = shocks(lang);
  const meta = readMeta();
  return (
    <div className="gn-wrap gn-page">
      <ShocksTabs lang={lang} current="hub" />
      <Head kicker={`${S.kicker} · ${quarter(meta.money.quarter, lang)} · ${window12(meta.trade.shown, lang)}`} title={S.title} lede={S.lede} />
      <div className="gn-hub">
        {readShocks().replays.map((r) => (
          <Panel key={r.id} tone="trade" title={r.label[lang]} period={month(r.t0, lang)}>
            <p>{r.title[lang]}</p>
            <p className="gn-small gn-muted">{rich(S.sections.replay.text)}</p>
            {r.ongoing && <p><Tag kind="warn">{shock(lang).ongoing}</Tag></p>}
            <p><Link className="gn-btn gn-btn--sm gn-btn--primary" href={`/${lang}/shocks/${r.id}`}>{shock(lang).open}</Link></p>
          </Panel>
        ))}
        {/* The episode catalogue left this site (2 Nov 2026): the card points at the two parents' own pages. */}
        <Panel tone="money" title={S.sections.episodes.title}>
          <p>{rich(S.sections.episodes.text)}</p>
          <p><a className="gn-btn gn-btn--sm" href={siteUrl('money-flow', 'method', lang)}>{S.sections.episodes.money} →</a> <a className="gn-btn gn-btn--sm" href={siteUrl('trade-flow', 'events', lang)}>{S.sections.episodes.trade} →</a></p>
        </Panel>
        <Panel title={S.sections.scenarios.title}>
          <p>{rich(S.sections.scenarios.text)}</p>
          <p><Link className="gn-btn gn-btn--sm gn-btn--primary" href={`/${lang}/shocks/scenarios`}>{S.open}</Link></p>
        </Panel>
        <Panel tone="money" title={S.sections.dollar.title}>
          <p>{rich(S.sections.dollar.text)}</p>
          <p><Link className="gn-btn gn-btn--sm gn-btn--primary" href={`/${lang}/shocks/dollar`}>{S.open}</Link></p>
        </Panel>
      </div>
    </div>
  );
}
