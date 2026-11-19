'use client';
// The pair through time: one chart, one time axis, four lanes at their own periods and the
// finance-to-trade ratio below. Goods every month (12-month windows), bank claims every quarter, portfolio holdings
// every half year, direct investment every year; both directions in each lane (A → B in the full tone, B → A in the
// lighter one). Solid lines are reported flows, dashed stretches estimated; the band between the goods line and its
// other report is the mirror gap where both reports exist. A "since" selector (2006, 2013, 2019) kept in the URL.
// Everything is precomputed by scripts/build.py (data/pairs/<A>-<B>.json.br); this component only draws.
import { useEffect, useMemo, useRef, useState } from 'react';
import { amt, num, ratio as fmtRatio, unit } from '@/lib/format';
import { pair } from '@/lib/strings/pair';
import type { Lang, PairHistory } from '@/lib/types';

/** The container's width, so the chart is drawn at real pixels (640 before mount). */
function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((es) => { for (const e of es) setW(Math.max(280, Math.round(e.contentRect.width))); });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

const SINCE = [2006, 2013, 2019] as const;
type Since = (typeof SINCE)[number];
type Tone = 'trade' | 'money' | 'ink';
type V = number | null;

/** A month 200602 → the middle of that month as a fractional year; a period end "2026-06-30" → its end. */
const tMonth = (t: number) => Math.floor(t / 100) + (t % 100 - 0.5) / 12;
const tEnd = (iso: string) => { const [y, m] = iso.split('-').map(Number); return y + m / 12; };

interface Lane {
  key: 'goods' | 'bank' | 'portfolio' | 'fdi' | 'ratio';
  tone: Tone;
  x: number[];
  ab: V[]; ba: V[];
  /** the other report of the same flow (the goods lane only) */
  ab2?: V[]; ba2?: V[];
  /** estimate codes (0 reported) per point, the goods lane only */
  estAb?: V[]; estBa?: V[];
  dots: boolean;
  label: (t: number) => string;
}

