'use client';
// The side panel: the economy picked for detail, its balances and scale at the current period (annual or 4 quarters),
// ranks among the economies shown, the chart's two axes as small time series in the active unit and frequency with the
// period marked, its top products, and the trade and funding facts at their own periods. "No data" names the latest
// period the lens has for it.
import Link from 'next/link';
import { bn, num, pct, quarter, window12 } from '@/lib/format';
import { hsName } from '@/lib/hs';
import { t as tr } from '@/lib/i18n';
import { rich } from '@/lib/rich';
import { earn } from '@/lib/strings/earn';
import type { CiteItem } from '@/lib/sources';
import type { Earn, Lang, ProductRow, Products, Quadrant } from '@/lib/types';
import { Cite } from '../Cite';
import { Term } from '../Term';
import { periodLabel, type Frame, type Key, type Lens } from './model';
import { quarter as fmtQ, year as fmtY } from '@/lib/format';

/** One axis of the chart over time for the economy in the panel: linear, zero line where the series crosses it, the
 * current period marked with a dot and its value in the heading. */
function AxisSeries({ label, s, f, k, fmt, tick, tone }: { label: string; s: (number | null)[]; f: Frame; k: number; fmt: (v: number | null | undefined) => string; tick: (v: number) => string; tone: 'trade' | 'money' }) {
  const w = 300, h = 66, ml = 44, mr = 6, mt = 5, mb = 14;
  const n = f.periods.length;
  const vals = s.filter((v): v is number => v != null);
  const cur = s[k] ?? null;
  return (
    <figure className="gn-earn__series">
      <figcaption><span className={`gn-earn__key gn-earn__key--${tone}`}>{label}</span> <b>{fmt(cur)}</b></figcaption>
      {vals.length > 1 && (() => {
        let lo = Math.min(...vals), hi = Math.max(...vals);
        if (lo > 0 && lo < (hi - lo) * 0.6) lo = 0;
        if (hi < 0 && -hi < (hi - lo) * 0.6) hi = 0;
        const X = (i: number) => ml + (i / Math.max(1, n - 1)) * (w - ml - mr);
        const Y = (v: number) => mt + (1 - (v - lo) / (hi - lo || 1)) * (h - mt - mb);
        let d = '', pen = false;
        s.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)} `; pen = true; });
        return (
          <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${label}, ${f.periods[0]}–${f.periods[n - 1]}`} className="gn-earn__mini">
            {lo < 0 && hi > 0 && <line x1={ml} x2={w - mr} y1={Y(0)} y2={Y(0)} className="gn-axis" />}
            <line x1={X(k)} x2={X(k)} y1={mt} y2={h - mb} className="gn-grid" />
            <text x={ml - 4} y={mt + 6} textAnchor="end" className="gn-tick">{tick(hi)}</text>
            <text x={ml - 4} y={h - mb} textAnchor="end" className="gn-tick">{tick(lo)}</text>
            {lo < 0 && hi > 0 && Y(0) - mt > 12 && h - mb - Y(0) > 12 && <text x={ml - 4} y={Y(0) + 3.5} textAnchor="end" className="gn-tick">0</text>}
            <text x={ml} y={h - 3} className="gn-tick">{f.periods[0].slice(0, 4)}</text>
            <text x={w - mr} y={h - 3} textAnchor="end" className="gn-tick">{f.periods[n - 1].replace('-', ' ')}</text>
            <path d={d.trim()} className={`gn-line-${tone}`} />
            {cur != null && <circle cx={X(k)} cy={Y(cur)} r={3.2} className={`gn-earn__minidot gn-earn__minidot--${tone}`} />}
          </svg>
        );
      })()}
    </figure>
  );
}

