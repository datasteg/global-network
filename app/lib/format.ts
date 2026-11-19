// Number and date formatting, EN and KO. Amounts are stored in USD bn; Korean pages write 억 달러 (1 bn = 10억).
import type { Lang } from './types';

const locale = (l: Lang) => (l === 'ko' ? 'ko-KR' : 'en-GB');
const minus = (s: string) => s.replace(/-/g, '−');

export function num(v: number | null | undefined, lang: Lang, decimals = 1, signed = false): string {
  if (v == null || Number.isNaN(v)) return '–';
  const s = new Intl.NumberFormat(locale(lang), { minimumFractionDigits: decimals, maximumFractionDigits: decimals, signDisplay: signed ? 'exceptZero' : 'auto' }).format(v);
  return minus(s);
}
/** An amount in USD bn: "1,020.7 bn" or "10,207억 달러". */
export function bn(v: number | null | undefined, lang: Lang, signed = false): string {
  if (v == null) return '–';
  return lang === 'ko' ? `${num(v * 10, lang, 0, signed)}억 달러` : `${num(v, lang, Math.abs(v) >= 100 ? 0 : 1, signed)} bn`;
}
/** A short amount for tiles: "1,021" with the unit beside it, or "10,207" (억 달러). */
export function amt(v: number | null | undefined, lang: Lang, signed = false): string {
  if (v == null) return '–';
  return lang === 'ko' ? num(v * 10, lang, 0, signed) : num(v, lang, Math.abs(v) >= 100 ? 0 : 1, signed);
}
export const unit = (lang: Lang) => (lang === 'ko' ? '억 달러' : 'USD bn');
/** Trillions for headlines: "22.1 tn" or "22.1조 달러". */
export function tn(v: number | null | undefined, lang: Lang): string {
  if (v == null) return '–';
  return lang === 'ko' ? `${num(v / 1000, lang, 1)}조 달러` : `${num(v / 1000, lang, 1)} tn`;
}
export function pct(v: number | null | undefined, lang: Lang, decimals = 1, signed = false): string {
  if (v == null) return '–';
  return `${num(v, lang, decimals, signed)}%`;
}
export function pp(v: number | null | undefined, lang: Lang, decimals = 1): string {
  if (v == null) return '–';
  return lang === 'ko' ? `${num(v, lang, decimals, true)}%p` : `${num(v, lang, decimals, true)} pp`;
}
/** A quarter end "2026-06-30" → "Q2 2026" / "2026년 2분기". */
export function quarter(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '–';
  const [y, m] = iso.split('-').map(Number);
  const q = Math.ceil(m / 3);
  return lang === 'ko' ? `${y}년 ${q}분기` : `Q${q} ${y}`;
}
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** A month 202607 → "Jul 2026" / "2026년 7월". */
export function month(t: number | null | undefined, lang: Lang): string {
  if (!t) return '–';
  const y = Math.floor(t / 100), m = t % 100;
  return lang === 'ko' ? `${y}년 ${m}월` : `${MONTHS_EN[m - 1]} ${y}`;
}
/** The 12 months ending in t: "Aug 2025–Jul 2026" / "2025년 8월~2026년 7월". */
export function window12(t: number | null | undefined, lang: Lang): string {
  if (!t) return '–';
  let y = Math.floor(t / 100), m = t % 100 - 11;
  if (m <= 0) { m += 12; y -= 1; }
  const a = y * 100 + m;
  return lang === 'ko' ? `${month(a, lang)}~${month(t, lang)}` : `${month(a, lang)}–${month(t, lang)}`;
}
/** A day "2026-10-28" → "28 Oct 2026" / "2026년 10월 28일". */
export function day(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '–';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return lang === 'ko' ? `${y}년 ${m}월 ${d}일` : `${d} ${MONTHS_EN[m - 1]} ${y}`;
}
export function year(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 4) : '–';
}
export function ratio(v: number | null | undefined, lang: Lang): string {
  if (v == null) return '–';
  return `${num(v, lang, v >= 10 ? 0 : 1)}×`;
}

import { josa as qkrJosa } from './josa';
/** Korean particle after a word. Takes the app's pair forms (과와, 은는, 이가, 을를, 으로로) or the single
 *  particles qkr writes ({x|이} → josa(x, '이')); the sound rules live in ./josa (copied from qkr). */
const PAIR_FORMS: Record<string, string> = { 과와: '과', 은는: '은', 이가: '이', 을를: '을', 으로로: '으로' };
export function josa(word: string | number, particle: string): string {
  return qkrJosa(word, PAIR_FORMS[particle] ?? particle);
}
