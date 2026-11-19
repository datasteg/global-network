import Link from 'next/link';
import type { Metadata } from 'next';
import { ShocksTabs } from '@/components/SectionTabs';
import { Head, Panel, Tag } from '@/components/ui';
import { Cite } from '@/components/Cite';
import { comtrade, money, qOne, w12 } from '@/lib/cites';
import { plain, rich } from '@/lib/rich';
import { pageMeta } from '@/lib/seo';
import type { CiteItem } from '@/lib/sources';
import { readMeta } from '@/lib/data';
import { siteUrl } from '@/lib/family';
import { quarter, window12 } from '@/lib/format';
import { scenarios } from '@/lib/strings/scenarios';
import type { Lang } from '@/lib/types';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang = raw as Lang;
  const S = scenarios(lang);
  const m = readMeta();
  return pageMeta(lang, '/shocks/scenarios', { title: S.title, description: `${plain(S.lede)} ${lang === 'ko' ? `${S.items.replay.title}(S1), ${S.items.dollar.title}(S3). ${quarter(m.money.quarter, lang)} 기준.` : `${S.items.replay.title} (S1) and ${S.items.dollar.title} (S3), as of ${quarter(m.money.quarter, lang)}.`}` });
}

export default async function ScenariosPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang = raw as Lang;
  const S = scenarios(lang);
  const meta = readMeta();
  const q = quarter(meta.money.quarter, lang);
  const qq = qOne(meta.money.quarter, lang);
  const cites: Record<'replay' | 'dollar', CiteItem[]> = {
    replay: [...money(['bis.lbs', 'bis.dss', 'imf.irfcl'], qq), comtrade(w12(meta.trade.shown, lang))],
    dollar: [{ src: 'fred', series: ['DTWEXBGS'], period: lang === 'ko' ? '분기 평균' : 'quarterly averages' }, comtrade(lang === 'ko' ? '12개월 창, 분기 말' : '12-month windows at quarter ends'), ...money(['bis.lbs', 'bis.tc'], qq)],
  };
  return (
    <div className="gn-wrap gn-page">
      <ShocksTabs lang={lang} current="scenarios" />
      <Head kicker={`${S.kicker} · ${q} · ${window12(meta.trade.shown, lang)}`} title={S.title} lede={S.lede} />
      <p className="gn-notice gn-notice--info gn-measure">{rich(S.rule)}</p>
      <div className="gn-grid-2" style={{ alignItems: 'start' }}>
        <Panel tone="money" title={<>{S.items.replay.id} · {S.items.replay.title}</>} period={q}>
          <p>{S.items.replay.text}</p>
          <p><Link className="gn-btn gn-btn--sm gn-btn--primary" href={`/${lang}/shocks/scenarios/replay`}>{S.open}</Link></p>
          <Cite items={cites.replay}>{S.items.replay.source(meta.surfaces.money.method)}</Cite>
        </Panel>
        <Panel tone="trade" title={<>{S.items.dollar.id} · {S.items.dollar.title}</>} period={q} right={<Tag kind="warn">{S.pending}</Tag>}>
          <p>{S.items.dollar.text}</p>
          <p><Link className="gn-btn gn-btn--sm" href={`/${lang}/shocks/dollar`}>{S.open}</Link></p>
          <Cite items={cites.dollar}>{S.items.dollar.source(meta.surfaces.money.method)}</Cite>
        </Panel>
      </div>
      <p className="gn-small gn-muted gn-measure">{S.moved} <a href={siteUrl('trade-flow', 'cut_supplier', lang, { stage: '', iso3: '' }).replace(/\?.*$/, '')}>{S.movedLinks.supplier} →</a> · <a href={siteUrl('money-flow', 'lender_cut', lang, { iso3: 'KOR' })}>{S.movedLinks.lenders} →</a></p>
    </div>
  );
}
