'use client';
// Shock replay: a supply shock played month by month along three waves of trade (origin -> direct importers ->
// third markets), with each economy recoloured by its funding flow score as the quarters pass, rings where V or A2
// crosses its line, and the dollar and the Fed's swap lines beside it. Data-driven: one Shock object per event
// (scripts/shocks.py, config/shocks.yaml). Stepped, without motion, when the reader prefers reduced motion.
import { Term } from './Term';
import { rich } from '@/lib/rich';
import { useEffect, useMemo, useRef, useState } from 'react';
import { month, num, pct, quarter } from '@/lib/format';
import { shock as shockStrings } from '@/lib/strings/shock';
import type { Lang, Shock, ShockFin } from '@/lib/types';

const BIN_EDGES = [-20, -5, 5, 20];
const bin = (v: number | null | undefined) => { if (v == null) return null; let k = 0; while (k < 4 && v >= BIN_EDGES[k]) k++; return k; };
const qendOf = (t: number) => { const y = Math.floor(t / 100), m = t % 100; const qm = Math.ceil(m / 3) * 3; return `${y}-${String(qm).padStart(2, '0')}-${qm === 3 || qm === 12 ? 31 : 30}`; };

function useReducedMotion(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => { const m = window.matchMedia('(prefers-reduced-motion: reduce)'); setR(m.matches); const f = () => setR(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return r;
}
function useWidth<T extends HTMLElement>(init = 720): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(init);
  useEffect(() => { if (!ref.current) return; const ro = new ResizeObserver((es) => { for (const e of es) setW(Math.max(280, Math.round(e.contentRect.width))); }); ro.observe(ref.current); return () => ro.disconnect(); }, []);
  return [ref, w];
}

/** A small line chart over the replay's months (or weekly dates mapped onto them), one axis, a cursor at the frame. */
function Strip({ xs, ys, tone, lo, hi, cursor, zero, fmt, h = 70, label }: { xs: number[]; ys: (number | null)[]; tone: string; lo: number; hi: number; cursor: number; zero?: boolean; fmt: (v: number) => string; h?: number; label: string }) {
  const w = 300, ml = 34, mr = 4, mt = 6, mb = 6;
  const X = (x: number) => ml + x * (w - ml - mr);
  const Y = (v: number) => mt + (1 - (v - lo) / (hi - lo || 1)) * (h - mt - mb);
  let d = ''; let pen = false;
  // a single missing month (no window of that length ends then) is bridged; a longer gap lifts the pen
  ys.forEach((v, i) => { if (v == null) { if (i > 0 && ys[i - 1] == null) pen = false; return; } d += `${pen ? 'L' : 'M'}${X(xs[i]).toFixed(1)},${Y(v).toFixed(1)} `; pen = true; });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="gn-shock__strip" role="img" aria-label={label}>
      {zero && lo < 0 && hi > 0 && <line x1={ml} x2={w - mr} y1={Y(0)} y2={Y(0)} className="gn-axis" />}
      <text x={ml - 4} y={Y(hi) + 8} textAnchor="end" className="gn-tick">{fmt(hi)}</text>
      <text x={ml - 4} y={Y(lo)} textAnchor="end" className="gn-tick">{fmt(lo)}</text>
      <line x1={X(cursor)} x2={X(cursor)} y1={mt} y2={h - mb} className="gn-shock__cursor" />
      <path d={d.trim()} className={tone} />
    </svg>
  );
}

