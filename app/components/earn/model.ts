// The Overview chart's model, free of React: the view state and its URL form, the frames (annual WDI or quarterly IMF),
// each lens's coordinates (diagonal or rotated, % of GDP or US dollars), the filters, the axis scales (linear, log,
// symmetric log) and domains (full, fitted, zoomed), ticks, and the label placement. Components in this folder only draw what these functions return.
import type { Earn, EarnGroup, RegionGroup } from '@/lib/types';

/** net: the two balances; trade and finance: the gross pairs; funding: the net lens's axes with the colour of who holds
 * an economy's liabilities ("Who funds the deficit"). */
export type Lens = 'net' | 'trade' | 'finance' | 'funding';
/** The two lenses drawn on the net-earnings axes. */
export const isNet = (l: Lens): boolean => l === 'net' || l === 'funding';
/** The gross pair a lens's halves and notes refer to. */
export const grossOf = (l: Lens): 'trade' | 'finance' => (l === 'finance' ? 'finance' : 'trade');
export type View = 'diag' | 'rot';
/** Unit of the axes: % of GDP (the default) or US dollars (USD bn on the axes, log or symmetric-log scales). */
export type Unit = 'pct' | 'usd';
/** Axis scale: linear, log (positive values), or symmetric log for signed dollar amounts (sym, see SYM_C). */
export type Scale = 'lin' | 'log' | 'sym';
export type SizeBy = 'pc' | 'exports' | 'assets' | 'gdp';
export type Freq = 'a' | 'q';
export type TopMetric = 'exports' | 'gdp' | 'assets';
export type Region = RegionGroup | 'euro';
export type Dom = [number, number];
export interface Win { x: Dom; y: Dom }

export interface ViewState {
  lens: Lens; view: View; unit: Unit; size: SizeBy; log: boolean; freq: Freq;
  t: string | null;               // the current period ("2025" or "2025-Q4"); null = the latest
  sel: string;                    // the economy in the side panel
  countries: string[]; regions: Region[]; group: 'adv' | 'eme' | null; borrower: 'yes' | 'no' | null;
  top: { m: TopMetric; n: number } | null; sizeRange: [number, number] | null; hide: boolean;
  zoom: Win | null;               // a fixed window in data units: set by zoom, pan, box, "fit" or "lock axes"
  speed: number;
}

/** The rotated view is the default for the two gross lenses: in the screenshots of 1 Nov 2026 it separated far more
 * economies than the diagonal (the gross pairs are strongly correlated, so their difference carries the spread). */
export const VIEW_DEFAULT: View = 'rot';
export const SIZE_DEFAULT: Record<Lens, SizeBy> = { net: 'pc', trade: 'exports', finance: 'assets', funding: 'pc' };
/** In dollars the gross lenses' default sizes would repeat the x axis (exports, assets): GDP instead. */
export const sizeDefault = (lens: Lens, unit: Unit): SizeBy => (unit === 'usd' && !isNet(lens) ? 'gdp' : SIZE_DEFAULT[lens]);
export const FREQ_DEFAULT: Record<Lens, Freq> = { net: 'a', trade: 'a', finance: 'q', funding: 'a' };

export const DEFAULT_STATE: ViewState = {
  lens: 'net', view: VIEW_DEFAULT, unit: 'pct', size: 'pc', log: true, freq: 'a', t: null, sel: 'KOR',
  countries: [], regions: [], group: null, borrower: null, top: null, sizeRange: null, hide: false, zoom: null, speed: 1,
};

// ---------------------------------------------------------------- URL
const LENSES: Lens[] = ['net', 'trade', 'finance', 'funding'];
const SIZES: SizeBy[] = ['pc', 'exports', 'assets', 'gdp'];
const REGIONS: Region[] = ['apac', 'europe', 'euro', 'americas', 'mea'];
const TOPS: TopMetric[] = ['exports', 'gdp', 'assets'];
const num = (s: string) => { const v = Number(s); return Number.isFinite(v) ? v : null; };
const r4 = (v: number) => Number(v.toPrecision(4));

