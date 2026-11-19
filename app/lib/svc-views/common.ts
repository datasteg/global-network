// Shared pieces of the /svc/v1 views (api/docs/SVC-CONTRACT.md): the envelope, the sources block from the page
// registry (lib/sources.ts), period helpers, the economy set and rounding. Every view reads the built data through
// lib/data.ts as the pages do and returns only what a page draws (page parity; rule G18: this site collects nothing).
import { readMeta } from '@/lib/data';
import { allNames } from '@/lib/names';
import { SOURCES, SERIES, VIA, type SrcId } from '@/lib/sources';
import { SvcFail, badParam } from '@/lib/svc';
import type { Lang, Meta } from '@/lib/types';

export const APP = 'global-network';
export const SURFACE = '1.0';
export const VIEWS = ['country', 'pair', 'shocks', 'shock', 'stress'] as const;

/** The tag /health reports as `version` (the image tag; the data travel inside the image). */
export const release = () => process.env.APP_VERSION ?? 'dev';

/** 202607 → "2026-07". */
export const ym = (t: number | null | undefined): string | null => (t ? `${Math.floor(t / 100)}-${String(t % 100).padStart(2, '0')}` : null);
/** The 12-month window ending in t, as months. */
export function window12m(t: number): { from: string; to: string } {
  let y = Math.floor(t / 100), m = (t % 100) - 11;
  if (m <= 0) { m += 12; y -= 1; }
  return { from: ym(y * 100 + m)!, to: ym(t)! };
}
/** "2026-06-30" → "2026-Q2". */
export const qid = (iso: string | null | undefined): string | null => (iso ? `${iso.slice(0, 4)}-Q${Math.ceil(Number(iso.slice(5, 7)) / 3)}` : null);
/** "2026-Q2" or "2026-06-30" → the stored quarter end, or null. */
export function qend(s: string): string | null {
  const m = /^(\d{4})-Q([1-4])$/.exec(s);
  if (m) return `${m[1]}-${['03-31', '06-30', '09-30', '12-31'][Number(m[2]) - 1]}`;
  return /^\d{4}-(03-31|06-30|09-30|12-31)$/.test(s) ? s : null;
}

export const round = (v: number | null | undefined, d = 1): number | null => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
export const lastIdx = <T,>(a: (T | null)[] | undefined): number => { if (!a) return -1; for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return i; return -1; };

/** The 37 economies with a sheet: the 36 board economies and the hub. */
export function sheetCodes(meta: Meta = readMeta()): string[] {
  return [...meta.economies.map((e) => e.code), meta.hub];
}
export const nameOf = (code: string, lang: Lang): string => allNames()[code]?.[lang] ?? code;
export const nameEn = (code: string): string => allNames()[code]?.en ?? code;

/** An economy code: three letters (any case), one of the sheets. Unknown or malformed in a path: 404 unknown-economy
 *  (the contract's KORR example); malformed in a query: 400. Either way the detail says how to fix the call. */
