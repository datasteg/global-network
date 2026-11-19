'use client';
// The Overview hero: holds the view state (lens, layout, unit, size, frequency, period, filters, zoom), keeps it in
// the URL, and hands each part what it draws. Without URL parameters the net lens's annual chart is drawn exactly as
// before; everything else is opt-in from the controls or a shared link.
import { useEffect, useMemo, useRef, useState } from 'react';
import { bn, num, pct } from '@/lib/format';
import { rich } from '@/lib/rich';
import { earn } from '@/lib/strings/earn';
import type { CiteItem } from '@/lib/sources';
import type { Earn, Lang, Quadrant } from '@/lib/types';
import { Cite } from '../Cite';
import { Term } from '../Term';
import { Head } from '../ui';
import { Filters } from './Filters';
import { Panel } from './Panel';
import { Period } from './Period';
import { Plot, niipBin, usdTick, type Pt } from './Plot';
import {
  DEFAULT_STATE, FREQ_DEFAULT, SIZE_KEY, axesOf, coords, filterActive, fitDomain, frame, fromUrl, fullDomain, fundBin, grossOf, isNet, itf, mapPeriod,
  passing, periodLabel, periodOfMonth, sameWin, sizeDefault, tf, toUrl, type Lens, type SizeBy, type Unit, type ViewState, type Win,
} from './model';

const LENSES: Lens[] = ['net', 'trade', 'finance', 'funding'];
const SIZES: SizeBy[] = ['pc', 'exports', 'assets', 'gdp'];
const UNITS: Unit[] = ['pct', 'usd'];
export const SIZE_CAP: Record<SizeBy, number> = { pc: 120000, exports: 4000, assets: 50000, gdp: 30000 };
export const SIZE_REFS: Record<SizeBy, number[]> = { pc: [10000, 50000, 100000], exports: [100, 1000, 4000], assets: [1000, 10000, 50000], gdp: [100, 1000, 30000] };