export function fromUrl(search: string): ViewState {
  const p = new URLSearchParams(search);
  const lens = (LENSES as string[]).includes(p.get('lens') ?? '') ? (p.get('lens') as Lens) : 'net';
  const unit: Unit = p.get('unit') === 'usd' ? 'usd' : 'pct';
  const s: ViewState = { ...DEFAULT_STATE, lens, unit, size: sizeDefault(lens, unit), freq: FREQ_DEFAULT[lens] };
  const v = p.get('view'); if (v === 'diag' || v === 'rot') s.view = v;
  const size = p.get('size'); if (size && (SIZES as string[]).includes(size)) s.size = size as SizeBy;
  if (p.get('scale') === 'linear') s.log = false;
  const f = p.get('f'); if (f === 'a' || f === 'q') s.freq = f;
  const t = p.get('t'); if (t && /^\d{4}(-Q[1-4])?$/.test(t)) s.t = t;
  const e = p.get('e'); if (e && /^[A-Z]{3}$/.test(e)) s.sel = e;
  const c = p.get('c'); if (c) s.countries = c.split(',').filter((x) => /^[A-Z]{3}$/.test(x));
  const reg = p.get('reg'); if (reg) s.regions = reg.split(',').filter((x): x is Region => (REGIONS as string[]).includes(x));
  const g = p.get('grp'); if (g === 'adv' || g === 'eme') s.group = g;
  const b = p.get('brw'); if (b === 'yes' || b === 'no') s.borrower = b;
  const top = p.get('top')?.match(/^(exports|gdp|assets)(\d{1,2})$/); if (top) s.top = { m: top[1] as TopMetric, n: Number(top[2]) };
  const sr = p.get('sr')?.split('_').map(num); if (sr && sr.length === 2 && sr[0] != null && sr[1] != null) s.sizeRange = [sr[0], sr[1]];
  if (p.get('hide') === '1') s.hide = true;
  const z = p.get('z')?.split('_').map(num); if (z && z.length === 4 && z.every((x) => x != null)) s.zoom = { x: [z[0]!, z[1]!], y: [z[2]!, z[3]!] };
  const sp = num(p.get('speed') ?? ''); if (sp && sp > 0 && sp <= 4) s.speed = sp;
  return s;
}

export function toUrl(s: ViewState, base: string): string {
  const u = new URL(base);
  // 'r' (the trail range, removed on 1 Nov 2026) is still deleted so old links come out clean
  for (const k of ['lens', 'view', 'unit', 'size', 'scale', 'f', 't', 'r', 'e', 'c', 'reg', 'grp', 'brw', 'top', 'sr', 'hide', 'z', 'speed']) u.searchParams.delete(k);
  const set = (k: string, v: string) => u.searchParams.set(k, v);
  if (s.lens !== 'net') set('lens', s.lens);
  if (!isNet(s.lens) && s.view !== VIEW_DEFAULT) set('view', s.view);
  if (s.unit === 'usd') set('unit', 'usd');
  if (s.size !== sizeDefault(s.lens, s.unit)) set('size', s.size);
  if (s.lens === 'finance' && s.unit === 'pct' && !s.log) set('scale', 'linear');
  if (s.freq !== FREQ_DEFAULT[s.lens]) set('f', s.freq);
  if (s.t) set('t', s.t);
  if (s.sel !== DEFAULT_STATE.sel) set('e', s.sel);
  if (s.countries.length) set('c', s.countries.join(','));
  if (s.regions.length) set('reg', s.regions.join(','));
  if (s.group) set('grp', s.group);
  if (s.borrower) set('brw', s.borrower);
  if (s.top) set('top', `${s.top.m}${s.top.n}`);
  if (s.sizeRange) set('sr', `${r4(s.sizeRange[0])}_${r4(s.sizeRange[1])}`);
  if (s.hide) set('hide', '1');
  if (s.zoom) set('z', [s.zoom.x[0], s.zoom.x[1], s.zoom.y[0], s.zoom.y[1]].map(r4).join('_'));
  if (s.speed !== 1) set('speed', String(s.speed));
  return u.pathname + u.search + u.hash;
}

