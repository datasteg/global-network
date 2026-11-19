// Server-rendered SVG chart primitives in Oreum. No library: lines, areas, sparklines, bars and a scatter, all to one
// scale per chart, text from the theme tokens (classes in design/oreum.css).
import type { ReactNode } from 'react';

export type Pt = [string | number, number | null];

function extent(vals: (number | null)[], pad = 0.08, zero = false): [number, number] {
  const v = vals.filter((x): x is number => x != null && Number.isFinite(x));
  if (!v.length) return [0, 1];
  let lo = Math.min(...v), hi = Math.max(...v);
  if (zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  if (lo === hi) { lo -= 1; hi += 1; }
  const d = (hi - lo) * pad;
  return [lo - d, hi + d];
}

function ticks(lo: number, hi: number, n = 4): number[] {
  const span = hi - lo;
  const raw = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => span / s <= n + 1) ?? mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

/** A small line for a tile or a table row: no axes, an emphasised endpoint, an optional zero line. */
export function Sparkline({ pts, tone = 'money', w = 120, h = 28, zero = false }: { pts: (number | null)[]; tone?: 'money' | 'trade' | 'ctx'; w?: number; h?: number; zero?: boolean }) {
  const [lo, hi] = extent(pts, 0.1, zero);
  const n = pts.length;
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * (w - 4) + 2 : w / 2);
  const y = (v: number) => h - 3 - ((v - lo) / (hi - lo)) * (h - 6);
  let d = ''; let pen = false;
  pts.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `; pen = true; });
  const last = [...pts].reverse().find((v) => v != null);
  const lastI = pts.length - 1 - [...pts].reverse().findIndex((v) => v != null);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      {zero && lo < 0 && hi > 0 && <line x1={0} x2={w} y1={y(0)} y2={y(0)} className="gn-grid" />}
      <path d={d.trim()} className={tone === 'ctx' ? 'gn-line-ctx' : tone === 'trade' ? 'gn-line-trade' : 'gn-line-money'} vectorEffect="non-scaling-stroke" />
      {last != null && <circle cx={x(lastI)} cy={y(last)} r={2.2} className={tone === 'trade' ? 'gn-dot-trade' : 'gn-dot-money'} />}
    </svg>
  );
}

export interface Band { from: string | number; to: string | number; label?: string }

/** A line chart with a y axis, a light grid, optional shaded episode bands and a second context series. */
export function LineChart({ t, series, tone = 'money', w = 560, h = 200, zero = false, bands = [], fmt = (v: number) => String(v), labelEvery = 'auto', unit, ctx }:
  { t: (string | number)[]; series: (number | null)[]; tone?: 'money' | 'trade'; w?: number; h?: number; zero?: boolean; bands?: Band[]; fmt?: (v: number) => string; labelEvery?: 'auto' | number; unit?: string; ctx?: (number | null)[] }) {
  const ml = 44, mr = 12, mt = 10, mb = 22;
  const [lo, hi] = extent([...series, ...(ctx ?? [])], 0.08, zero);
  const n = t.length;
  const x = (i: number) => ml + (n > 1 ? (i / (n - 1)) * (w - ml - mr) : 0);
  const y = (v: number) => mt + (1 - (v - lo) / (hi - lo)) * (h - mt - mb);
  const path = (s: (number | null)[]) => {
    let d = ''; let pen = false;
    s.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `; pen = true; });
    return d.trim();
  };
  const idx = (k: string | number) => { const i = t.findIndex((v) => String(v) >= String(k)); return i < 0 ? n - 1 : i; };
  const tk = ticks(lo, hi, 4);
  const labelStep = labelEvery === 'auto' ? Math.max(1, Math.round(n / 6)) : labelEvery;
  const yearOf = (v: string | number) => String(v).slice(0, 4);
  // one label per year change, thinned
  const labels: { i: number; s: string }[] = [];
  let lastYear = '';
  t.forEach((v, i) => { const yv = yearOf(v); if (yv !== lastYear) { labels.push({ i, s: yv }); lastYear = yv; } });
  const thinned = labels.filter((_, k) => k % Math.max(1, Math.ceil(labels.length / 8)) === 0);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={unit ?? ''}>
      {bands.map((b, k) => { const a = x(idx(b.from)), c = x(idx(b.to)); return <rect key={k} x={Math.min(a, c)} y={mt} width={Math.max(2, Math.abs(c - a))} height={h - mt - mb} className="gn-episode" />; })}
      {tk.map((v) => (<g key={v}><line x1={ml} x2={w - mr} y1={y(v)} y2={y(v)} className={v === 0 ? 'gn-axis' : 'gn-grid'} /><text x={ml - 6} y={y(v) + 3.5} textAnchor="end" className="gn-tick">{fmt(v)}</text></g>))}
      {thinned.map((l) => (<text key={l.i} x={x(l.i)} y={h - 6} textAnchor="middle" className="gn-tick">{l.s}</text>))}
      {ctx && <path d={path(ctx)} className="gn-line-ctx" />}
      <path d={path(series)} className={tone === 'trade' ? 'gn-line-trade' : 'gn-line-money'} />
      {(() => { const li = series.length - 1 - [...series].reverse().findIndex((v) => v != null); const lv = series[li]; return lv != null ? <circle cx={x(li)} cy={y(lv)} r={3} className={tone === 'trade' ? 'gn-dot-trade' : 'gn-dot-money'} /> : null; })()}
      {void labelStep}
    </svg>
  );
}