/** Top products of one side: value, share of the economy's total, change on a year earlier, and "other". */
function ProdList({ lang, p, side, n }: { lang: Lang; p: Products; side: 'x' | 'm'; n: number }) {
  const P = earn(lang).panel, L = tr(lang);
  const rows: ProductRow[] = p[side].slice(0, n);
  const total = side === 'x' ? p.x_bn : p.m_bn;
  const sum = rows.reduce((a, r) => a + r[side], 0);
  const est = (r: ProductRow) => (side === 'x' ? r.xe : r.me);
  return (
    <table className="gn-earn__prod">
      <caption>{side === 'x' ? P.prodX : P.prodM} · {bn(total, lang)}</caption>
      <thead><tr><th scope="col">{P.prodCols.name}</th><th scope="col" className="num">{P.prodCols.usd}</th><th scope="col" className="num">{P.prodCols.share}</th><th scope="col" className="num">{P.prodCols.yoy}</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.ch}>
            <th scope="row">{hsName(r.ch, lang)}{est(r) ? <sup className="gn-earn__est" title={L.est[est(r)]}>*</sup> : null}</th>
            <td className="num">{bn(r[side], lang)}</td>
            <td className="num">{pct(side === 'x' ? r.xs : r.ms, lang, 0)}</td>
            <td className="num">{pct(side === 'x' ? r.xy : r.my, lang, 0, true)}</td>
          </tr>
        ))}
        {total != null && total - sum > 0 && (
          <tr className="gn-earn__other"><th scope="row">{P.other}</th><td className="num">{bn(total - sum, lang)}</td><td className="num">{pct((100 * (total - sum)) / total, lang, 0)}</td><td /></tr>
        )}
      </tbody>
    </table>
  );
}

function rankOf(f: Frame, codes: string[], key: Key, code: string, k: number): [number, number] | null {
  const vals = codes.map((c) => [c, f.series(c, key)[k]] as const).filter((x): x is readonly [string, number] => x[1] != null).sort((a, b) => b[1] - a[1]);
  const i = vals.findIndex((x) => x[0] === code);
  return i < 0 ? null : [i + 1, vals.length];
}

const quad = (gs: number | null, pi: number | null, band: number): Quadrant | null => {
  if (gs == null || pi == null) return null;
  const t = gs > band, f = pi > band;
  return t && f ? 'both' : t ? 'trade' : f ? 'finance' : 'neither';
};