// ---------------------------------------------------------------- frames
export type Key = 'gs' | 'pi' | 'xg' | 'mg' | 'xu' | 'mu' | 'gdp' | 'fa' | 'fl' | 'fag' | 'flg' | 'niip' | 'pc' | 'top3' | 'named';
const FUND_KEYS: Key[] = ['top3', 'named'];
export interface Frame { freq: Freq; periods: string[]; series: (c: string, k: Key) => (number | null)[] }

export function frame(data: Earn, freq: Freq): Frame {
  // the funding shares are annual (each channel's latest period in the year): a quarter takes its year's value
  const fund = (c: string, k: Key): (number | null)[] => (data.fund?.[c]?.[k as 'top3' | 'named'] as (number | null)[] | undefined) ?? [];
  if (freq === 'q' && data.q) {
    const q = data.q;
    return { freq, periods: q.periods, series: (c, k) => (FUND_KEYS.includes(k)
      ? q.periods.map((p) => { const i = data.years.indexOf(Number(p.slice(0, 4))); return i >= 0 ? fund(c, k)[i] ?? null : null; })
      : (q.econ[c]?.[k as keyof (typeof q.econ)[string]] as (number | null)[] | undefined) ?? []) };
  }
  return { freq: 'a', periods: data.years.map(String), series: (c, k) => (FUND_KEYS.includes(k) ? fund(c, k) : (data.econ[c]?.[k as keyof (typeof data.econ)[string]] as (number | null)[] | undefined) ?? []) };
}

/** The funding lens's colour: the top-three creditor share of gross liabilities in five steps (edges in %). */
export const FUND_EDGES = [20, 30, 40, 50];
export function fundBin(v: number | null): number | null {
  if (v == null) return null;
  let k = 0;
  while (k < FUND_EDGES.length && v >= FUND_EDGES[k]) k++;
  return k;
}

/** "2025-Q2" → "2025 Q2" / "2025년 2분기"; "2025" → "2025" / "2025년". */
export function periodLabel(p: string | null | undefined, lang: 'en' | 'ko'): string {
  if (!p) return '–';
  const m = p.match(/^(\d{4})-Q([1-4])$/);
  if (m) return lang === 'ko' ? `${m[1]}년 ${m[2]}분기` : `${m[1]} Q${m[2]}`;
  return lang === 'ko' ? `${p}년` : p;
}

/** The nearest period of the other frequency: a year maps to its last quarter present, a quarter to its year. */
export function mapPeriod(p: string | null, to: Frame): string | null {
  if (!p) return null;
  const y = p.slice(0, 4);
  if (to.freq === 'a') return to.periods.includes(y) ? y : to.periods[to.periods.length - 1];
  const qs = to.periods.filter((x) => x.startsWith(y));
  return qs.length ? qs[qs.length - 1] : to.periods.filter((x) => x <= `${y}-Q4`).pop() ?? to.periods[to.periods.length - 1];
}

/** A month 202003 → the period that contains it. */
export function periodOfMonth(t0: number, f: Frame): string | null {
  const y = String(Math.floor(t0 / 100)), q = Math.ceil((t0 % 100) / 3);
  const want = f.freq === 'a' ? y : `${y}-Q${q}`;
  return f.periods.includes(want) ? want : null;
}

// ---------------------------------------------------------------- coordinates
/** Per economy, the (x, y) arrays of a lens in a view and unit, aligned on the frame's periods. In dollars (USD bn) the
 * net lens is the two balances, the diagonal view puts the outward side up (imports across, exports up; liabilities
 * across, assets up) so the 45° line is still balance zero, and the rotated view is the same mean and difference. */
