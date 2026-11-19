import Link from 'next/link';
import type { Metadata } from 'next';
import { ChangeLine } from '@/components/ChangeLine';
import { Head, Panel, Tag } from '@/components/ui';
import { Cite } from '@/components/Cite';
import { BOARD, comtrade, money, qOne, w12, weeks, monthTo } from '@/lib/cites';
import { readMeta, readPulse } from '@/lib/data';
import { plain, rich } from '@/lib/rich';
import type { CiteItem } from '@/lib/sources';
import { buildDigest } from '@/lib/digest';
import { day, month, num, quarter } from '@/lib/format';
import { t } from '@/lib/i18n';
import { name } from '@/lib/names';
import { pageMeta } from '@/lib/seo';
import { digest as strings } from '@/lib/strings/digest';
import type { Lang } from '@/lib/types';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const d = buildDigest(lang as Lang);
  return pageMeta(lang as Lang, '/digest', { title: d.title, description: `${d.dated} ${plain(d.headline)}` });
}

export default async function DigestPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang = raw as Lang;
  const L = t(lang);
  const S = strings(lang);
  const d = buildDigest(lang);
  const meta = readMeta();
  const ticM = Number(readPulse().money.tic.latest.slice(0, 7).replace('-', ''));
  const pulseCites: CiteItem[] = [{ src: 'fred', series: ['DTWEXBGS', 'SWPT', 'WMTSECL1'], period: weeks(meta, lang) }, { src: 'tic', series: ['slt_table1'], period: monthTo(ticM, lang) }];
  const w = (r: { code: string; v: number | null; f: number | null }) => (
    <li key={r.code}><span className="when">{S.vf(num(r.v, lang, 0), num(r.f, lang, 1, true))}</span><span><Link href={`/${lang}/c/${r.code}`}>{name(r.code, lang)}</Link>{r.v != null && r.f != null && r.v >= 60 && r.f < 0 && <> <Tag kind="bad">{lang === 'ko' ? '위험' : 'at risk'}</Tag></>}</span></li>
  );

  return (
    <div className="gn-wrap gn-page">
      <Head kicker={`${S.kicker} · ${day(d.built, lang)}`} title={d.title} lede={d.dated}
        right={<a className="gn-btn gn-btn--sm" href="/feed" type="application/rss+xml">{S.feed} · /feed</a>} />

      <div className="gn-digest">
        <Panel tone="money" title={S.headlineH} period={quarter(d.q, lang)}>
          <p>{rich(d.headline)}</p>
          <Cite items={money(BOARD, qOne(d.q, lang))}>{S.source}</Cite>
        </Panel>

        <Panel tone="money" title={S.pulseH} period={day(d.pulseDay, lang)}>
          <ul className="gn-prose" style={{ paddingLeft: 20 }}>{d.pulse.map((s, i) => (<li key={i}>{rich(s)}</li>))}</ul>
          <Cite items={pulseCites}>{S.source}</Cite>
        </Panel>

        <Panel tone="trade" title={S.worldH} period={month(d.shown, lang)}>
          <p>{rich(d.world)}</p>
          <Cite items={[comtrade(w12(d.shown, lang))]}>{S.source}</Cite>
        </Panel>

        <Panel title={S.changesH} period={`${quarter(d.q, lang)} · ${month(d.shown, lang)}`}>
          <p className="gn-small gn-muted">{d.changes.length ? S.changesLede(d.changes.length) : S.noChanges}</p>
          {d.changes.length > 0 && <ul className="gn-list">{d.changes.map((c, i) => (<li key={i}><ChangeLine c={c} lang={lang} /></li>))}</ul>}
          <p><Link className="gn-btn gn-btn--sm" href={`/${lang}/changes`}>{S.allChanges}</Link></p>
        </Panel>

        <Panel tone="money" title={S.watchH} period={quarter(d.q, lang)}>
          <p className="gn-kicker">{rich(S.atRisk)}</p>
          {d.atRisk.length ? <ul className="gn-list">{d.atRisk.map(w)}</ul> : <p className="gn-small gn-muted">{S.noneAtRisk}</p>}
          <p className="gn-kicker">{S.topV}</p>
          <ul className="gn-list">{d.topV.map(w)}</ul>
          <p><Link className="gn-btn gn-btn--sm" href={`/${lang}`}>{S.board}</Link></p>
        </Panel>

        <Panel title={S.periodsH}>
          <p className="gn-small">{d.periods}</p>
          <p className="gn-small gn-muted">{d.regen} <a href="/feed" type="application/rss+xml">{S.feed}</a>.</p>
          <Cite items={[...pulseCites, ...money(BOARD, qOne(d.q, lang)), comtrade(w12(d.shown, lang))]}>{S.source}</Cite>
        </Panel>
      </div>
    </div>
  );
}
