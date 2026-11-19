// Citation sets the pages share, built from the build's meta so that every source line names the same periods.
import { day, month, quarter, window12 } from './format';
import type { CiteItem, SrcId } from './sources';
import type { Lang, Meta } from './types';

/** "Q1 2005 to Q2 2026, quarterly" / "2005년 1분기~2026년 2분기, 분기"; `to` defaults to the board's latest quarter. */
export function qRange(meta: Meta, lang: Lang, from = meta.money.quarters[0], to = meta.money.quarter): string {
  return lang === 'ko' ? `${quarter(from, lang)}~${quarter(to, lang)}, 분기` : `${quarter(from, lang)} to ${quarter(to, lang)}, quarterly`;
}
export function qOne(q: string | null | undefined, lang: Lang): string {
  return lang === 'ko' ? `${quarter(q, lang)}, 분기` : `${quarter(q, lang)}, quarterly`;
}
export function w12(t: number, lang: Lang): string {
  return lang === 'ko' ? `12개월 창, ${window12(t, lang)}` : `12-month window, ${window12(t, lang)}`;
}
export function weeks(meta: Meta, lang: Lang): string {
  return lang === 'ko' ? `${day(meta.money.pulse_day, lang)}까지, 주간` : `to ${day(meta.money.pulse_day, lang)}, weekly`;
}
export function monthTo(t: number, lang: Lang, freq = true): string {
  return lang === 'ko' ? `${month(t, lang)}까지${freq ? ', 월간' : ''}` : `to ${month(t, lang)}${freq ? ', monthly' : ''}`;
}

/** The funding side as the board reads it: each named dataset at the given period. */
export function money(ids: SrcId[], period: string): CiteItem[] {
  return ids.map((src) => ({ src, period }));
}
export const BOARD: SrcId[] = ['bis.lbs', 'bis.cbs', 'bis.dss', 'imf.irfcl', 'imf.iip', 'imf.bop', 'bis.tc'];

export function comtrade(period: string): CiteItem {
  return { src: 'comtrade', period };
}
