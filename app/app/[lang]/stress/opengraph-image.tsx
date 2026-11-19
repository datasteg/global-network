// The stress signals card: how many board economies have three or more signals at threshold this quarter.
import { readStress } from '@/lib/data';
import { quarter } from '@/lib/format';
import { isLang } from '@/lib/i18n';
import { ogCard, OG_SIZE, OG_TYPE } from '@/lib/og';
import type { Lang } from '@/lib/types';

export const alt = 'global-network: stress signals from funding and trade together';
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang: Lang = isLang(raw) ? raw : 'en';
  let sub = '', period: string | undefined;
  try {
    const s = readStress();
    if (s) {
      const i = s.quarters.length - 1;
      const n = s.econs.filter((e) => ((s.grid[e].cnt[i] as number | null) ?? 0) >= s.K).length;
      period = quarter(s.latest, lang);
      sub = lang === 'ko'
        ? `36개 경제 가운데 ${n}개 경제에서 신호 ${s.K}개 이상이 기준치에 도달했습니다. 일곱 신호는 자금 수치와 교역 수치를 결합해 만들었습니다. 모두 과거 스트레스 사례로 검증했습니다.`
        : `${n} of 36 economies have ${s.K} or more signals at threshold. Seven signals, each a funding quantity against a trade quantity, tested against past stress.`;
    }
  } catch { /* the card without numbers */ }
  return ogCard({ lang, kicker: lang === 'ko' ? '스트레스 신호' : 'stress signals', title: lang === 'ko' ? '자금과 교역을 함께 읽는 스트레스 신호' : 'Stress signals from funding and trade', sub, period });
}