function useReducedMotion(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setR(m.matches);
    const f = () => setR(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return r;
}

export interface Preset { id: string; label: { en: string; ko: string }; t0: number }

export function EarnHero({ lang, data, names, codes, shown, kicker, presets = [] }: { lang: Lang; data: Earn; names: Record<string, string>; codes: string[]; shown: number; kicker: string; presets?: Preset[] }) {
  const S = earn(lang);
  const [s, setS] = useState<ViewState>(DEFAULT_STATE);
  const ready = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [live, setLive] = useState(false);
  const liveT = useRef<number | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => { setS(fromUrl(window.location.search)); ready.current = true; }, []);

  // full screen: the chart and its panel fill the display (Fullscreen API; hidden where a page element cannot go full screen)
  const shell = useRef<HTMLDivElement>(null);
  const [canFull, setCanFull] = useState(false);
  const [isFull, setIsFull] = useState(false);
  useEffect(() => {
    setCanFull(!!document.fullscreenEnabled);
    const f = () => setIsFull(document.fullscreenElement === shell.current);
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);
  const toggleFull = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void shell.current?.requestFullscreen(); };
  useEffect(() => {
    if (!ready.current) return;
    const id = window.setTimeout(() => window.history.replaceState(window.history.state, '', toUrl(s, window.location.href)), 200);
    return () => window.clearTimeout(id);
  }, [s]);
  const upd = (p: Partial<ViewState>) => setS((prev) => ({ ...prev, ...p }));

  const hasQ = !!data.q;
  const netLike = isNet(s.lens);
  const funding = s.lens === 'funding';
  const f = useMemo(() => frame(data, s.freq === 'q' && hasQ ? 'q' : 'a'), [data, s.freq, hasQ]);
  const ax = axesOf(s.lens, s.view, s.log, s.unit);
  const xy = useMemo(() => Object.fromEntries(codes.map((c) => [c, coords(f, c, s.lens, s.view, s.unit)])), [codes, f, s.lens, s.view, s.unit]);
  // the default period: the latest with values for at least half the economies in this lens
  const defK = useMemo(() => {
    for (let i = f.periods.length - 1; i >= 0; i--) if (codes.filter((c) => xy[c][0][i] != null && xy[c][1][i] != null).length >= codes.length / 2) return i;
    return f.periods.length - 1;
  }, [f, codes, xy]);
  const k = s.t && f.periods.includes(s.t) ? f.periods.indexOf(s.t) : defK;
  const per = f.periods[k];
  const setK = (i: number) => upd({ t: i === defK ? null : f.periods[i] });

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setS((prev) => {
        const i = prev.t && f.periods.includes(prev.t) ? f.periods.indexOf(prev.t) : defK;
        if (i >= f.periods.length - 1) { setPlaying(false); return prev; }
        return { ...prev, t: f.periods[i + 1] };
      });
    }, (f.freq === 'q' ? 450 : 1100) / s.speed);
    return () => window.clearInterval(id);
  }, [playing, f, defK, s.speed]);
  useEffect(() => { if (reduced) setPlaying(false); }, [reduced]);
  const togglePlay = () => {
    if (playing) { setPlaying(false); return; }
    if (k >= f.periods.length - 1) upd({ t: f.periods[0] });
    setPlaying(true);
  };

  const pass = useMemo(() => passing(s, f, k, codes, data.groups), [s, f, k, codes, data.groups]);
  const active = filterActive(s);
  const allPts = useMemo(() => codes.flatMap((c) => xy[c][0].map((x, i) => ({ x, y: xy[c][1][i] })).filter((p): p is { x: number; y: number } => p.x != null && p.y != null)), [codes, xy]);
  const full = useMemo(() => fullDomain(s.lens, s.view, s.log, allPts, s.unit), [s.lens, s.view, s.log, allPts, s.unit]);
  const fitPts = [...pass].map((c) => ({ x: xy[c][0][k], y: xy[c][1][k] })).filter((p): p is { x: number; y: number } => p.x != null && p.y != null && (ax.x !== 'log' || p.x > 0) && (ax.y !== 'log' || p.y > 0));
  const fitted = fitDomain(fitPts, ax, full);
  const target: Win = s.zoom ?? (active ? fitted : full);
  const atFull = !s.zoom && !active;

  // the drawn window glides to the target, except while a gesture drives it or the axes change kind
  const [win, setWin] = useState<Win>(target);
  const winRef = useRef(win); winRef.current = win;
  const kind = `${s.lens}|${s.view}|${s.log}|${s.unit}`;
  const lastKind = useRef(kind);
  useEffect(() => {
    if (lastKind.current !== kind) { lastKind.current = kind; setWin(target); return; }
    if (sameWin(winRef.current, target)) return;
    if (live || reduced) { setWin(target); return; }
    const from = winRef.current, t0 = performance.now(), dur = 380;
    const lerp = (a: number, b: number, u: number, sc: typeof ax.x) => itf(tf(a, sc) + (tf(b, sc) - tf(a, sc)) * u, sc);
    let raf = 0;
    const tick = (now: number) => {
      const u = Math.min(1, (now - t0) / dur), e = 1 - (1 - u) ** 3;
      setWin(u >= 1 ? target : { x: [lerp(from.x[0], target.x[0], e, ax.x), lerp(from.x[1], target.x[1], e, ax.x)], y: [lerp(from.y[0], target.y[0], e, ax.y), lerp(from.y[1], target.y[1], e, ax.y)] });
      if (u < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.x[0], target.x[1], target.y[0], target.y[1], live, kind]);

  // when the axes change kind (lens, layout, scale, unit) the stored window belongs to the old axes until the effect
  // above replaces it: draw the new target at once
  const drawn = lastKind.current === kind ? win : target;

  const onWin = (w: Win, isLive: boolean) => {
    if (isLive) { setLive(true); if (liveT.current) window.clearTimeout(liveT.current); liveT.current = window.setTimeout(() => setLive(false), 180); }
    upd({ zoom: w });
  };

  // points, sized by the active measure; filtered-out ones fade or go
  const sizeKey = SIZE_KEY[s.size];
  const fmtSize = (v: number | null) => (s.size === 'pc' ? `$${num(v, lang, 0)}` : bn(v, lang));
  // the two axes in words and how a value on each reads (the tooltip and the panel's two series share them)
  const gross = grossOf(s.lens);
  const xLabel = netLike ? S.xShort[s.unit] : s.view === 'rot' ? S.rotAxes[s.unit][gross].x : S.axes[s.unit][gross].x;
  const yLabel = netLike ? S.yShort[s.unit] : s.view === 'rot' ? S.rotAxes[s.unit][gross].y : S.axes[s.unit][gross].y;
  const axisNames: [string, string] = netLike ? [S.panel.trade, S.panel.pi] : [xLabel.split(',')[0], yLabel.split(',')[0]];
  const signed: [boolean, boolean] = netLike ? [true, true] : s.view === 'rot' ? [false, true] : [false, false];
  const fmtAxis = (v: number | null | undefined, i: 0 | 1) => (s.unit === 'usd' ? bn(v, lang, signed[i]) : pct(v, lang, s.lens === 'finance' && s.view === 'diag' ? 0 : 1, signed[i]));
  const tip = (c: string): string[] => {
    const g = (key: Parameters<typeof f.series>[1]) => f.series(c, key)[k] ?? null;
    return [`${axisNames[0]} ${fmtAxis(xy[c][0][k], 0)}`, `${axisNames[1]} ${fmtAxis(xy[c][1][k], 1)}`,
      `${S.panel.niip} ${pct(g('niip'), lang, 0, true)} · ${S.sizes[s.size]} ${fmtSize(g(sizeKey))}`,
      ...(funding ? [`${S.fund.tip} ${pct(g('top3'), lang, 0)}`] : [])];
  };
  // the colour: net IIP in five diverging steps, or in the funding lens the top-three creditor share of gross liabilities
  // for economies whose net earnings (the two balances together) are below zero; the others stay grey
  const colour = (c: string): { bin: number | null; grey?: boolean } => {
    const niip = f.series(c, 'niip')[k] ?? null;
    if (!funding) return { bin: niipBin(niip) };
    const gs = f.series(c, 'gs')[k], pi = f.series(c, 'pi')[k];
    if (gs == null || pi == null) return { bin: null };
    if (gs + pi >= 0) return { bin: null, grey: true };
    return { bin: fundBin(f.series(c, 'top3')[k] ?? null) };
  };
  const pts: Pt[] = codes.map((c) => ({ c, x: xy[c][0][k], y: xy[c][1][k] }))
    .filter((p): p is { c: string; x: number; y: number } => p.x != null && p.y != null && (!s.hide || pass.has(p.c)))
    .map((p) => ({ ...p, r: 0, sv: f.series(p.c, sizeKey)[k] ?? null, niip: f.series(p.c, 'niip')[k] ?? null, ...colour(p.c), faded: !pass.has(p.c), tip: tip(p.c) }));
  const topN = pts.filter((p) => !p.faded).sort((a, b) => (b.sv ?? 0) - (a.sv ?? 0)).slice(0, 10).map((p) => p.c);

  // counts over the economies that pass (the hub stays out, as before); in dollars the net lens's quadrants are by sign
  const band = s.unit === 'usd' ? 0 : data.band;
  const counts = useMemo(() => {
    const quad: Record<Quadrant, number> = { trade: 0, finance: 0, both: 0, neither: 0 };
    let a = 0, b = 0;
    for (const c of codes) {
      if (c === data.hub || !pass.has(c)) continue;
      const x = xy[c][0][k], y = xy[c][1][k];
      if (x == null || y == null) continue;
      if (netLike) { const t = x > band, fi = y > band; quad[t && fi ? 'both' : t ? 'trade' : fi ? 'finance' : 'neither']++; }
      else if (s.view === 'diag') { if (y > x) a++; else b++; }
      else { if (y > 0) a++; else b++; }
    }
    return { quad, a, b };
  }, [codes, data.hub, band, pass, xy, k, netLike, s.view]);

  const pickLens = (l: Lens) => {
    const freq = FREQ_DEFAULT[l] === 'q' && !hasQ ? 'a' : FREQ_DEFAULT[l];
    const nf = frame(data, freq);
    upd({ lens: l, size: sizeDefault(l, s.unit), freq, zoom: null, t: s.t ? mapPeriod(s.t, nf) : null });
  };
  // switching units keeps the economy, period and filters; the size follows the unit's default unless the reader chose one
  const pickUnit = (u: Unit) => upd({ unit: u, zoom: null, size: s.size === sizeDefault(s.lens, s.unit) ? sizeDefault(s.lens, u) : s.size, sizeRange: s.size === sizeDefault(s.lens, s.unit) ? null : s.sizeRange });
  const pickFreq = (fr: 'a' | 'q') => {
    const nf = frame(data, fr);
    upd({ freq: fr, t: s.t ? mapPeriod(s.t, nf) : null });
  };

  const lede = funding ? S.fund.lede
    : s.unit === 'usd' ? (netLike ? S.usd.lede : s.view === 'rot' ? S.usd.ledesRot[gross] : S.usd.ledes[gross])
    : netLike ? S.lede : s.view === 'rot' ? S.ledesRot[gross] : S.ledes[gross];
  const caption = funding ? S.fund.note
    : s.unit === 'usd' ? (netLike ? S.usd.netNote : s.view === 'rot' ? S.usd.rotNote[gross] : S.usd.diagNote[gross])
    : netLike ? S.band(num(data.band, lang, 0)) : s.view === 'rot' ? S.rotNote[gross] : gross === 'trade' ? S.diagNote.trade : ax.x === 'log' ? S.diagNote.financeLog : S.diagNote.finance;
  // halves of the gross lenses: the diagonal view in % has exports (assets) across, so above the line imports lead; in
  // dollars the outward side is up, so above the line reads as in the rotated view
  const halves = s.view === 'rot' || s.unit === 'usd' ? S.rotHalves[gross] : S.halves[gross];

  const y0 = data.years[0], y1 = data.years[data.years.length - 1];
  const yrs = lang === 'ko' ? `${y0}~${y1}년, 연간` : `${y0}–${y1}, annual`;
  const qp = data.q ? (lang === 'ko' ? `${periodLabel(data.q.periods[0], lang)}~${periodLabel(data.q.latest.bop ?? null, lang)}, 분기, 4분기 누적` : `${periodLabel(data.q.periods[0], lang)} to ${periodLabel(data.q.latest.bop ?? null, lang)}, quarterly, 4-quarter sums`) : '';
  const wdi = (series: string[]): CiteItem => ({ src: 'wdi', series, period: yrs });
  const iip: CiteItem = { src: 'imf.iip', series: ['IIP total assets / liabilities'], period: f.freq === 'q' ? (lang === 'ko' ? '분기 말' : 'quarter ends') : (lang === 'ko' ? `${y0}~${y1}년, 해마다 마지막 공표 분기` : `${y0}–${y1}, last published quarter of each year`) };
  const qCites: CiteItem[] = f.freq === 'q' ? [{ src: 'imf.bop', series: ['GS CD_T/DB_T', 'IN1 CD_T/DB_T'], period: qp }, { src: 'imf.qnea', series: ['B1GQ.V.NSA'], period: qp }, { src: 'bis.xru', period: lang === 'ko' ? '분기 평균' : 'quarterly averages' }] : [];
  const fundPer = lang === 'ko' ? `${y0}~${y1}년, 채널마다 그해의 마지막 공표 시점` : `${y0}–${y1}, each channel's latest period in the year`;
  const fundCites: CiteItem[] = funding ? [{ src: 'bis.lbs', period: fundPer }, { src: 'imf.pip', period: fundPer }, { src: 'imf.dip', period: fundPer }] : [];
  const cites: CiteItem[] = s.lens === 'finance'
    ? [iip, ...qCites, wdi(['NY.GDP.MKTP.CD', 'NY.GDP.PCAP.CD', 'BX.GSR.GNFS.CD']), { src: 'bis.tc' }]
    : [...(f.freq === 'a' ? [wdi(netLike ? ['BN.GSR.GNFS.CD', 'BN.GSR.FCTY.CD', 'NY.GDP.MKTP.CD', 'NY.GDP.PCAP.CD'] : ['BX.GSR.GNFS.CD', 'BM.GSR.GNFS.CD', 'NY.GDP.MKTP.CD', 'NY.GDP.PCAP.CD'])] : [...qCites, wdi(['NY.GDP.PCAP.CD'])]), ...fundCites, funding ? iip : { ...iip, series: undefined }, { src: 'bis.tc' }];
  const fresh = data.q ? S.fresh(periodLabel(data.q.latest.iip ?? null, lang), periodLabel(data.q.latest.bop ?? null, lang), periodLabel(String(data.latest?.wdi ?? y1), lang)) : null;

  return (
    <>
      <Head kicker={kicker} title={S.title} lede={<span className="gn-earn__lede" aria-live="polite">{rich(lede)}</span>} />
      {fresh && <p className="gn-small gn-muted gn-earn__fresh">{fresh}</p>}
      <section aria-label={S.title}>
        <div className="gn-earn" ref={shell}>
          <div className="gn-earn__chart">
            <div className="gn-earn__lenses">
              <div className="gn-seg" role="group" aria-label={S.lensLabel}>
                {LENSES.map((l) => (<button key={l} type="button" aria-pressed={s.lens === l} onClick={() => pickLens(l)}>{S.lenses[l]}</button>))}
              </div>
              <span className="gn-earn__opt"><Term id="unit">{S.unitLabel}</Term>
                <span className="gn-seg" role="group" aria-label={S.unitLabel}>
                  {UNITS.map((u) => (<button key={u} type="button" aria-pressed={s.unit === u} onClick={() => pickUnit(u)}>{S.units[u]}</button>))}
                </span>
              </span>
              {!netLike && (
                <span className="gn-earn__opt"><Term id="rotated">{S.geomLabel}</Term>
                  <span className="gn-seg" role="group" aria-label={S.geomLabel}>
                    <button type="button" aria-pressed={s.view === 'diag'} onClick={() => upd({ view: 'diag', zoom: null })}>{S.views.diag}</button>
                    <button type="button" aria-pressed={s.view === 'rot'} onClick={() => upd({ view: 'rot', zoom: null })}>{S.views.rot}</button>
                  </span>
                </span>
              )}
              <label className="gn-earn__opt">{S.sizeLabel}
                <select className="gn-select" value={s.size} onChange={(e) => upd({ size: e.target.value as SizeBy, sizeRange: null })}>
                  {SIZES.map((z) => (<option key={z} value={z}>{S.sizes[z]}</option>))}
                </select>
              </label>
              {s.lens === 'finance' && s.unit === 'pct' && (
                <span className="gn-earn__opt">{S.scaleLabel}
                  <span className="gn-seg" role="group" aria-label={S.scaleLabel}>
                    <button type="button" aria-pressed={s.log} onClick={() => upd({ log: true, zoom: null })}>{S.log}</button>
                    <button type="button" aria-pressed={!s.log} onClick={() => upd({ log: false, zoom: null })}>{S.linear}</button>
                  </span>
                </span>
              )}
            </div>
            <Period lang={lang} f={f} k={k} onK={(i) => { setPlaying(false); setK(i); }} playing={playing} onPlay={togglePlay} speed={s.speed} onSpeed={(v) => upd({ speed: v })}
              freq={f.freq} onFreq={pickFreq} canQ={hasQ}
              presets={presets.map((p) => ({ id: p.id, label: p.label[lang], t: periodOfMonth(p.t0, f) }))} onPreset={(t) => { setPlaying(false); upd({ t }); }} reduced={reduced} />
            <Filters lang={lang} s={s} upd={upd} codes={codes} names={names} f={f} k={k} shown={pass.size} locked={!!s.zoom}
              onLock={(on) => upd({ zoom: on ? drawn : null })} />
            {reduced && <p className="gn-small gn-muted">{S.reduced}</p>}
            <Plot lang={lang} lens={s.lens} view={s.view} unit={s.unit} ax={ax} win={drawn} full={full} atFull={atFull} filtered={active} live={live}
              pts={pts} names={names} sel={s.sel} band={band} period={periodLabel(per, lang)} counts={counts} halves={halves} topN={topN}
              cap={SIZE_CAP[s.size]} onSelect={(c) => upd({ sel: c })} onWin={onWin} onFit={() => upd({ zoom: fitDomain(fitPts, ax, full) })} onReset={() => upd({ zoom: null })}
              xLabel={xLabel} yLabel={yLabel} screen={canFull ? { on: isFull, toggle: toggleFull } : null} pal={funding ? 'seq' : 'div'}
              legend={funding
                ? { colour: rich(S.fund.colour), bins: S.fund.bins, none: S.fund.none, grey: S.fund.grey, sizeTerm: S.sizeTerm[s.size], sizeLabel: `${S.sizeLabel}: ${S.sizes[s.size]}`, refs: SIZE_REFS[s.size], refLabels: S.sizeRefs[s.size], caption: rich(caption), hint: S.zoom.hint }
                : { colour: rich(S.colour), bins: S.niipBins, none: S.noNiip, sizeTerm: S.sizeTerm[s.size], sizeLabel: `${S.sizeLabel}: ${S.sizes[s.size]}`, refs: SIZE_REFS[s.size], refLabels: S.sizeRefs[s.size], caption: rich(caption), hint: S.zoom.hint }} />
          </div>
          <Panel lang={lang} data={data} f={f} code={s.sel} k={k} names={names} codes={codes} onPick={(c) => upd({ sel: c })} shown={shown} lens={s.lens}
            xy={xy[s.sel] ?? [[], []]} axisNames={axisNames} fmtAxis={fmtAxis} tickAxis={(v) => (s.unit === 'usd' ? usdTick(v, lang) : `${num(v, lang, 0)}%`)} />
        </div>
        <Cite items={cites}>{S.note}</Cite>
      </section>
    </>
  );
}