export function coords(f: Frame, c: string, lens: Lens, view: View, unit: Unit = 'pct'): [(number | null)[], (number | null)[]] {
  if (unit === 'usd') {
    if (isNet(lens)) {
      const g = f.series(c, 'gdp');
      const usd = (a: (number | null)[]) => a.map((v, i) => (v != null && g[i] != null ? (v * (g[i] as number)) / 100 : null));
      return [usd(f.series(c, 'gs')), usd(f.series(c, 'pi'))];
    }
    const [out, inn] = lens === 'trade' ? [f.series(c, 'xu'), f.series(c, 'mu')] : [f.series(c, 'fa'), f.series(c, 'fl')];
    if (view === 'diag') return [inn, out];
    return meanDiff(out, inn);
  }
  if (isNet(lens)) return [f.series(c, 'gs'), f.series(c, 'pi')];
  const [a, b] = lens === 'trade' ? [f.series(c, 'xg'), f.series(c, 'mg')] : [f.series(c, 'fag'), f.series(c, 'flg')];
  if (view === 'diag') return [a, b];
  return meanDiff(a, b);
}

function meanDiff(a: (number | null)[], b: (number | null)[]): [(number | null)[], (number | null)[]] {
  const n = Math.max(a.length, b.length);
  const mid: (number | null)[] = [], diff: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    const u = a[i], v = b[i];
    mid.push(u != null && v != null ? (u + v) / 2 : null);
    diff.push(u != null && v != null ? u - v : null);
  }
  return [mid, diff];
}

export const SIZE_KEY: Record<SizeBy, Key> = { pc: 'pc', exports: 'xu', assets: 'fa', gdp: 'gdp' };
export const TOP_KEY: Record<TopMetric, Key> = { exports: 'xu', gdp: 'gdp', assets: 'fa' };

// ---------------------------------------------------------------- filters
export function filterActive(s: ViewState): boolean {
  return s.countries.length > 0 || s.regions.length > 0 || s.group != null || s.borrower != null || s.top != null || s.sizeRange != null;
}

/** Which economies pass the filters at period index k. */
export function passing(s: ViewState, f: Frame, k: number, codes: string[], groups: Record<string, EarnGroup> | undefined): Set<string> {
  let out = codes.slice();
  if (s.countries.length) out = out.filter((c) => s.countries.includes(c));
  if (s.regions.length && groups) out = out.filter((c) => { const g = groups[c]; return !!g && s.regions.some((r) => (r === 'euro' ? g.euro : g.region === r)); });
  if (s.group && groups) out = out.filter((c) => groups[c] && (s.group === 'adv') === groups[c].advanced);
  if (s.borrower && groups) out = out.filter((c) => groups[c] && (s.borrower === 'yes') === groups[c].borrower);
  if (s.top) {
    const key = TOP_KEY[s.top.m];
    const ranked = codes.map((c) => [c, f.series(c, key)[k]] as const).filter((x): x is readonly [string, number] => x[1] != null).sort((a, b) => b[1] - a[1]).slice(0, s.top.n).map((x) => x[0]);
    out = out.filter((c) => ranked.includes(c));
  }
  if (s.sizeRange) {
    const key = SIZE_KEY[s.size];
    out = out.filter((c) => { const v = f.series(c, key)[k]; return v != null && v >= s.sizeRange![0] && v <= s.sizeRange![1]; });
  }
  return new Set(out);
}

// ---------------------------------------------------------------- domains and ticks
export const XD: Dom = [-12, 32];
export const YD: Dom = [-11, 8];
const TD: Dom = [0, 120];
const FD_LIN: Dom = [0, 700];
const FD_LOG: Dom = [10, 1000];