/** Horizontal bars with labels, to one scale. */
export function Bars({ rows, tone = 'money', max }: { rows: { label: ReactNode; value: number | null; text: string; href?: string }[]; tone?: 'money' | 'trade'; max?: number }) {
  const m = max ?? Math.max(1e-9, ...rows.map((r) => Math.abs(r.value ?? 0)));
  return (
    <div className={`gn-mini gn-lane gn-lane--${tone}`}>
      {rows.map((r, i) => (
        <div className="gn-mini__row" key={i}>
          <span>{r.label}</span>
          <span><span className="bar" style={{ width: `${Math.max(0, (100 * Math.abs(r.value ?? 0)) / m)}%`, display: 'block' }} /></span>
          <span className="num">{r.text}</span>
        </div>
      ))}
    </div>
  );
}

/** A scatter with a fixed domain, quadrant lines and labelled points. */
export function Scatter({ pts, w = 520, h = 360, xd, yd, xLabel, yLabel, xLine, yLine, fmtX = String, fmtY = String }:
  { pts: { x: number; y: number; r?: number; label: string; tone?: 'money' | 'trade' | 'bad' | 'ctx'; href?: string; quiet?: boolean }[]; w?: number; h?: number; xd: [number, number]; yd: [number, number]; xLabel: string; yLabel: string; xLine?: number; yLine?: number; fmtX?: (v: number) => string; fmtY?: (v: number) => string }) {
  const ml = 44, mr = 12, mt = 12, mb = 32;
  const x = (v: number) => ml + ((Math.min(xd[1], Math.max(xd[0], v)) - xd[0]) / (xd[1] - xd[0])) * (w - ml - mr);
  const y = (v: number) => mt + (1 - (Math.min(yd[1], Math.max(yd[0], v)) - yd[0]) / (yd[1] - yd[0])) * (h - mt - mb);
  const fill = (tone?: string) => tone === 'trade' ? 'var(--viz-trade)' : tone === 'bad' ? 'var(--bad)' : tone === 'ctx' ? 'var(--viz-context)' : 'var(--viz-money)';
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${xLabel} against ${yLabel}`}>
      {ticks(xd[0], xd[1], 5).map((v) => (<g key={`x${v}`}><line x1={x(v)} x2={x(v)} y1={mt} y2={h - mb} className="gn-grid" /><text x={x(v)} y={h - mb + 14} textAnchor="middle" className="gn-tick">{fmtX(v)}</text></g>))}
      {ticks(yd[0], yd[1], 5).map((v) => (<g key={`y${v}`}><line x1={ml} x2={w - mr} y1={y(v)} y2={y(v)} className="gn-grid" /><text x={ml - 6} y={y(v) + 3.5} textAnchor="end" className="gn-tick">{fmtY(v)}</text></g>))}
      {xLine != null && <line x1={x(xLine)} x2={x(xLine)} y1={mt} y2={h - mb} className="gn-axis" strokeDasharray="4 3" />}
      {yLine != null && <line x1={ml} x2={w - mr} y1={y(yLine)} y2={y(yLine)} className="gn-axis" strokeDasharray="4 3" />}
      <text x={w - mr} y={h - 4} textAnchor="end" className="gn-chart-label">{xLabel}</text>
      <text x={ml + 4} y={mt + 10} className="gn-chart-label">{yLabel}</text>
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={x(p.x)} cy={y(p.y)} r={p.r ?? 4} fill={fill(p.tone)} fillOpacity={0.85} stroke="var(--surface-raised)" strokeWidth={1} />
          {!p.quiet && <text x={x(p.x) + (p.r ?? 4) + 3} y={y(p.y) + 3.5} className="gn-chart-label" style={{ fontSize: 10.5 }}>{p.label}</text>}
          {p.quiet && <title>{p.label}</title>}
        </g>
      ))}
    </svg>
  );
}
