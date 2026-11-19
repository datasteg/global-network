// The site card: tagline, one line of what the site joins, the newest quarter and shown month.
// One per language route; the fonts in lib/og.tsx cover Hangul, so the Korean card is in Korean.
import { readMeta } from '@/lib/data';
import { month, quarter } from '@/lib/format';
import { isLang, t } from '@/lib/i18n';
import { ogCard, OG_SIZE, OG_TYPE } from '@/lib/og';
import type { Lang } from '@/lib/types';

export const alt = 'global-network: funding and trade on one screen';
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang: Lang = isLang(raw) ? raw : 'en';
  const L = t(lang);
  let period: string | undefined;
  try { const m = readMeta(); period = `${quarter(m.money.quarter, lang)} · ${month(m.trade.shown, lang)}`; } catch { period = undefined; }
  const sub = lang === 'ko'
    ? '경제가 무엇으로 소득을 올리는지, 누가 누구에게 자금을 공급하고 누구와 교역하는지, 과거 충격이 둘에 어떤 영향을 미쳤는지 설명합니다. 자료는 BIS, IMF, UN Comtrade입니다.'
    : 'How economies earn, who funds whom against who trades with whom, and what past shocks did to both. BIS, IMF and UN Comtrade, every number at its own period.';
  return ogCard({ lang, kicker: lang === 'ko' ? '자금과 교역' : 'funding and trade', title: L.tagline, sub, period });
}
