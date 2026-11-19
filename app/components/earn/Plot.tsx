'use client';
// The chart itself: axes for any window (linear, log or symmetric log; % of GDP or US dollars), the ±1% cross, the 45° or
// zero line, half or quadrant labels, bubbles of constant screen size, labels placed without collisions, the tooltip, and the gestures (wheel and
// pinch zoom at the pointer, drag to pan, Shift-drag or the box tool to zoom into a rectangle, double-click to zoom in).
// At the full view of the net lens with no filter it draws exactly what the original chart drew.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { num, pct } from '@/lib/format';
import { Term } from '../Term';
import { earn } from '@/lib/strings/earn';
import type { Lang, Quadrant } from '@/lib/types';
import { itf, placeLabels, scaleTicks, tf, type Axes, type Lens, type Unit, type View, type Win } from './model';

/** `bin` is the colour step in the active palette (null: no data, drawn hollow); `grey` marks an economy the lens leaves
 * uncoloured (the funding lens: net earnings at or above zero). */
export interface Pt { c: string; x: number; y: number; r: number; sv: number | null; niip: number | null; bin: number | null; grey?: boolean; faded: boolean; tip: string[] }

const NIIP_EDGES = [-50, -10, 10, 50];
const LABELLED = ['KOR', 'JPN', 'CHN', 'DEU', 'NOR', 'USA', 'SAU', 'GBR', 'TUR'];
export function niipBin(v: number | null): number | null {
  if (v == null) return null;
  let k = 0;
  while (k < NIIP_EDGES.length && v >= NIIP_EDGES[k]) k++;
  return k;
}
/** A dollar tick in USD bn, short: "500 bn", "1.5 tn" / "500억", "1.5조" (the axis title carries the currency). */
export function usdTick(v: number, lang: Lang): string {
  const a = Math.abs(v), sg = v < 0 ? '−' : '';
  if (lang === 'ko') return a >= 1000 ? `${sg}${num(a / 1000, lang, a % 1000 ? 1 : 0)}조` : a >= 0.1 ? `${sg}${num(a * 10, lang, 0)}억` : '0';
  return a >= 1000 ? `${sg}${num(a / 1000, lang, a % 1000 ? 1 : 0)} tn` : a >= 1 ? `${sg}${num(a, lang, 0)} bn` : a > 0 ? `${sg}${num(a, lang, 1)} bn` : '0';
}
function ticks(lo: number, hi: number, step: number): number[] {
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(v);
  return out;
}