export interface Axes { x: Scale; y: Scale; same: boolean }
export function axesOf(lens: Lens, view: View, log: boolean, unit: Unit = 'pct'): Axes {
  if (unit === 'usd') {
    if (isNet(lens)) return { x: 'sym', y: 'sym', same: false };
    return view === 'diag' ? { x: 'log', y: 'log', same: true } : { x: 'log', y: 'sym', same: false };
  }
  if (lens === 'finance') return { x: log ? 'log' : 'lin', y: view === 'diag' && log ? 'log' : 'lin', same: view === 'diag' };
  return { x: 'lin', y: 'lin', same: lens === 'trade' && view === 'diag' };
}
/** The symmetric log's linear core, USD bn: |v| up to about 1 bn is drawn nearly linearly, beyond it as log10. */
export const SYM_C = 1;
export const tf = (v: number, sc: Scale) => (sc === 'log' ? Math.log10(Math.max(v, 1e-6)) : sc === 'sym' ? Math.sign(v) * Math.log10(1 + Math.abs(v) / SYM_C) : v);
export const itf = (v: number, sc: Scale) => (sc === 'log' ? 10 ** v : sc === 'sym' ? Math.sign(v) * SYM_C * (10 ** Math.abs(v) - 1) : v);

function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count);
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
}
function niceDom(lo: number, hi: number, log: boolean): Dom {
  if (log) return [niceLog(Math.max(lo, 1e-6), false), niceLog(hi, true)];
  const st = niceStep(hi - lo || 1, 6);
  return [Math.floor(lo / st) * st, Math.ceil(hi / st) * st];
}
function niceLog(v: number, up: boolean): number {
  const e = Math.floor(Math.log10(v)), b = 10 ** e;
  const steps = [1, 2, 3, 5, 10];
  const m = v / b;
  const pick = up ? steps.find((s) => s >= m - 1e-9) ?? 10 : [...steps].reverse().find((s) => s <= m + 1e-9) ?? 1;
  return pick * b;
}

/** A dollar axis's extent: log axes from the nice power below the smallest value to the one above the largest; symmetric
 * axes out to the next 1-2-5 step past the largest magnitude on each side (at least ±10 bn), so zero is always inside. */
function usdDom(vals: number[], sc: Scale): Dom {
  if (sc === 'log') { const pos = vals.filter((v) => v > 0); return pos.length ? [niceLog(Math.min(...pos), false), niceLog(Math.max(...pos), true)] : [1, 1000]; }
  const lo = Math.min(...vals, -10), hi = Math.max(...vals, 10);
  return [-niceLog(-lo, true), niceLog(hi, true)];
}

/** The full extent of a lens: the fixed domains of the original chart where they exist, else every period's data. */
export function fullDomain(lens: Lens, view: View, log: boolean, all: { x: number; y: number }[], unit: Unit = 'pct'): Win {
  if (unit === 'usd') {
    const ax = axesOf(lens, view, log, unit);
    const x = usdDom(all.map((p) => p.x), ax.x), y = usdDom(all.map((p) => p.y), ax.y);
    if (!ax.same) return { x, y };
    const d: Dom = [Math.min(x[0], y[0]), Math.max(x[1], y[1])];
    return { x: d, y: d };
  }
  if (isNet(lens)) return { x: XD, y: YD };
  if (view === 'diag') { const d = lens === 'trade' ? TD : log ? FD_LOG : FD_LIN; return { x: d, y: d }; }
  const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
  const xd: Dom = lens === 'trade' ? [0, niceDom(0, Math.max(...xs, 10), false)[1]] : log ? FD_LOG : FD_LIN;
  const yd = niceDom(Math.min(...ys, -5), Math.max(...ys, 5), false);
  return { x: xd, y: yd };
}

/** Fit a window around points (data units), padded by a share of the span and at least a minimum span. */
export function fitDomain(pts: { x: number; y: number }[], ax: Axes, fallback: Win): Win {
  if (!pts.length) return fallback;
  const fit = (vals: number[], sc: Scale, min: number): Dom => {
    const t = vals.map((v) => tf(v, sc));
    let lo = Math.min(...t), hi = Math.max(...t);
    const span = Math.max(hi - lo, sc === 'lin' ? min : 0.15);
    const pad = span * 0.15;
    const mid = (lo + hi) / 2;
    lo = Math.min(lo, mid - span / 2) - pad; hi = Math.max(hi, mid + span / 2) + pad;
    return [itf(lo, sc), itf(hi, sc)];
  };
  let x = fit(pts.map((p) => p.x), ax.x, 2), y = fit(pts.map((p) => p.y), ax.y, 2);
  if (ax.same) { const lo = Math.min(x[0], y[0]), hi = Math.max(x[1], y[1]); x = [lo, hi]; y = [lo, hi]; }
  return { x, y };
}