export function ShockReplay({ lang, data, names }: { lang: Lang; data: Shock; names: Record<string, string> }) {
  const S = shockStrings(lang);
  const months = data.months;
  const k0 = months.indexOf(data.t0);
  const lastData = (() => { let i = months.length - 1; while (i > 0 && data.nodata[i]) i--; return i; })();
  const [k, setK] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [wave, setWave] = useState<0 | 1 | 2 | 3>(0);
  const [hover, setHover] = useState<{ kind: 'n' | 'e'; id: string } | null>(null);
  const reduced = useReducedMotion();
  const [box, width] = useWidth<HTMLDivElement>();
  const [layout, setLayout] = useState<'map' | 'columns' | null>(null);
  const lay = layout ?? (width < 640 ? 'columns' : 'map');
  const m = months[k];
  const q = qendOf(m);
  const prevQ = qendOf(months[Math.max(0, k - 1)]);
  const p1 = data.wave1[lang], p3 = data.wave3[lang];

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setK((v) => { if (v >= lastData) { setPlaying(false); return v; } return v + 1; }), 900);
    return () => window.clearInterval(id);
  }, [playing, lastData]);
  useEffect(() => { if (reduced) setPlaying(false); }, [reduced]);

  // geometry
  const w = width;
  const narrow = w < 640;
  const h = lay === 'map' ? Math.round(Math.max(340, Math.min(520, w * 0.52))) : Math.round(Math.max(420, data.nodes.length * (narrow ? 22 : 24) / 2.2 + 60));
  const pos = useMemo(() => {
    const out: Record<string, [number, number]> = {};
    if (lay === 'map') {
      for (const n of data.nodes) out[n.id] = [16 + n.xy[0] * (w - 32), 14 + n.xy[1] * (h - 28)];
    } else {
      const cols: Record<number, string[]> = { 1: [], 2: [], 3: [] };
      for (const n of data.nodes) cols[n.wave].push(n.id);
      const cx = { 1: narrow ? 0.1 : 0.12, 2: 0.5, 3: narrow ? 0.9 : 0.88 } as Record<number, number>;
      for (const c of [1, 2, 3]) {
        const ids = cols[c];
        ids.forEach((id, i) => { out[id] = [cx[c] * w, 30 + ((i + 0.5) / ids.length) * (h - 44)]; });
      }
    }
    return out;
  }, [lay, data.nodes, w, h, narrow]);

  const vmax = useMemo(() => Math.max(1e-9, ...data.edges.flatMap((e) => e.v.filter((v): v is number => v != null))), [data.edges]);
  const ew = (v: number | null) => (v == null ? 0.8 : Math.max(0.8, (narrow ? 7 : 11) * Math.sqrt(v / vmax)));
  const nodeC = (id: string) => data.nodes.find((n) => n.id === id)?.c[k] ?? null;
  // F of the frame's quarter, or the latest quarter published before it (marked in the tooltip as carried)
  const fin = (id: string): (ShockFin & { q: string; carried: boolean }) | null => {
    const rows = data.finance[id];
    if (!rows) return null;
    if (rows[q]) return { ...rows[q], q, carried: false };
    const prev = Object.keys(rows).filter((x) => x < q && rows[x].f != null).sort().pop();
    return prev ? { ...rows[prev], q: prev, carried: true } : null;
  };
  const pulseQ = q !== prevQ || k === 0;

  const step = (d: number) => { setPlaying(false); setK((v) => Math.max(0, Math.min(months.length - 1, v + d))); };
  const toggle = () => { if (playing) { setPlaying(false); return; } if (k >= lastData) setK(0); setPlaying(true); };
  const curve = (a: [number, number], b: [number, number]) => {
    if (lay === 'columns') { const mx = (a[0] + b[0]) / 2; return `M${a[0]},${a[1]} C${mx},${a[1]} ${mx},${b[1]} ${b[0]},${b[1]}`; }
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const cx = (a[0] + b[0]) / 2 - dy * 0.18, cy = (a[1] + b[1]) / 2 + dx * 0.18;
    return `M${a[0]},${a[1]} Q${cx},${cy} ${b[0]},${b[1]}`;
  };
  const inWave = (ew2: number) => wave === 0 || (wave === 1 && ew2 === 2) || wave === ew2;
  const nodeIn = (nw: number) => wave === 0 || (wave === 1 && nw === 1) || (wave === 2 && nw <= 2) || (wave === 3 && nw >= 2);

  // strips
  const xsM = months.map((_, i) => i / (months.length - 1));
  const tOf = (iso: string) => { const y = +iso.slice(0, 4), mo = +iso.slice(5, 7), d = +iso.slice(8, 10); return (y * 12 + mo - 1 + (d - 1) / 30); };
  const t0m = Math.floor(months[0] / 100) * 12 + (months[0] % 100) - 1, t1m = Math.floor(months[months.length - 1] / 100) * 12 + (months[months.length - 1] % 100) - 1;
  const xsW = (pts: [string, number][]) => pts.map((p) => Math.max(0, Math.min(1, (tOf(p[0]) - t0m) / (t1m - t0m || 1))));
  const waveVals = Object.values(data.waves).flat().filter((v): v is number => v != null);
  const wLo = Math.min(-10, ...waveVals), wHi = Math.max(10, ...waveVals);
  const dv = data.dollar.map((p) => p[1]), sv = data.swap.map((p) => p[1]);
  const cur = k / (months.length - 1);
  const ko = lang === 'ko';
  const cov = data.coverage[k];

  const hoverBox = (() => {
    if (!hover) return null;
    if (hover.kind === 'n') {
      const n = data.nodes.find((x) => x.id === hover.id)!;
      const f = fin(n.id);
      const [x, y] = pos[n.id];
      return { x, y, lines: [`${names[n.id] ?? n.id} · ${S.tip.wave} ${n.wave}`,
        ...(n.wave === 2 && n.share != null ? [`${pct(n.share, lang, 0)} ${S.tip.share} ${S.tip.from}`] : []),
        ...(f ? [`${S.tip.f} ${num(f.f, lang, 1, true)} · ${S.tip.v} ${num(f.v, lang, 0)}${f.a2 != null ? ` · ${S.tip.a2} ${pct(f.a2, lang, 0)}` : ''}`, `${quarter(f.q, lang)}${f.carried ? ` · ${S.carried}` : ''}`] : [S.noScore]),
        ...(nodeC(n.id) != null ? [`${S.tip.c} ${pct(100 * (nodeC(n.id) as number), lang, 0)}`] : [])] };
    }
    const e = data.edges.find((x) => `${x.s}>${x.t}` === hover.id)!;
    const a = pos[e.s], b = pos[e.t];
    const v = e.v[k];
    return { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, lines: [`${names[e.s] ?? e.s} → ${names[e.t] ?? e.t}`,
      `${S.tip.v12}: ${v == null ? '–' : ko ? `${num(v * 10, lang, 0)}억 달러` : `$${num(v, lang, v < 10 ? 2 : 1)} bn`}`, `${S.tip.y3}: ${pct(e.y[k], lang, 1, true)}`] };
  })();

  return (
    <div className="gn-shock">
      <div className="gn-shock__bar">
        <div className="gn-shock__when"><b>{month(m, lang)}</b><span>{S.rel(k - k0)}</span></div>
        {!reduced && <button type="button" className="gn-btn gn-btn--sm gn-btn--primary" onClick={toggle} aria-pressed={playing}>{playing ? S.pause : k >= lastData ? S.restart : S.play}</button>}
        <span className="gn-earn__scrub">
          <button type="button" className="gn-btn gn-btn--sm" onClick={() => step(-1)} disabled={k === 0} aria-label={S.prev}>‹</button>
          <input className="gn-earn__slider" type="range" min={0} max={months.length - 1} value={k} aria-label={S.month} aria-valuetext={month(m, lang)}
            onChange={(e) => { setPlaying(false); setK(Number(e.target.value)); }} />
          <button type="button" className="gn-btn gn-btn--sm" onClick={() => step(1)} disabled={k === months.length - 1} aria-label={S.next}>›</button>
        </span>
      </div>
      <div className="gn-shock__timeline" aria-hidden="true">
        {months.map((mm, i) => (
          <span key={mm} className={`${i === k ? 'is-now ' : ''}${i === k0 ? 'is-t0 ' : ''}${data.nodata[i] ? 'is-none ' : (data.coverage[i] ?? 1) < 0.9 ? 'is-low ' : ''}`} onClick={() => { setPlaying(false); setK(i); }} title={month(mm, lang)} />
        ))}
      </div>
      <p className="gn-small gn-muted gn-shock__status" aria-live="polite">
        {data.nodata[k] ? S.nodata : cov != null && cov < 0.9 ? S.lowCov(pct(100 * cov, lang, 0)) : ' '}
      </p>
      <div className="gn-shock__opts">
        <div className="gn-seg" role="group" aria-label={S.wave}>
          {([0, 1, 2, 3] as const).map((wv) => (<button key={wv} type="button" aria-pressed={wave === wv} onClick={() => setWave(wv)}>{wv === 0 ? S.all : `${wv} · ${S.waves[wv]}`}</button>))}
        </div>
        <div className="gn-seg" role="group" aria-label={S.layout}>
          <button type="button" aria-pressed={lay === 'map'} onClick={() => setLayout('map')}>{S.map}</button>
          <button type="button" aria-pressed={lay === 'columns'} onClick={() => setLayout('columns')}>{S.columns}</button>
        </div>
      </div>

      <div className="gn-shock__main">
        <div className="gn-shock__net" ref={box}>
          <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={`${data.event.title[lang]}, ${month(m, lang)}`}>
            {lay === 'columns' && [1, 2, 3].map((c) => (
              <text key={c} x={(c === 1 ? (narrow ? 0.1 : 0.12) : c === 2 ? 0.5 : narrow ? 0.9 : 0.88) * w} y={14} textAnchor="middle" className="gn-chart-label">{S.waves[c]}</text>
            ))}
            {data.edges.map((e) => {
              const a = pos[e.s], b = pos[e.t];
              if (!a || !b) return null;
              const yb = bin(e.y[k]);
              const low = (nodeC(e.s) ?? 1) < 0.9 || (nodeC(e.t) ?? 1) < 0.9 || e.held[k] === 1;
              const on = inWave(e.wave);
              return (
                <path key={`${e.s}>${e.t}`} d={curve(a, b)} className={`gn-shock__edge ${data.nodata[k] || e.v[k] == null ? 'is-none' : yb == null ? 'is-unk' : `gn-dstroke-${yb}`}${low ? ' is-low' : ''}`}
                  style={{ strokeWidth: ew(e.v[k]), opacity: on ? (hover && hover.kind === 'e' && hover.id !== `${e.s}>${e.t}` ? 0.35 : 0.9) : 0.08 }}
                  onMouseEnter={() => setHover({ kind: 'e', id: `${e.s}>${e.t}` })} onMouseLeave={() => setHover(null)} />
              );
            })}
            {data.nodes.map((n) => {
              const [x, y] = pos[n.id];
              const f = fin(n.id);
              const fb = n.board ? bin(f?.f) : null;
              const r = n.wave === 1 ? (narrow ? 8 : 10) : narrow ? 5.5 : 7;
              const pulse = !!f && !f.carried && (f.vx === 1 || f.ax === 1); // ringed all quarter, animated when the quarter turns
              const right = lay === 'columns' ? n.wave !== 3 : x < w * 0.82;
              return (
                <g key={n.id} transform={`translate(${x},${y})`} style={{ opacity: nodeIn(n.wave) ? 1 : 0.25 }} tabIndex={0} role="img"
                  aria-label={`${names[n.id] ?? n.id}, ${S.waves[n.wave]}${f ? `, F ${num(f.f, lang, 1, true)}` : ''}`}
                  onMouseEnter={() => setHover({ kind: 'n', id: n.id })} onMouseLeave={() => setHover(null)} onFocus={() => setHover({ kind: 'n', id: n.id })} onBlur={() => setHover(null)}>
                  {pulse && <circle key={`${n.id}-${q}`} r={r + 4} className={`gn-shock__pulse${reduced || !pulseQ ? ' is-static' : ''}`} />}
                  <circle r={r} className={`gn-shock__node ${fb == null ? 'is-nos' : `gn-div-${fb}`}${n.wave === 1 ? ' is-origin' : ''}`} />
                  <text x={right ? r + 4 : -r - 4} y={3.5} textAnchor={right ? 'start' : 'end'} className="gn-earn__lbl">{names[n.id] ?? n.id}</text>
                </g>
              );
            })}
          </svg>
          {hoverBox && (
            <div className="gn-earn__tip" style={{ left: Math.max(0, Math.min(w - 200, hoverBox.x + 10)), top: Math.max(0, hoverBox.y - 64) }} role="status">
              {hoverBox.lines.map((l, i) => (i === 0 ? <b key={i}>{l}</b> : <span key={i}>{l}</span>))}
            </div>
          )}
        </div>

        <aside className="gn-shock__side">
          <p className="gn-kicker"><Term id="waves">{S.wavesH}</Term></p>
          {(['1', '2', '3'] as const).map((wk) => {
            const tr = data.trough[wk];
            return (
              <div key={wk} className="gn-shock__wave">
                <span className="gn-small">{S.waveLong[+wk](+wk === 3 ? p3 : p1)}</span>
                <Strip xs={xsM} ys={data.waves[wk]} tone={wk === '1' ? 'gn-line-trade' : wk === '2' ? 'gn-line-money' : 'gn-line-ctx-strong'} lo={wLo} hi={wHi} cursor={cur} zero fmt={(v) => pct(v, lang, 0)} h={54} label={S.waves[+wk]} />
                <span className="gn-small gn-muted">{data.waves[wk][k] != null ? pct(data.waves[wk][k], lang, 1, true) : '–'} · {tr && tr.v < 0 ? S.trough(month(tr.t, lang), pct(tr.v, lang, 1, true)) : S.noFall}</span>
              </div>
            );
          })}
          <p className="gn-kicker"><Term id="dollar_index">{S.dollarH}</Term> <span className="gn-muted">· {S.dollarUnit}</span></p>
          <Strip xs={xsW(data.dollar)} ys={dv} tone="gn-line-money" lo={Math.min(...dv)} hi={Math.max(...dv)} cursor={cur} fmt={(v) => num(v, lang, 0)} label={S.dollarH} />
          <p className="gn-kicker"><Term id="swap_lines">{S.swapH}</Term> <span className="gn-muted">· {S.swapUnit}</span></p>
          <Strip xs={xsW(data.swap)} ys={sv} tone="gn-line-money" lo={0} hi={Math.max(10, ...sv)} cursor={cur} fmt={(v) => (ko ? num(v * 10, lang, 0) : num(v, lang, 0))} label={S.swapH} />
        </aside>
      </div>

      <div className="gn-shock__legend">
        <span>{rich(S.edgeLegend)}</span>
        <span className="gn-earn__bins">{S.yoyBins.map((b, i) => (<span key={i}><i className={`gn-div-${i}`} />{b}</span>))}</span>
        <span>{rich(S.nodeLegend)}</span>
        <span className="gn-earn__bins">{S.fBins.map((b, i) => (<span key={i}><i className={`gn-div-${i}`} />{b}</span>))}<span><i className="gn-earn__dot--none" />{S.noScore}</span></span>
        <span>{rich(S.pulses)}</span>
        <span>{rich(S.dashed)}</span>
      </div>
    </div>
  );
}