/** The window's inner height, for a chart that fills the screen (0 before mount). */
function useViewportH(): number {
  const [vh, setVh] = useState(0);
  useEffect(() => {
    const f = () => setVh(window.innerHeight);
    f();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return vh;
}

export function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
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

export function Plot(props: {
  lang: Lang; lens: Lens; view: View; unit: Unit; ax: Axes; win: Win; full: Win; atFull: boolean; filtered: boolean; live: boolean;
  pts: Pt[]; names: Record<string, string>; sel: string; band: number; period: string; counts: { quad: Record<Quadrant, number>; a: number; b: number };
  halves: { above: string; below: string }; topN: string[]; onSelect: (c: string) => void; onWin: (w: Win, live: boolean) => void; onFit: () => void; onReset: () => void;
  xLabel: string; yLabel: string; children?: ReactNode; cap: number; screen?: { on: boolean; toggle: () => void } | null;
  /** The colour palette of the bins: diverging (net IIP) or sequential (the funding lens's creditor share). */
  pal: 'div' | 'seq';
  legend: { colour: ReactNode; bins: string[]; none: string; grey?: string; sizeTerm: string; sizeLabel: string; refs: number[]; refLabels: string[]; caption: ReactNode; hint: string };
}) {
  const { lang, lens, view, unit, ax, win, atFull, names, sel, band, counts, onWin, cap, legend, pal } = props;
  const netLike = lens === 'net' || lens === 'funding';
  const S = earn(lang);
  const [box, width] = useWidth<HTMLDivElement>();
  const svg = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [rect, setRectState] = useState<[number, number, number, number] | null>(null);
  const rectRef = useRef<[number, number, number, number] | null>(null);
  const setRect = (r: [number, number, number, number] | null) => { rectRef.current = r; setRectState(r); };
  const [boxTool, setBoxTool] = useState(false);
  const w = width;
  const narrow = w < 480;
  // phones keep the square-ish chart; wider screens fill the window's height (all of it, less the controls, in full screen)
  const vh = useViewportH();
  const h = narrow ? Math.round(Math.min(520, Math.max(320, w * 1.1)))
    : props.screen?.on && vh ? Math.max(360, vh - 300)
      : Math.round(Math.max(320, Math.min(w * 0.62, vh ? Math.max(420, vh - 320) : 520)));
  const ml = narrow ? 30 : 44, mr = 10, mt = 26, mb = narrow ? 40 : 44;
  const pw = w - ml - mr, ph = h - mt - mb;
  const rScale = narrow ? 11 : w > 1100 ? 20 : 15;
  const R = (v: number | null) => (v == null ? 3 : 2.5 + rScale * Math.sqrt(Math.min(v, cap) / cap));
  const pts = props.pts.map((p) => ({ ...p, r: R(p.sv) }));
  // positions: clamped into the domain at the full view, unclamped and clipped when zoomed
  const X = (v: number) => {
    const c = atFull ? Math.min(win.x[1], Math.max(win.x[0], v)) : v;
    return ml + ((tf(c, ax.x) - tf(win.x[0], ax.x)) / (tf(win.x[1], ax.x) - tf(win.x[0], ax.x))) * pw;
  };
  const Y = (v: number) => {
    const c = atFull ? Math.min(win.y[1], Math.max(win.y[0], v)) : v;
    return mt + (1 - (tf(c, ax.y) - tf(win.y[0], ax.y)) / (tf(win.y[1], ax.y) - tf(win.y[0], ax.y))) * ph;
  };
  const tx = (px: number) => tf(win.x[0], ax.x) + ((px - ml) / pw) * (tf(win.x[1], ax.x) - tf(win.x[0], ax.x));
  const ty = (py: number) => tf(win.y[0], ax.y) + (1 - (py - mt) / ph) * (tf(win.y[1], ax.y) - tf(win.y[0], ax.y));
  const toWin = (x0: number, x1: number, y0: number, y1: number): Win => ({ x: [itf(x0, ax.x), itf(x1, ax.x)], y: [itf(y0, ax.y), itf(y1, ax.y)] });

  // zoom by factor k about a screen point (k < 1 zooms in); the span may not shrink below a hundredth of the full view
  const zoomAt = (k: number, px: number, py: number, live: boolean) => {
    const cx = tx(px), cy = ty(py);
    const a = tf(win.x[0], ax.x), b = tf(win.x[1], ax.x), c = tf(win.y[0], ax.y), d = tf(win.y[1], ax.y);
    const fs = tf(props.full.x[1], ax.x) - tf(props.full.x[0], ax.x), gs = tf(props.full.y[1], ax.y) - tf(props.full.y[0], ax.y);
    const kk = Math.min(Math.max(k, (fs / 100) / (b - a), (gs / 100) / (d - c)), Math.min((fs * 3) / (b - a), (gs * 3) / (d - c)));
    onWin(toWin(cx + (a - cx) * kk, cx + (b - cx) * kk, cy + (c - cy) * kk, cy + (d - cy) * kk), live);
  };
  const panBy = (dx: number, dy: number) => {
    const sx = (tf(win.x[1], ax.x) - tf(win.x[0], ax.x)) / pw, sy = (tf(win.y[1], ax.y) - tf(win.y[0], ax.y)) / ph;
    onWin(toWin(tf(win.x[0], ax.x) - dx * sx, tf(win.x[1], ax.x) - dx * sx, tf(win.y[0], ax.y) + dy * sy, tf(win.y[1], ax.y) + dy * sy), true);
  };

  // wheel needs a non-passive listener to keep the page from scrolling under the chart
  const zoomRef = useRef(zoomAt); zoomRef.current = zoomAt;
  useEffect(() => {
    const el = svg.current; if (!el) return;
    const f = (e: WheelEvent) => { e.preventDefault(); const r = el.getBoundingClientRect(); zoomRef.current(Math.exp(e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top, true); };
    el.addEventListener('wheel', f, { passive: false });
    return () => el.removeEventListener('wheel', f);
  }, []);

  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gest = useRef<{ mode: 'pan' | 'box' | 'pinch' | null; x0: number; y0: number; moved: boolean; d0: number; lx: number; ly: number }>({ mode: null, x0: 0, y0: 0, moved: false, d0: 0, lx: 0, ly: 0 });
  const dragged = useRef(false);
  const local = (e: React.PointerEvent) => { const r = svg.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = local(e);
    ptrs.current.set(e.pointerId, p);
    dragged.current = false;
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      gest.current = { mode: 'pinch', x0: (a.x + b.x) / 2, y0: (a.y + b.y) / 2, moved: true, d0: Math.hypot(a.x - b.x, a.y - b.y), lx: 0, ly: 0 };
    } else {
      gest.current = { mode: e.shiftKey || boxTool ? 'box' : 'pan', x0: p.x, y0: p.y, moved: false, d0: 0, lx: p.x, ly: p.y };
    }
  };
  const onMove = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return;
    const p = local(e);
    ptrs.current.set(e.pointerId, p);
    const g = gest.current;
    if (g.mode === 'pinch' && ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (g.d0 > 0 && d > 0) { zoomAt(g.d0 / d, (a.x + b.x) / 2, (a.y + b.y) / 2, true); g.d0 = d; }
      dragged.current = true;
      return;
    }
    if (!g.moved && Math.hypot(p.x - g.x0, p.y - g.y0) < 4) return;
    if (!g.moved) { g.moved = true; try { svg.current?.setPointerCapture(e.pointerId); } catch { /* a pointer the browser does not track */ } }
    dragged.current = true;
    if (g.mode === 'box') setRect([g.x0, g.y0, p.x, p.y]);
    else if (g.mode === 'pan') { panBy(p.x - g.lx, p.y - g.ly); g.lx = p.x; g.ly = p.y; }
  };
  const onUp = (e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    const g = gest.current;
    const rc = rectRef.current;
    if (g.mode === 'box' && rc) {
      const [a, b, c, d] = rc;
      if (Math.abs(c - a) > 8 && Math.abs(d - b) > 8) onWin(toWin(tx(Math.min(a, c)), tx(Math.max(a, c)), ty(Math.max(b, d)), ty(Math.min(b, d))), false);
      setRect(null); setBoxTool(false);
    }
    if (ptrs.current.size === 0) gest.current.mode = null;
  };
  const onDbl = (e: React.MouseEvent) => { const r = svg.current!.getBoundingClientRect(); zoomAt(0.5, e.clientX - r.left, e.clientY - r.top, false); };

  // ticks and lines for the current window
  const isNetFull = netLike && unit === 'pct' && atFull;
  const xt = isNetFull ? ticks(win.x[0], win.x[1], narrow ? 10 : 5) : scaleTicks(win.x, ax.x, narrow ? 4 : 7);
  const yt = isNetFull ? ticks(win.y[0], win.y[1], narrow ? 4 : 2) : scaleTicks(win.y, ax.y, narrow ? 5 : 7);
  const fmtTick = (v: number) => (unit === 'usd' ? usdTick(v, lang) : num(v, lang, Math.abs(v) < 10 && v % 1 !== 0 ? 1 : 0));
  const inX = (v: number) => v >= win.x[0] - 1e-9 && v <= win.x[1] + 1e-9, inY = (v: number) => v >= win.y[0] - 1e-9 && v <= win.y[1] + 1e-9;
  const qPos: [Quadrant, number, number, 'start' | 'end'][] = [
    ['finance', ml + 6, mt + 14, 'start'], ['both', w - mr - 6, mt + 14, 'end'],
    ['neither', ml + 6, h - mb - 8, 'start'], ['trade', w - mr - 6, h - mb - 8, 'end'],
  ];
  // the 45° line clipped to the window, its label just inside the top-right end
  let diag: [number, number, number, number] | null = null;
  if (view === 'diag' && lens !== 'net') {
    const lo = Math.max(win.x[0], win.y[0]), hi = Math.min(win.x[1], win.y[1]);
    if (hi > lo) diag = [X(lo), Y(lo), X(hi), Y(hi)];
  }
  const ang = diag ? (Math.atan2(diag[3] - diag[1], diag[2] - diag[0]) * 180) / Math.PI : 0;

  // labels: the original fixed set at the net lens's full view; otherwise placed without collisions
  const visible = pts.filter((p) => !p.faded && X(p.x) >= ml - 2 && X(p.x) <= w - mr + 2 && Y(p.y) >= mt - 2 && Y(p.y) <= h - mb + 2);
  const want = isNetFull && !props.filtered ? null
    : atFull && !props.filtered ? visible.filter((p) => p.c === sel || props.topN.includes(p.c))
      : visible;
  const labels = want ? placeLabels(want.map((p) => ({ c: p.c, text: names[p.c] ?? p.c, px: X(p.x), py: Y(p.y), r: p.r, prio: (p.c === sel ? 1e9 : 0) + p.r })),
    { x0: ml, y0: mt, x1: w - mr, y1: h - mb }, narrow ? 10 : 11, visible.map((p) => ({ x: X(p.x), y: Y(p.y), r: p.r }))) : [];
  const tipP = hover ? pts.find((p) => p.c === hover) : null;
  // large bubbles first so small ones stay clickable on top
  const sorted = [...pts].sort((a, b) => (b.sv ?? 0) - (a.sv ?? 0));

  return (
    <div className="gn-earn__plot" ref={box}>
      <div className="gn-earn__zoom" role="toolbar" aria-label={S.zoom.reset}>
        <button type="button" className="gn-iconbtn" onClick={() => zoomAt(0.6, ml + pw / 2, mt + ph / 2, false)} aria-label={S.zoom.in} title={S.zoom.in}>+</button>
        <button type="button" className="gn-iconbtn" onClick={() => zoomAt(1 / 0.6, ml + pw / 2, mt + ph / 2, false)} aria-label={S.zoom.out} title={S.zoom.out}>−</button>
        <button type="button" className="gn-iconbtn" aria-pressed={boxTool} onClick={() => setBoxTool((b) => !b)} aria-label={S.zoom.box} title={S.zoom.box}>⬚</button>
        <button type="button" className="gn-iconbtn" onClick={props.onFit} aria-label={S.zoom.fit} title={S.zoom.fit}>⤢</button>
        <button type="button" className="gn-iconbtn" onClick={props.onReset} aria-label={S.zoom.reset} title={S.zoom.reset}>⟲</button>
        {props.screen && <button type="button" className="gn-iconbtn" aria-pressed={props.screen.on} onClick={props.screen.toggle} aria-label={props.screen.on ? S.zoom.exitFull : S.zoom.full} title={props.screen.on ? S.zoom.exitFull : S.zoom.full}>{props.screen.on ? '⤡' : '⛶'}</button>}
      </div>
      <div className="gn-earn__svgbox">
      <svg ref={svg} viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={`${props.xLabel} / ${props.yLabel}, ${props.period}`}
        className={`gn-earn__svg${props.live ? ' is-live' : ''}${boxTool ? ' is-box' : ''}`} style={{ touchAction: atFull ? 'pan-y' : 'none' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onDoubleClick={onDbl}>
        <defs><clipPath id="gn-earn-clip"><rect x={ml} y={mt} width={pw} height={ph} /></clipPath></defs>
        {netLike && unit === 'pct' && <g clipPath="url(#gn-earn-clip)">
          <rect x={X(-band)} y={mt} width={X(band) - X(-band)} height={h - mt - mb} className="gn-earn__band" />
          <rect x={ml} y={Y(band)} width={w - ml - mr} height={Y(-band) - Y(band)} className="gn-earn__band" />
        </g>}
        {xt.filter(inX).map((v) => (<g key={`x${v}`}><line x1={X(v)} x2={X(v)} y1={mt} y2={h - mb} className={ax.x !== 'log' && (netLike || unit === 'usd') && v === 0 ? 'gn-axis' : 'gn-grid'} /><text x={X(v)} y={h - mb + 14} textAnchor="middle" className="gn-tick">{fmtTick(v)}</text></g>))}
        {yt.filter(inY).map((v) => (<g key={`y${v}`}><line x1={ml} x2={w - mr} y1={Y(v)} y2={Y(v)} className={ax.y !== 'log' && (netLike || view === 'rot') && v === 0 ? 'gn-axis' : 'gn-grid'} /><text x={ml - 5} y={Y(v) + 3.5} textAnchor="end" className="gn-tick">{fmtTick(v)}</text></g>))}
        <text x={w - mr} y={h - 6} textAnchor="end" className="gn-chart-label">{props.xLabel} →</text>
        <text x={ml - (narrow ? 26 : 34)} y={12} className="gn-chart-label">↑ {props.yLabel}</text>
        {netLike && qPos.map(([q, qx, qy, anchor]) => (
          <text key={q} x={qx} y={qy} textAnchor={anchor} className={`gn-earn__quad gn-earn__quad--${q}`}>{S.quad[q]} · {S.count(counts.quad[q])}</text>
        ))}
        {!netLike && view === 'diag' && (<>
          {diag && <line x1={diag[0]} y1={diag[1]} x2={diag[2]} y2={diag[3]} className="gn-earn__diag" />}
          {/* the label sits at the empty end of the line: the top end in % of GDP, the low end in dollars (the largest economies crowd the top) */}
          {diag && (() => { const u = unit === 'usd' ? 0.06 : 0.96; return <text transform={`translate(${diag[0] + u * (diag[2] - diag[0])},${diag[1] + u * (diag[3] - diag[1])}) rotate(${ang}) translate(0,-6)`} textAnchor={unit === 'usd' ? 'start' : 'end'} className="gn-earn__diaglbl">{S.diag[lens]}</text>; })()}
          <text x={ml + 6} y={mt + 14} className="gn-earn__quad">{props.halves.above} · {S.count(counts.a)}</text>
          <text x={w - mr - 6} y={h - mb - 8} textAnchor="end" className="gn-earn__quad">{props.halves.below} · {S.count(counts.b)}</text>
        </>)}
        {!netLike && view === 'rot' && (<>
          <text x={ml + 6} y={mt + 14} className="gn-earn__quad">↑ {props.halves.above} · {S.count(counts.a)}</text>
          <text x={ml + 6} y={h - mb - 8} className="gn-earn__quad">↓ {props.halves.below} · {S.count(counts.b)}</text>
        </>)}
        <g clipPath={atFull ? undefined : 'url(#gn-earn-clip)'}>
          {sorted.map((p) => {
            const dot = p.grey ? 'gn-earn__dot--grey' : p.bin == null ? 'gn-earn__dot--none' : `gn-${pal}-${p.bin}`;
            const isSel = p.c === sel;
            const lblRight = X(p.x) > w * 0.75;
            return (
              <g key={p.c} className={`gn-earn__pt${p.faded ? ' is-faded' : ''}`} style={{ transform: `translate(${X(p.x)}px, ${Y(p.y)}px)` }}
                tabIndex={p.faded ? -1 : 0} role="button" aria-pressed={isSel} aria-hidden={p.faded || undefined}
                aria-label={`${names[p.c] ?? p.c}, ${props.period}: ${p.tip.join(', ')}`}
                onClick={() => { if (!dragged.current && !p.faded) props.onSelect(p.c); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); props.onSelect(p.c); } }}
                onMouseEnter={() => !p.faded && setHover(p.c)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(p.c)} onBlur={() => setHover(null)}>
                <circle r={Math.max(p.r + 4, 10)} className="gn-earn__hit" />
                <circle r={p.r} className={`gn-earn__dot ${dot}${isSel ? ' is-sel' : ''}`} />
                {isNetFull && !props.filtered && !p.faded && (isSel || LABELLED.includes(p.c)) && (lblRight
                  ? <text x={-p.r - 3} y={3.5} textAnchor="end" className={`gn-earn__lbl${isSel ? ' is-sel' : ''}`}>{names[p.c] ?? p.c}</text>
                  : <text x={p.r + 3} y={3.5} className={`gn-earn__lbl${isSel ? ' is-sel' : ''}`}>{names[p.c] ?? p.c}</text>)}
              </g>
            );
          })}
          {labels.map((l) => (<g key={`l${l.c}`} className="gn-earn__lblg">
            {l.leader && <line x1={l.leader[0]} y1={l.leader[1]} x2={l.leader[2]} y2={l.leader[3]} className="gn-earn__leader" />}
            <text x={l.x} y={l.y} textAnchor={l.anchor} className={`gn-earn__lbl${l.c === sel ? ' is-sel' : ''}`}>{l.text}</text>
          </g>))}
        </g>
        {rect && <rect x={Math.min(rect[0], rect[2])} y={Math.min(rect[1], rect[3])} width={Math.abs(rect[2] - rect[0])} height={Math.abs(rect[3] - rect[1])} className="gn-earn__boxsel" />}
      </svg>
      {tipP && (
        <div className="gn-earn__tip" style={{ left: Math.min(w - 190, X(tipP.x) + 12), top: Math.max(0, Y(tipP.y) - 70) }} role="status">
          <b>{names[tipP.c] ?? tipP.c} · {props.period}</b>
          {tipP.tip.map((s, i) => (<span key={i}>{s}</span>))}
        </div>
      )}
      </div>
      <div className="gn-earn__legend">
        <span>{legend.colour}</span>
        <span className="gn-earn__bins">
          {legend.bins.map((b, i) => (<span key={i}><i className={`gn-${pal}-${i}`} />{b}</span>))}
          {legend.grey && <span><i className="gn-earn__dot--grey" />{legend.grey}</span>}
          <span><i className="gn-earn__dot--none" />{legend.none}</span>
        </span>
        <span className="gn-earn__sizes">
          <span><Term id={legend.sizeTerm}>{legend.sizeLabel}</Term></span>
          {legend.refs.map((v, i) => { const r = R(v); return (<span key={v}><svg width={2 * r + 2} height={2 * r + 2} aria-hidden="true"><circle cx={r + 1} cy={r + 1} r={r} className="gn-earn__dot gn-earn__dot--none" /></svg>{legend.refLabels[i]}</span>); })}
        </span>
        <span>{legend.caption}</span>
        <span className="gn-earn__hint">{legend.hint}</span>
      </div>
      {props.children}
      {void pct}
    </div>
  );
}