export function economyParam(raw: string | null | undefined, what = 'economy', inPath = false): string {
  const code = String(raw ?? '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code) && !inPath) throw badParam(`${what} must be an ISO 3166-1 alpha-3 code such as KOR; got "${String(raw ?? '').slice(0, 20)}". GET /v1/global-network/economies lists the 37 codes.`);
  if (!sheetCodes().includes(code)) throw new SvcFail(404, 'unknown-economy', 'Unknown economy code', `${code.slice(0, 20)} is not an economy global-network has a sheet for. It covers the 36 money-flow board economies and the United States; use an ISO 3166-1 alpha-3 code such as KOR. GET /v1/global-network/economies lists them.`);
  return code;
}
export function enumParam<T extends string>(sp: URLSearchParams, key: string, values: readonly T[], dflt: T): T {
  const v = sp.get(key);
  if (v == null || v === '') return dflt;
  if (!(values as readonly string[]).includes(v)) throw badParam(`${key} must be one of ${values.join(', ')}; got "${v.slice(0, 20)}".`);
  return v as T;
}
export function intParam(sp: URLSearchParams, key: string, min: number, max: number, dflt: number): number {
  const v = sp.get(key);
  if (v == null || v === '') return dflt;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw badParam(`${key} must be an integer from ${min} to ${max}; got "${v.slice(0, 20)}".`);
  return n;
}
export function boolParam(sp: URLSearchParams, key: string): boolean {
  const v = sp.get(key);
  if (v == null || v === '' || v === 'false' || v === '0') return false;
  if (v === 'true' || v === '1') return true;
  throw badParam(`${key} must be true or false; got "${v.slice(0, 20)}".`);
}

/** One source of an answer, from the registry the pages' source lines use. */
/** `via`: the datasteg pipeline the dataset reaches this site through (its method page names every series). */
export interface SvcSource { publisher: string; dataset: string; vintage: string | null; licence: string; url: string; via: string | null; series?: string[]; period?: string }
export interface Cite { src: SrcId; series?: string[]; period?: string }

export function sources(cites: Cite[], meta: Meta = readMeta()): SvcSource[] {
  const seen = new Map<string, SvcSource>();
  for (const c of cites) {
    const d = SOURCES[c.src];
    // trade-flow's build date: meta.trade.built, UTC like every build date here (slicing the KST surface
    // string gave the next day)
    const vintage = d.vintage ? meta.money.vintages[d.vintage] ?? null : d.via === 'trade' ? meta.trade.built.slice(0, 10) : null;
    const key = `${c.src}|${c.period ?? ''}`;
    if (seen.has(key)) continue;
    seen.set(key, {
      publisher: d.publisher.en, dataset: d.name.en, vintage, licence: d.licence.en, url: d.url,
      via: d.via ? VIA[d.via].name : null,
      ...(c.series ? { series: c.series.map((s) => (SERIES[s] ? `${s} (${SERIES[s].name.en})` : s)) } : {}),
      ...(c.period ? { period: c.period } : {}),
    });
  }
  return [...seen.values()];
}
export const BOARD_SRC: SrcId[] = ['bis.lbs', 'bis.cbs', 'bis.dss', 'imf.irfcl', 'imf.iip', 'imf.bop', 'bis.tc'];

/** The parents' export surfaces this build read (meta.surfaces = data/surface.json), for `notes`. All times UTC. */
export function surfaceNote(meta: Meta = readMeta()): string {
  const m = meta.surfaces.money, t = meta.surfaces.trade;
  return `Built ${meta.built} (UTC) from money-flow release ${m.release} (method ${m.method}, surface ${m.surface}) and trade-flow build ${meta.trade.built} (shown month ${ym(t.shown)}, surface ${t.surface}); global-network collects no data of its own (rule G18).`;
}
/** The vintages of what the build read beside the surfaces: money-flow's tables by hash, the products file's
 *  trade-flow build, and where net reserves came from. */
export function vintageNote(meta: Meta = readMeta()): string | null {
  const r = meta.read;
  if (!r) return null;
  const tabs = Object.entries(r.tables).map(([k, v]) => `${k} sha256 ${v.sha256.slice(0, 12)} (written ${v.modified ?? 'n/a'})`).join(', ');
  return `money-flow tables read: ${tabs}; HS-chapter products from trade-flow build ${r.products.trade_flow_built ?? 'n/a'}; net reserves ${r.res_net_raw === 'money-flow' ? 'from money-flow’s res_net_raw' : 'derived here as IRFCL Section I plus Section II drains (money-flow’s res_net_raw not yet in its release)'}.`;
}

// ---------------------------------------------------------------- basis: what each number is (SVC-CONTRACT 1.1)
/** A numeric field's declaration: its measure (an id of the measures registry, family/measures.json; an app-local id
 *  "<app>:<id>" for a quantity the registry does not list yet; null with `kind` for a count, rank, threshold or test
 *  statistic) and its period. A period value written "@key" names a sibling field of the same object that holds it. */
export interface Basis { measure: string | null; kind?: 'count' | 'rank' | 'threshold' | 'test' | 'share' | 'index'; period: Record<string, unknown>; unit?: string }
export type BasisMap = Record<string, Basis>;
/** {window_from, window_to} of the 12-month window ending in t. */
export const win = (t: number | null | undefined): { window_from: string | null; window_to: string | null } => {
  if (!t) return { window_from: null, window_to: null };
  const w = window12m(t);
  return { window_from: w.from, window_to: w.to };
};
/** t − 12 months on YYYYMM numbers (month arithmetic: the base of every growth figure). */
export const yearBefore = (t: number | null | undefined): number | null => (t ? (Math.floor(t / 100) - 1) * 100 + (t % 100) : null);

/** `period` is required and `basis` declares every numeric field of `data` (SVC-CONTRACT 1.1). */
export interface Envelope {
  app: string; view: string; release: string; built: string; page: string; sources: SvcSource[]; summary: string; data: unknown;
  period: Record<string, unknown>; basis: BasisMap;
  method?: string; notes?: string[]; table?: { columns: { id: string; label: string; unit?: string }[]; rows: (string | number | null)[][] };
}
/** The normalised path of every numeric field of data ([] for list items), as svc_check walks it. */
function numericPaths(v: unknown, path = '', out = new Set<string>()): Set<string> {
  if (typeof v === 'number') out.add(path);
  else if (Array.isArray(v)) for (const x of v) numericPaths(x, `${path}[]`, out);
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) numericPaths(x, path ? `${path}.${k}` : k, out);
  return out;
}
const patternOf = (p: string) => new RegExp(`^${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*\\\*/g, '.*').replace(/\\\*/g, '[^.\\[\\]]+')}$`);
/** basis without the declarations no number of this answer uses (a view declares every part; an answer carries one). */
function pruneBasis(basis: BasisMap, data: unknown): BasisMap {
  const paths = [...numericPaths(data)];
  return Object.fromEntries(Object.entries(basis).filter(([k]) => { const rx = patternOf(k); return paths.some((p) => rx.test(p)); }));
}

export function envelope(view: string, page: string, body: Omit<Envelope, 'app' | 'view' | 'release' | 'built' | 'page'>, meta: Meta = readMeta()): Envelope {
  const v = vintageNote(meta);
  return {
    app: APP, view, release: release(), built: meta.built,
    ...(body.method ? { method: body.method } : {}),
    period: body.period,
    page, sources: body.sources, summary: clip(body.summary), data: body.data,
    basis: pruneBasis(body.basis, body.data),
    ...(body.table ? { table: body.table } : {}),
    notes: [...(body.notes ?? []), surfaceNote(meta), ...(v ? [v] : [])],
  };
}

/** The summary at most 600 characters, cut at a sentence end when it runs over. */
export function clip(s: string, max = 600): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = cut.lastIndexOf('. ');
  return end > 200 ? cut.slice(0, end + 1) : `${cut.slice(0, max - 1)}…`;
}
/** English numbers for summaries: 1,020.7 / −2.7 (the pages' en-GB format with a true minus). */
export function n(v: number | null | undefined, d = 1, signed = false): string {
  if (v == null || !Number.isFinite(v)) return 'n/a';
  return new Intl.NumberFormat('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d, signDisplay: signed ? 'exceptZero' : 'auto' }).format(v).replace(/-/g, '−');
}
export const bnUsd = (v: number | null | undefined) => (v == null ? 'n/a' : `USD ${n(v, Math.abs(v) >= 100 ? 0 : 1)} bn`);
