// Stress signals in the browser: re-applies the thresholds, K and the on/off switches to the values scripts/stress.py
// published (it never recomputes a value). Every view lives in the URL: tab, e (economy), k, j1..j7 (thresholds),
// off (rules switched off), y (pinned quarter), bq (board quarter), sort, bg, br, bf, mode, top, set. Sliders and K
// rewrite the URL with history.replaceState (no reload); tab and economy changes are links (the server reads the
// economy's file).
import type { StressGrid, StressRule, StressRuleId } from '@/lib/types';

export const RULE_IDS: StressRuleId[] = ['j1', 'j2', 'j3', 'j4', 'j5', 'j6', 'j7'];
export const TABS = ['one', 'board', 'partners', 'shocks', 'method'] as const;
export type Tab = (typeof TABS)[number];

export interface Sel { k: number; thr: Record<StressRuleId, number | null>; off: Set<StressRuleId> }

type SP = { get(k: string): string | null };

export function readSel(sp: SP, rules: StressRule[], K: number, range: [number, number]): Sel {
  const kk = Number(sp.get('k'));
  const k = Number.isFinite(kk) && kk >= range[0] && kk <= range[1] ? Math.round(kk) : K;
  const thr = {} as Record<StressRuleId, number | null>;
  for (const r of rules) {
    const raw = sp.get(r.id);
    const v = raw == null || raw === '' ? NaN : Number(raw);
    thr[r.id] = r.threshold == null ? null : Number.isFinite(v) && r.slider ? Math.min(r.slider[1], Math.max(r.slider[0], v)) : r.threshold;
  }
  const off = new Set((sp.get('off') ?? '').split(',').filter((x): x is StressRuleId => (RULE_IDS as string[]).includes(x)));
  return { k, thr, off };
}

/** Does rule r fire at grid index i? null when the rule is not scored there. */
export function fires(r: StressRule, g: StressGrid, i: number, sel: Sel): boolean | null {
  const v = g[r.id]?.[i] as number | null | undefined;
  if (v == null) return null;
  if (r.id === 'j3') return !!g.j3f?.[i];
  const t = sel.thr[r.id];
  if (t == null) return null;
  return r.dir === 'low' ? v <= t : v >= t;
}

export function countAt(rules: StressRule[], g: StressGrid, i: number, sel: Sel): { n: number; scored: number; fired: StressRuleId[] } {
  let n = 0, scored = 0;
  const fired: StressRuleId[] = [];
  for (const r of rules) {
    if (sel.off.has(r.id)) continue;
    const f = fires(r, g, i, sel);
    if (f == null) continue;
    scored++;
    if (f) { n++; fired.push(r.id); }
  }
  return { n, scored, fired };
}

/** The URL query with some keys set (null removes); keys equal to their default are dropped. */
export function withParams(sp: SP & { toString(): string }, set: Record<string, string | number | null | undefined>): string {
  const p = new URLSearchParams(sp.toString());
  for (const [k, v] of Object.entries(set)) {
    if (v == null || v === '') p.delete(k);
    else p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function replaceQuery(q: string) {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', `${window.location.pathname}${q}${window.location.hash}`);
}

export function isChanged(sel: Sel, rules: StressRule[], K: number): boolean {
  return sel.k !== K || sel.off.size > 0 || rules.some((r) => r.threshold != null && sel.thr[r.id] !== r.threshold);
}

/** A value with the rule's own precision. */
export function fmtVal(r: StressRuleId, v: number | null | undefined, lang: 'en' | 'ko'): string {
  if (v == null) return '–';
  const d = r === 'j1' || r === 'j6' || r === 'j7' ? 1 : 0;
  return v.toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** 0-100 rank → one of five sequential steps (CSS .st-h0..4), null → none. */
export const heat = (l: number | null | undefined) => (l == null ? '' : `st-h${Math.min(4, Math.floor(l / 20))}`);

/** Each rule's glossary card id (lib/glossary.ts). */
export const GL: Record<StressRuleId, string> = { j1: 'import_cover', j2: 'fin_need', j3: 'double_hit', j4: 'partner_stress', j5: 'dual_dep', j6: 'dollar_ch', j7: 'commodity_buf' };