function niceMax(v: number): number {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

/** Path segments of one series: a new segment where the line breaks (null) or where the estimate status changes, so
 *  estimated stretches draw dashed; each segment starts at the previous point for continuity. */
function segments(xs: number[], vals: V[], est: V[] | undefined, X: (t: number) => number, Y: (v: number) => number, from: number): { d: string; dashed: boolean }[] {
  const out: { d: string; dashed: boolean }[] = [];
  let d = '', dashed = false, prev: [number, number] | null = null;
  const flush = () => { if (d) out.push({ d: d.trim(), dashed }); d = ''; };
  for (let i = 0; i < xs.length; i++) {
    const v = vals[i];
    if (xs[i] < from || v == null) { flush(); prev = null; continue; }
    const isEst = !!(est && est[i]);
    const px = X(xs[i]), py = Y(v);
    if (prev && isEst !== dashed) { flush(); dashed = isEst; d = `M${prev[0].toFixed(1)},${prev[1].toFixed(1)} `; }
    else if (!prev) { dashed = isEst; }
    d += `${d ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)} `;
    prev = [px, py];
  }
  flush();
  return out;
}

/** Closed polygons between a series and its other report where both exist. */
function bands(xs: number[], a: V[], b: V[], X: (t: number) => number, Y: (v: number) => number, from: number): string[] {
  const out: string[] = [];
  let run: [number, number, number][] = [];
  const flush = () => {
    if (run.length > 1) {
      const top = run.map(([x, u]) => `${X(x).toFixed(1)},${Y(u).toFixed(1)}`).join(' L');
      const bot = [...run].reverse().map(([x, , l]) => `${X(x).toFixed(1)},${Y(l).toFixed(1)}`).join(' L');
      out.push(`M${top} L${bot} Z`);
    }
    run = [];
  };
  for (let i = 0; i < xs.length; i++) {
    const u = a[i], v = b[i];
    if (xs[i] < from || u == null || v == null) { flush(); continue; }
    run.push([xs[i], Math.max(u, v), Math.min(u, v)]);
  }
  flush();
  return out;
}

export function PairSeries({ lang, h, a, b, na, nb }: { lang: Lang; h: PairHistory; a: string; b: string; na: string; nb: string }) {
  const P = pair(lang).series;
  const U = unit(lang);
  const [since, setSince] = useState<Since>(2006);
  const [hover, setHover] = useState<number | null>(null);
  const [box, w] = useWidth<HTMLDivElement>();
  useEffect(() => {
    const v = Number(new URLSearchParams(window.location.search).get('since'));
    if ((SINCE as readonly number[]).includes(v)) setSince(v as Since);
  }, []);
  const pick = (v: Since) => {
    setSince(v);
    try { const u = new URL(window.location.href); if (v === 2006) u.searchParams.delete('since'); else u.searchParams.set('since', String(v)); window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash); } catch { /* ignore */ }
  };
  // the file stores A < B; the page shows a first, so flip the directions when a is the file's b
  const fwd = h.a === a;
  const dir = <T,>(ab: T, ba: T): [T, T] => (fwd ? [ab, ba] : [ba, ab]);
  const lanes = useMemo<Lane[]>(() => {
    const [gab, gba] = dir(h.goods.ab, h.goods.ba), [gab2, gba2] = dir(h.goods.ab2, h.goods.ba2), [eab, eba] = dir(h.goods.est_ab, h.goods.est_ba);
    const [bab, bba] = dir(h.bank.ab, h.bank.ba), [pab, pba] = dir(h.portfolio.ab, h.portfolio.ba), [fab, fba] = dir(h.fdi.ab, h.fdi.ba);
    // a time back to its year and month: mid-month values (goods) and period ends (the rest, where December is the
    // next year's 0.0) both land inside the month once half a month is taken off
    const ym = (t: number): [number, number] => { const tt = t - 1 / 24; const y = Math.floor(tt); return [y, Math.round((tt - y) * 12 + 0.5)]; };
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const q = (t: number) => { const [y, m] = ym(t); return lang === 'ko' ? `${y}년 ${Math.ceil(m / 3)}분기` : `Q${Math.ceil(m / 3)} ${y}`; };
    const mo = (t: number) => { const [y, m] = ym(t); return lang === 'ko' ? `${y}년 ${m}월` : `${MON[m - 1]} ${y}`; };
    const half = (t: number) => { const [y, m] = ym(t); return lang === 'ko' ? `${y}년 ${m}월` : `${MON[m - 1]} ${y}`; };
    const yr = (t: number) => { const [y] = ym(t); return lang === 'ko' ? `${y}년` : String(y); };
    return [
      { key: 'goods', tone: 'trade', x: h.goods.t.map(tMonth), ab: gab, ba: gba, ab2: gab2, ba2: gba2, estAb: eab, estBa: eba, dots: false, label: mo },
      { key: 'bank', tone: 'money', x: h.bank.q.map(tEnd), ab: bab, ba: bba, dots: false, label: q },
      { key: 'portfolio', tone: 'money', x: h.portfolio.p.map(tEnd), ab: pab, ba: pba, dots: true, label: half },
      { key: 'fdi', tone: 'money', x: h.fdi.y.map(tEnd), ab: fab, ba: fba, dots: true, label: yr },
      { key: 'ratio', tone: 'ink', x: h.ratio.q.map(tEnd), ab: h.ratio.v, ba: [], dots: false, label: q },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h, fwd, lang]);

  const narrow = w < 560;
  const ml = narrow ? 44 : 58, mr = 12, gap = 14, LH = narrow ? 84 : 100, top = 6, axisH = 22;
  const H = top + lanes.length * (LH + gap) + axisH;
  const x0 = since, x1 = Math.max(...lanes.flatMap((l) => l.x), x0 + 1) + 0.02;
  const X = (t: number) => ml + ((t - x0) / (x1 - x0)) * (w - ml - mr);
  const years: number[] = [];
  for (let y = Math.ceil(x0); y <= Math.floor(x1); y += x1 - x0 > 14 ? 2 : 1) years.push(y);
  const fmtV = (v: V, key: Lane['key']) => (v == null ? '–' : key === 'ratio' ? fmtRatio(v, lang) : `${amt(v, lang)}`);
  const tickV = (v: number, key: Lane['key']) => (key === 'ratio' ? `${num(v, lang, v >= 10 ? 0 : 1)}×` : lang === 'ko' ? num(v * 10, lang, 0) : num(v, lang, 0));
  const hasAny = lanes.some((l) => l.ab.some((v) => v != null) || l.ba.some((v) => v != null));
  // the hover time snaps to the goods months (the finest grid); each lane shows its latest point at or before it
  const months = lanes[0].x;
  const at = (l: Lane, t: number) => { let k = -1; for (let i = 0; i < l.x.length; i++) { if (l.x[i] <= t + 1e-9) k = i; else break; } return k; };

  return (
    <div className="gn-pairs">
      <div className="gn-pairs__bar">
        <span className="gn-earn__opt">{P.since}
          <span className="gn-seg" role="group" aria-label={P.since}>
            {SINCE.map((v) => (<button key={v} type="button" aria-pressed={since === v} onClick={() => pick(v)}>{v}</button>))}
          </span>
        </span>
        <span className="gn-pairs__legend">
          <span><i className="gn-pairs__sw gn-pairs__sw--ab" />{P.legend.dir(na, nb)}</span>
          <span><i className="gn-pairs__sw gn-pairs__sw--ba" />{P.legend.dir(nb, na)}</span>
          <span><i className="gn-pairs__sw gn-pairs__sw--band" />{P.legend.band}</span>
          <span><i className="gn-pairs__sw gn-pairs__sw--dash" />{P.legend.est}</span>
        </span>
      </div>
      {!hasAny && <p className="gn-small gn-muted">{P.none}</p>}
      <div className="gn-pairs__plot" ref={box}>
        <svg viewBox={`0 0 ${w} ${H}`} width={w} height={H} role="img" aria-label={`${P.title}: ${na} · ${nb}, ${since}–`} className="gn-pairs__svg"
          onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const t = x0 + ((e.clientX - r.left - ml) / (w - ml - mr)) * (x1 - x0); let best = months[0]; for (const m of months) if (Math.abs(m - t) < Math.abs(best - t)) best = m; setHover(t < x0 || t > x1 ? null : best); }}
          onPointerLeave={() => setHover(null)}>
          {lanes.map((l, li) => {
            const y0 = top + li * (LH + gap);
            const inRange = (arr: V[]) => arr.filter((v, i): v is number => v != null && l.x[i] >= x0);
            const vals = [...inRange(l.ab), ...inRange(l.ba), ...(l.ab2 ? inRange(l.ab2) : []), ...(l.ba2 ? inRange(l.ba2) : [])];
            const max = niceMax(Math.max(...vals, l.key === 'ratio' ? 1.2 : 0));
            const Y = (v: number) => y0 + LH - (Math.min(v, max) / max) * (LH - 14);
            const empty = vals.length === 0;
            const k = hover != null ? at(l, hover) : -1;
            const latest = (arr: V[]) => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i]; return null; };
            const vAb = k >= 0 ? l.ab[k] : latest(l.ab), vBa = k >= 0 ? l.ba[k] : latest(l.ba);
            const when = k >= 0 ? l.label(l.x[k]) : (() => { for (let i = l.x.length - 1; i >= 0; i--) if (l.ab[i] != null || l.ba[i] != null) return l.label(l.x[i]); return ''; })();
            const cls = l.tone === 'ink' ? 'gn-pairs__ratio' : `gn-pairs__ab--${l.tone}`;
            const clsBa = `gn-pairs__ba--${l.tone}`;
            return (
              <g key={l.key}>
                <text x={ml} y={y0 + 9} className="gn-chart-label gn-pairs__lane">{P.lanes[l.key]} <tspan className="gn-pairs__per">· {P.periods[l.key]}{l.key === 'ratio' ? '' : ` · ${U}`}</tspan></text>
                <text x={w - mr} y={y0 + 9} textAnchor="end" className="gn-tick gn-pairs__vals">
                  {empty ? P.noneLane : l.key === 'ratio' ? `${when} · ${fmtV(vAb, l.key)}` : `${when} · ${fmtV(vAb, l.key)} / ${fmtV(vBa, l.key)}`}
                </text>
                {[0, 0.5, 1].map((f) => (<g key={f}><line x1={ml} x2={w - mr} y1={Y(f * max)} y2={Y(f * max)} className={f === 0 ? 'gn-axis' : 'gn-grid'} /><text x={ml - 5} y={Y(f * max) + 3.5} textAnchor="end" className="gn-tick">{tickV(f * max, l.key)}</text></g>))}
                {l.key === 'ratio' && 1 <= max && <line x1={ml} x2={w - mr} y1={Y(1)} y2={Y(1)} className="gn-pairs__one" />}
                {l.ab2 && bands(l.x, l.ab, l.ab2, X, Y, x0).map((d, i) => (<path key={`ba${i}`} d={d} className="gn-pairs__band gn-pairs__band--ab" />))}
                {l.ba2 && bands(l.x, l.ba, l.ba2, X, Y, x0).map((d, i) => (<path key={`bb${i}`} d={d} className="gn-pairs__band gn-pairs__band--ba" />))}
                {segments(l.x, l.ba, l.estBa, X, Y, x0).map((sg, i) => (<path key={`b${i}`} d={sg.d} className={`gn-pairs__line ${clsBa}${sg.dashed ? ' gn-pairs__dash' : ''}`} />))}
                {segments(l.x, l.ab, l.estAb, X, Y, x0).map((sg, i) => (<path key={`a${i}`} d={sg.d} className={`gn-pairs__line ${cls}${sg.dashed ? ' gn-pairs__dash' : ''}`} />))}
                {l.dots && l.x.map((t, i) => (t >= x0 ? (<g key={i}>
                  {l.ba[i] != null && <circle cx={X(t)} cy={Y(l.ba[i] as number)} r={2.6} className={`gn-pairs__dot ${clsBa}`} />}
                  {l.ab[i] != null && <circle cx={X(t)} cy={Y(l.ab[i] as number)} r={2.6} className={`gn-pairs__dot ${cls}`} />}
                </g>) : null))}
                {k >= 0 && l.x[k] >= x0 && (<>
                  {l.ab[k] != null && <circle cx={X(l.x[k])} cy={Y(l.ab[k] as number)} r={3.5} className={`gn-pairs__dot ${cls}`} />}
                  {l.ba[k] != null && <circle cx={X(l.x[k])} cy={Y(l.ba[k] as number)} r={3.5} className={`gn-pairs__dot ${clsBa}`} />}
                </>)}
              </g>
            );
          })}
          {years.map((y) => (<text key={y} x={X(y)} y={H - 6} textAnchor="middle" className="gn-tick">{y}</text>))}
          {years.map((y) => (<line key={`g${y}`} x1={X(y)} x2={X(y)} y1={top} y2={H - axisH} className="gn-grid" />))}
          {hover != null && <line x1={X(hover)} x2={X(hover)} y1={top} y2={H - axisH} className="gn-pairs__cursor" />}
        </svg>
      </div>
    </div>
  );
}