export function linTicks(d: Dom, count: number): number[] {
  const st = niceStep(d[1] - d[0], count);
  const out: number[] = [];
  for (let v = Math.ceil(d[0] / st - 1e-9) * st; v <= d[1] + st * 1e-9; v += st) out.push(Number(v.toPrecision(12)));
  return out;
}
export function logTicks(d: Dom): number[] {
  const out: number[] = [];
  if (!(d[0] > 0) || !(d[1] > d[0]) || !Number.isFinite(d[1])) return out;   // a window from another scale, for one frame
  const e0 = Math.floor(Math.log10(d[0])), e1 = Math.ceil(Math.log10(d[1]));
  const span = Math.log10(d[1] / d[0]);
  const mults = span > 2.2 ? [1, 3] : span > 1 ? [1, 2, 5] : [1, 1.5, 2, 3, 5, 7];
  for (let e = e0; e <= e1; e++) for (const m of mults) { const v = m * 10 ** e; if (v >= d[0] * 0.999 && v <= d[1] * 1.001) out.push(Number(v.toPrecision(6))); }
  return out;
}

/** Symmetric-log ticks: zero and ±1-2-5 × powers of ten inside the window, thinned to about `count` per side. */
export function symTicks(d: Dom, count: number): number[] {
  if (!(d[1] > d[0]) || !Number.isFinite(d[0]) || !Number.isFinite(d[1])) return [];
  const mags = (lo: number, hi: number): number[] => {
    if (hi <= 0 || hi < lo) return [];
    const out: number[] = [];
    const e0 = Math.floor(Math.log10(Math.max(lo, 0.1))), e1 = Math.ceil(Math.log10(hi));
    const span = Math.log10(hi / Math.max(lo, 0.1));
    const mults = span > 2.2 ? [1] : span > 1 ? [1, 3] : [1, 2, 5];
    for (let e = e0; e <= e1; e++) for (const m of mults) { const v = m * 10 ** e; if (v >= lo * 0.999 && v <= hi * 1.001) out.push(Number(v.toPrecision(6))); }
    const step = Math.max(1, Math.ceil(out.length / Math.max(1, count)));
    return out.filter((_, i) => (out.length - 1 - i) % step === 0);
  };
  const pos = mags(Math.max(d[0], 0) || 1, d[1]);
  const neg = mags(Math.max(-d[1], 0) || 1, -d[0]).map((v) => -v);
  const out = [...neg.reverse(), ...(d[0] <= 0 && d[1] >= 0 ? [0] : []), ...pos];
  return out.filter((v) => v >= d[0] - 1e-9 && v <= d[1] + 1e-9);
}
export function scaleTicks(d: Dom, sc: Scale, count: number): number[] {
  return sc === 'log' ? logTicks(d) : sc === 'sym' ? symTicks(d, Math.max(2, Math.round(count / 2))) : linTicks(d, count);
}

export function sameWin(a: Win | null, b: Win | null): boolean {
  if (!a || !b) return a === b;
  return a.x[0] === b.x[0] && a.x[1] === b.x[1] && a.y[0] === b.y[0] && a.y[1] === b.y[1];
}

// ---------------------------------------------------------------- labels
export interface LabelIn { c: string; text: string; px: number; py: number; r: number; prio: number }
export interface LabelOut { c: string; text: string; x: number; y: number; anchor: 'start' | 'end' | 'middle'; leader: [number, number, number, number] | null }