export function Panel({ lang, data, f, code, k, names, codes, onPick, shown, lens, xy, axisNames, fmtAxis, tickAxis }: {
  lang: Lang; data: Earn; f: Frame; code: string; k: number; names: Record<string, string>; codes: string[]; onPick: (c: string) => void; shown: number;
  lens: Lens; xy: [(number | null)[], (number | null)[]]; axisNames: [string, string]; fmtAxis: (v: number | null | undefined, i: 0 | 1) => string; tickAxis: (v: number) => string;
}) {
  const S = earn(lang), P = S.panel;
  const pn = data.panel[code];
  const per = f.periods[k];
  const s = (key: Key) => f.series(code, key)[k] ?? null;
  const q = f.freq === 'a' ? data.econ[code]?.q[k] ?? null : quad(s('gs'), s('pi'), data.band);
  const isHub = code === data.hub;
  const chainYear = pn?.holds[0]?.year ?? data.years[data.years.length - 1];
  const sorted = [...codes].sort((a, b) => (names[a] ?? a).localeCompare(names[b] ?? b, lang));
  const rx = rankOf(f, codes, 'xu', code, k), ra = rankOf(f, codes, 'fa', code, k);
  const missing = xy[0][k] == null || xy[1][k] == null;
  // net IIP filled from gross positions over this frame's GDP where the board has none (marked)
  const filled = !!(f.freq === 'q' ? data.q?.econ[code]?.nf?.[k] : data.econ[code]?.nf?.[k]);
  let lastOk = -1;
  for (let i = xy[0].length - 1; i >= 0; i--) if (xy[0][i] != null && xy[1][i] != null) { lastOk = i; break; }
  const tw = window12(pn?.t ?? 0, lang);
  const prod = pn?.prod;
  const cites: CiteItem[] = [
    { src: 'comtrade', period: lang === 'ko' ? `12개월 창 ${tw}, 공급망 병목 ${chainYear}년` : `12-month window ${tw}; chain chokepoints ${chainYear}` },
    ...(prod ? [{ src: 'comtrade', series: [P.prodSeries], period: lang === 'ko' ? `12개월 창 ${window12(prod.t, lang)}와 1년 전 창` : `12-month window ${window12(prod.t, lang)} and the window a year earlier` }] as CiteItem[] : []),
    ...(pn?.a1q ? [{ src: 'bis.lbs', period: `A1, ${quarter(pn.a1q, lang)}` }, { src: 'bis.dss', period: `A1, ${quarter(pn.a1q, lang)}` }] as CiteItem[] : []),
  ];
  return (
    <aside className="gn-earn__panel" aria-live="polite">
      <label className="gn-label" htmlFor="gn-earn-pick">{S.pick}</label>
      <select id="gn-earn-pick" className="gn-select" value={code} onChange={(ev) => onPick(ev.target.value)}>
        {sorted.map((c) => (<option key={c} value={c}>{names[c] ?? c}</option>))}
      </select>
      <h3 className="gn-earn__name">{names[code] ?? code}</h3>
      {missing && <p className="gn-notice gn-notice--info gn-small">{S.noData(periodLabel(lastOk >= 0 ? f.periods[lastOk] : null, lang))}</p>}
      {q && <p className={`gn-earn__badge gn-earn__badge--${q}`}>{S.quad[q]} <span>{periodLabel(per, lang)}</span></p>}
      <dl className="gn-earn__facts">
        <div><dt><Term id="gs">{P.trade}</Term></dt><dd>{pct(s('gs'), lang, 1, true)}</dd></div>
        <div><dt><Term id="pi">{P.pi}</Term></dt><dd>{pct(s('pi'), lang, 1, true)}</dd></div>
        <div><dt><Term id="gdp_pc">{P.pc}</Term></dt><dd>${num(s('pc'), lang, 0)}</dd></div>
        <div><dt><Term id="niip">{P.niip}</Term></dt><dd>{pct(s('niip'), lang, 0, true)}{filled ? '°' : ''}</dd></div>
      </dl>
      {filled && <p className="gn-small gn-muted" style={{ margin: 0 }}>{P.filled}</p>}
      <div className="gn-earn__scale">
        <p className="gn-kicker">{P.scale} · {f.freq === 'q' ? `${P.scaleQ} ` : ''}{periodLabel(per, lang)}</p>
        <dl>
          <dt><Term id="exports">{P.exportsUsd}</Term></dt><dd>{bn(s('xu'), lang)}{rx && <small className="gn-muted gn-earn__rank">{P.rank(rx[0], rx[1])}</small>}</dd>
          <dt><Term id="imports">{P.importsUsd}</Term></dt><dd>{bn(s('mu'), lang)}</dd>
          <dt><Term id="gdp_pct">{P.exportsGdp}</Term></dt><dd>{pct(s('xg'), lang, 1)}</dd>
          <dt><Term id="assets">{P.assetsUsd}</Term></dt><dd>{bn(s('fa'), lang)}{ra && <small className="gn-muted gn-earn__rank">{P.rank(ra[0], ra[1])}</small>}</dd>
        </dl>
        <p className="gn-small gn-muted" style={{ margin: 0 }}>{P.rankNote(codes.length, periodLabel(per, lang))} {f.freq === 'q' ? P.gdpQ : P.gdpA}</p>
        <p className="gn-small gn-muted" style={{ margin: 0 }}>{P.exportsNote}</p>
        {f.freq === 'q' && <p className="gn-small gn-muted" style={{ margin: 0 }}>{rich(S.quarterlyNote)}</p>}
      </div>
      <div>
        <p className="gn-kicker">{P.series(periodLabel(f.periods[0], lang))}</p>
        <AxisSeries label={axisNames[0]} s={xy[0]} f={f} k={k} fmt={(v) => fmtAxis(v, 0)} tick={tickAxis} tone="trade" />
        <AxisSeries label={axisNames[1]} s={xy[1]} f={f} k={k} fmt={(v) => fmtAxis(v, 1)} tick={tickAxis} tone="money" />
      </div>
      {prod && (prod.x.length > 0 || prod.m.length > 0) && (
        <div className="gn-earn__prods">
          <p className="gn-kicker"><Term id="hs2">{P.prodTitle}</Term> · {window12(prod.t, lang)}</p>
          <ProdList lang={lang} p={prod} side="x" n={5} />
          <ProdList lang={lang} p={prod} side="m" n={5} />
          <p className="gn-small gn-muted" style={{ margin: 0 }}>{rich(P.prodNote)}</p>
        </div>
      )}
      {isHub && <p className="gn-small gn-muted">{rich(P.hub)}</p>}
      {pn && (
        <dl className="gn-earn__facts gn-earn__facts--now">
          <div><dt><Term id="hhi">{P.hm}</Term><small>{P.hmSub}</small></dt><dd>{num(pn.hm, lang, 2)}</dd></div>
          <div><dt><Term id="x_share">{P.xShare}</Term></dt><dd>{pct(pn.x_share, lang, 1)}</dd></div>
          <div><dt><Term id="a1">{P.a1}</Term><small>{P.a1Sub}</small></dt><dd>{isHub ? '–' : pct(pn.a1, lang, 1)}</dd></div>
        </dl>
      )}
      {pn && (
        <div>
          <p className="gn-kicker"><Term id="chokepoint">{P.holds}</Term></p>
          {pn.holds.length ? (
            <ul className="gn-earn__holds">{pn.holds.map((h) => (<li key={h.chain}>{P.holdsRow(lang === 'ko' ? h.stage_ko : h.stage, lang === 'ko' ? h.ko : h.en, pct(h.share, lang, 0))}</li>))}</ul>
          ) : <p className="gn-small gn-muted">{P.holdsNone}</p>}
        </div>
      )}
      {isHub && <p className="gn-small gn-muted">{P.a1Hub}</p>}
      {lens === 'funding' && (() => {
        // the funding lens: who holds this economy's gross external liabilities in the shown year
        const fd = data.fund?.[code];
        const y = Number(per.slice(0, 4));
        const yi = data.years.indexOf(y);
        const top3 = yi >= 0 ? fd?.top3[yi] ?? null : null, named = yi >= 0 ? fd?.named[yi] ?? null : null;
        const gs = s('gs'), pi = s('pi');
        const surplus = gs != null && pi != null && gs + pi >= 0;
        const FP = S.fund.panel;
        const fundCites: CiteItem[] = fd?.per ? [
          { src: 'bis.lbs', period: fd.per.bank ? fmtQ(fd.per.bank, lang) : undefined },
          { src: 'imf.pip', period: fd.per.portfolio ? fmtQ(fd.per.portfolio, lang) : undefined },
          { src: 'imf.dip', period: fd.per.fdi ? (lang === 'ko' ? `${fmtY(fd.per.fdi)}년` : fmtY(fd.per.fdi)) : undefined },
          { src: 'imf.iip', period: lang === 'ko' ? `${fd.year}년 마지막 공표 분기` : `last published quarter of ${fd.year}` },
        ] : [];
        return (
          <div className="gn-earn__fund">
            <p className="gn-kicker"><Term id="liabilities">{FP.title}</Term> · {periodLabel(String(y), lang)}</p>
            {top3 == null ? <p className="gn-small gn-muted">{FP.none}</p> : (<>
              {surplus && <p className="gn-small gn-muted">{FP.surplus}</p>}
              <dl className="gn-earn__facts">
                <div><dt>{FP.top3}</dt><dd>{pct(top3, lang, 0)}</dd></div>
                <div><dt>{FP.named}</dt><dd>{pct(named, lang, 0)}</dd></div>
              </dl>
              {fd?.who && fd.year === y
                ? <ul className="gn-earn__holds">{fd.who.map(([c, v]) => (<li key={c}>{names[c] ?? c} · {pct(v, lang, 1)}</li>))}</ul>
                : fd?.who && fd.year ? <p className="gn-small gn-muted">{FP.named_in(fd.year, fd.who.map(([c]) => names[c] ?? c).join(', '))}</p> : null}
              <Cite items={fundCites}>{FP.note}</Cite>
            </>)}
          </div>
        );
      })()}
      <Cite items={cites}>{S.panelNote}</Cite>
      <p><Link className="gn-btn gn-btn--sm" href={`/${lang}/c/${code}`}>{P.sheet}</Link></p>
      {void shown}
    </aside>
  );
}
