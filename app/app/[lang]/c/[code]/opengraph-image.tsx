// The country card: the economy's name, its vulnerability score and 12-month exports at their own periods
// Built from the same country file as the sheet.
import { readBoard, readCountry, readMeta } from '@/lib/data';
import { amt, month, num, quarter, unit } from '@/lib/format';
import { isLang } from '@/lib/i18n';
import { ogCard, OG_SIZE, OG_TYPE } from '@/lib/og';
import type { Lang } from '@/lib/types';

export const alt = 'global-network: one economy, funding and trade';
export const size = OG_SIZE;
export const contentType = OG_TYPE;

const last = <T,>(a: (T | null)[] | undefined): T | null => { if (!a) return null; for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return a[i]; return null; };

export default async function Image({ params }: { params: Promise<{ lang: string; code: string }> }) {
  const { lang: raw, code } = await params;
  const lang: Lang = isLang(raw) ? raw : 'en';
  const X = code.toUpperCase();
  let title = X, period: string | undefined;
  const facts: { label: string; value: string; tone: 'money' | 'trade' }[] = [];
  try {
    const m = readMeta();
    const c = readCountry(X);
    if (c) {
      title = c[lang];
      const b = readBoard()[X];
      const v = last(b?.v);
      if (v != null) facts.push({ label: lang === 'ko' ? `취약성 V · ${quarter(m.money.quarter, lang)}` : `Vulnerability V · ${quarter(m.money.quarter, lang)}`, value: num(v, lang, 0), tone: 'money' });
      if (c.trade.now.x_bn != null) facts.push({ label: lang === 'ko' ? `수출, 12개월 · ${month(c.trade.now.t, lang)}까지` : `Exports, 12 months to ${month(c.trade.now.t, lang)}`, value: lang === 'ko' ? `${amt(c.trade.now.x_bn, lang)}${unit(lang)}` : `${amt(c.trade.now.x_bn, lang)} ${unit(lang)}`, tone: 'trade' });
      period = `${quarter(m.money.quarter, lang)} · ${month(c.trade.now.t, lang)}`;
    }
  } catch { /* the card still names the economy */ }
  return ogCard({ lang, kicker: lang === 'ko' ? '국가 시트' : 'country sheet', title, sub: lang === 'ko' ? '자금 유입 경로와 상품 수출 경로' : 'Where its funding comes from and where its goods go', period, facts });
}