let ctx: CanvasRenderingContext2D | null = null;
export function textWidth(s: string, px = 11): number {
  if (typeof document !== 'undefined') {
    ctx = ctx ?? document.createElement('canvas').getContext('2d');
    if (ctx) { ctx.font = `500 ${px}px "IBM Plex Sans KR", sans-serif`; return ctx.measureText(s).width; }
  }
  return [...s].reduce((w, ch) => w + (/[ㄱ-힝]/.test(ch) ? px : px * 0.58), 0);
}

/** Greedy placement: highest priority first; eight directions around the bubble, then further out with a leader line;
 * a slot must clear every placed label, every other bubble and the plot edge. */
export function placeLabels(items: LabelIn[], box: { x0: number; y0: number; x1: number; y1: number }, px = 11, obstacles?: { x: number; y: number; r: number }[]): LabelOut[] {
  const h = px + 2;
  const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const out: LabelOut[] = [];
  const circles = obstacles ?? items.map((i) => ({ x: i.px, y: i.py, r: i.r }));
  const ov = (a: { x0: number; y0: number; x1: number; y1: number }, b: { x0: number; y0: number; x1: number; y1: number }) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const hitC = (r: { x0: number; y0: number; x1: number; y1: number }, self: LabelIn) => circles.reduce((s, c) => {
    if (c.x === self.px && c.y === self.py) return s;
    const nx = Math.max(r.x0, Math.min(c.x, r.x1)), ny = Math.max(r.y0, Math.min(c.y, r.y1));
    const d = Math.hypot(nx - c.x, ny - c.y);
    return s + (d < c.r ? (c.r - d) * 4 + 1 : 0);
  }, 0);
  const order = items.map((it) => ({ it })).sort((a, b) => b.it.prio - a.it.prio);
  const dirs: [number, number][] = [[1, 0], [-1, 0], [0.75, -0.75], [0.75, 0.75], [-0.75, -0.75], [-0.75, 0.75], [0, -1], [0, 1]];
  for (const { it } of order) {
    const w = textWidth(it.text, px) + 2;
    let best: { score: number; rect: { x0: number; y0: number; x1: number; y1: number }; tx: number; ty: number; anchor: 'start' | 'end' | 'middle'; lead: boolean; ax: number; ay: number } | null = null;
    for (const gap of [3, 12, 24, 40]) {
      for (const [dx, dy] of dirs) {
        const ax = it.px + dx * (it.r + gap), ay = it.py + dy * (it.r + gap);
        const anchor: 'start' | 'end' | 'middle' = dx > 0.1 ? 'start' : dx < -0.1 ? 'end' : 'middle';
        const x0 = anchor === 'start' ? ax : anchor === 'end' ? ax - w : ax - w / 2;
        const yc = dy < -0.1 ? ay - h / 2 : dy > 0.1 ? ay + h / 2 : ay;
        const rect = { x0, y0: yc - h / 2, x1: x0 + w, y1: yc + h / 2 };
        const out_ = rect.x0 < box.x0 || rect.x1 > box.x1 || rect.y0 < box.y0 || rect.y1 > box.y1 ? 1e6 : 0;
        const score = out_ + placed.reduce((s, p) => s + ov(rect, p), 0) * 10 + hitC(rect, it) + gap * 0.5;
        if (!best || score < best.score) best = { score, rect, tx: anchor === 'start' ? x0 + 1 : anchor === 'end' ? x0 + w - 1 : ax, ty: yc + px * 0.36, anchor, lead: gap > 3, ax, ay };
      }
      if (best && best.score < gap * 0.5 + 0.5) break;
    }
    if (!best) continue;
    placed.push(best.rect);
    const ex = it.px + (best.ax - it.px) * (it.r / (Math.hypot(best.ax - it.px, best.ay - it.py) || 1));
    const ey = it.py + (best.ay - it.py) * (it.r / (Math.hypot(best.ax - it.px, best.ay - it.py) || 1));
    out.push({ c: it.c, text: it.text, x: best.tx, y: best.ty, anchor: best.anchor, leader: best.lead ? [ex, ey, best.ax, best.ay] : null });
  }
  return out;
}
