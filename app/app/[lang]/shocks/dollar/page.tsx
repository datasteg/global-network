import Link from 'next/link';
import type { Metadata } from 'next';
import { ShocksTabs } from '@/components/SectionTabs';
import { LineChart, Scatter } from '@/components/charts';
import { Head, Panel } from '@/components/ui';
import { Cite } from '@/components/Cite';
import { Term } from '@/components/Term';
import { comtrade, money, qRange } from '@/lib/cites';
import { rich } from '@/lib/rich';
import type { CiteItem } from '@/lib/sources';
import { readDollar, readMeta } from '@/lib/data';
import { num, pct, quarter } from '@/lib/format';
import { t } from '@/lib/i18n';
import { name } from '@/lib/names';
import { pageMeta } from '@/lib/seo';
import { dollar as strings } from '@/lib/strings/dollar';
import type { Lang } from '@/lib/types';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang = raw as Lang;
  const S = strings(lang);
  const m = readMeta();
  return pageMeta(lang, '/shocks/dollar', {
    title: S.title,
    description: lang === 'ko'
      ? `달러가 강세를 보이면 수출이 줄어드나요? 경제마다 두 분기 뒤의 12개월 수출 증가율을 광의 달러 지수의 전년동기대비 변화와 비교하고, 외화 신용 의존도(A1)별로 묶었습니다. ${quarter(m.money.quarter, lang)}까지의 분기.`
      : `When the dollar rises, do exports fall? Each economy’s 12-month export growth two quarters later against the broad dollar index’s change on a year earlier, pooled by reliance on FX credit (A1); quarters to ${quarter(m.money.quarter, lang)}.`,
  });
}

const TERCILES = ['low', 'mid', 'high'] as const;

export default async function DollarPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ e?: string | string[] }> }) {
  const { lang: raw } = await params;
  const { e: eRaw } = await searchParams;
  const lang = raw as Lang;
  const L = t(lang);
  const S = strings(lang);
  const meta = readMeta();
  const d = readDollar();
  const codes = meta.economies.map((e) => e.code);
  const pick = typeof eRaw === 'string' ? eRaw.toUpperCase() : 'KOR';
  const code = codes.includes(pick) && d.econ[pick] ? pick : 'KOR';
  const grid = meta.money.quarters;
  const shift = (q: string, k: number) => { const i = grid.indexOf(q); return i >= 0 && grid[i + k] ? grid[i + k] : null; };

  // the dollar series, without the quarter still running at the pulse day
  const yoy = d.dollar_yoy.filter(([q]) => q <= meta.money.pulse_day);
  const dropped = d.dollar_yoy.length - yoy.length;
  const bands = Object.values(meta.episodes).map((ep) => ({ from: ep.q, to: ep.q }));

  // terciles
  const tc = d.terciles;
  const steepest = TERCILES.reduce((best, k) => ((tc[k].slope ?? 0) < (tc[best].slope ?? 0) ? k : best), 'low' as (typeof TERCILES)[number]);
  const f2 = (v: number | null) => num(v, lang, 2);

  // per economy
  const econRows = codes.map((c) => { const x = d.econ[c]; const lp = x.pts[x.pts.length - 1]; return { code: c, corr: x.corr, a1: x.a1_mean, n: x.pts.length, lp }; })
    .sort((a, z) => (a.corr ?? 1) - (z.corr ?? 1));

  // the chosen economy's scatter
  const ex = d.econ[code];
  const xs = ex.pts.map((p) => p[1]), ys = ex.pts.map((p) => p[2]);
  const round = (v: number, step: number, up: boolean) => (up ? Math.ceil(v / step) * step : Math.floor(v / step) * step);
  const xd: [number, number] = [round(Math.min(...xs, -5), 5, false), round(Math.max(...xs, 5), 5, true)];
  const yd: [number, number] = [round(Math.min(...ys, -10), 10, false), round(Math.max(...ys, 10), 10, true)];
  const lastQ = ex.pts.length ? ex.pts[ex.pts.length - 1][0] : null;
  const pts = ex.pts.map((p) => ({ x: p[1], y: p[2], r: p[0] === lastQ ? 5.5 : 3.5, label: p[0] === lastQ ? `${S.latest} ${quarter(p[0], lang)}` : '', tone: p[0] === lastQ ? ('trade' as const) : ('money' as const) }));
  const from = yoy[0]?.[0], to = yoy[yoy.length - 1]?.[0];

  const cites = (a: string | null | undefined, b: string | null | undefined): CiteItem[] => [
    { src: 'fred', series: ['DTWEXBGS'], period: lang === 'ko' ? '분기 평균' : 'quarterly averages' },
    comtrade(lang === 'ko' ? '12개월 창, 분기 말' : '12-month windows at quarter ends'),
    ...money(['bis.lbs', 'bis.dss', 'bis.tc'], qRange(readMeta(), lang, a ?? undefined, b ?? undefined)),
  ];
  return (
    <div className="gn-wrap gn-page">
      <ShocksTabs lang={lang} current="dollar" />
      <Head kicker={`${S.kicker} · ${quarter(from, lang)}–${quarter(to, lang)}`} title={S.title} lede={rich(S.lede)} />

      <Panel tone="money" title={S.chart} period={`${quarter(from, lang)}–${quarter(to, lang)}`}>
        <p className="gn-small gn-muted">{rich(S.chartLede(d.lag))}</p>
        <figure className="gn-figure">
          <LineChart t={yoy.map((p) => p[0])} series={yoy.map((p) => p[1])} tone="money" h={200} zero bands={bands} fmt={(v) => `${v}%`} unit={S.xLabel} />
          {dropped > 0 && <figcaption>{S.partialNote}</figcaption>}
        </figure>
        <Cite items={cites(from, to)}>{L.calc}.</Cite>
      </Panel>

      <div className="gn-grid-2" style={{ alignItems: 'start' }}>
        <Panel tone="trade" title={<Term id="tercile">{S.terciles}</Term>}>
          <p className="gn-small gn-muted">{rich(S.tercilesLede)}</p>
          <div className="gn-scroll">
            <table className="gn-table">
              <thead><tr><th>{S.tercileCols.t}</th><th className="num">{S.tercileCols.corr}</th><th className="num">{S.tercileCols.slope}</th><th className="num">{S.tercileCols.n}</th></tr></thead>
              <tbody>
                {TERCILES.map((k) => (
                  <tr key={k}>
                    <td>{S.tercileNames[k]}<br /><span className="gn-small gn-muted">{tc[k].econ.map((c) => name(c, lang)).join(' · ')}</span></td>
                    <td className="num">{f2(tc[k].corr)}</td>
                    <td className="num">{f2(tc[k].slope)}</td>
                    <td className="num">{num(tc[k].n, lang, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="gn-small">{S.honest(lang === 'ko' ? S.tercileNames[steepest] : S.tercileNames[steepest].charAt(0).toLowerCase() + S.tercileNames[steepest].slice(1),f2(tc[steepest].slope), f2(tc.low.slope), f2(tc.mid.slope), f2(tc.high.corr), f2(tc.low.corr), f2(tc.mid.corr))}</p>
          <Cite items={cites(from, to)}>{L.calc}.</Cite>
        </Panel>

        <Panel tone="trade" title={S.scatter(name(code, lang))} period={lastQ ? `${quarter(ex.pts[0][0], lang)}–${quarter(lastQ, lang)}` : undefined}>
          <p className="gn-small gn-muted">{S.scatterLede}</p>
          <figure className="gn-figure">
            <Scatter pts={pts} xd={xd} yd={yd} xLine={0} yLine={0} xLabel={S.xLabel} yLabel={S.yLabel} fmtX={(v) => `${v}%`} fmtY={(v) => `${v}%`} h={340} />
            <figcaption>{lang === 'ko' ? `상관계수 ${f2(ex.corr)}, 평균 A1 ${pct(ex.a1_mean, lang, 1)}, ${num(ex.pts.length, lang, 0)}분기` : `Correlation ${f2(ex.corr)}, mean A1 ${pct(ex.a1_mean, lang, 1)}, ${num(ex.pts.length, lang, 0)} quarters.`}</figcaption>
          </figure>
          <div className="gn-pick" aria-label={S.pick}>
            {codes.map((c) => (<Link key={c} href={`/${lang}/shocks/dollar?e=${c}`} aria-current={c === code ? 'page' : undefined} scroll={false}>{name(c, lang)}</Link>))}
          </div>
          <Cite items={cites(ex.pts[0]?.[0], lastQ)}>{L.calc}.</Cite>
        </Panel>
      </div>

      <Panel tone="trade" title={S.perEconomy}>
        <p className="gn-small gn-muted">{S.perEconomyLede}</p>
        <div className="gn-scroll">
          <table className="gn-table">
            <thead><tr><th>{S.econCols.eco}</th><th className="num">{S.econCols.corr}</th><th className="num"><Term id="a1">{S.econCols.a1}</Term></th><th className="num">{S.econCols.n}</th><th className="num">{S.econCols.q}</th><th className="num">{S.econCols.g}</th></tr></thead>
            <tbody>
              {econRows.map((r) => (
                <tr key={r.code}>
                  <td><Link href={`/${lang}/shocks/dollar?e=${r.code}`} scroll={false}>{name(r.code, lang)}</Link></td>
                  <td className="num">{f2(r.corr)}</td>
                  <td className="num">{pct(r.a1, lang, 1)}</td>
                  <td className="num">{num(r.n, lang, 0)}</td>
                  <td className="num">{r.lp ? <>{pct(r.lp[1], lang, 1, true)} <span className="gn-muted gn-small">{quarter(r.lp[0], lang)}</span></> : '–'}</td>
                  <td className="num">{r.lp ? <>{pct(r.lp[2], lang, 1, true)} <span className="gn-muted gn-small">{quarter(shift(r.lp[0], d.lag), lang)}</span></> : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="gn-notice gn-notice--info">{S.noForecast}</p>
        <Cite items={cites(from, to)}>{L.calc}.</Cite>
      </Panel>
    </div>
  );
}
