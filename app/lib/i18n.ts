// Shared UI strings, English and Korean (Korean: 해라체 in text, 합니다체 in UI messages; guides/voice-ko.md). Page strings
// live beside their pages in lib/strings/.
import type { Lang } from './types';

export const LANGS: Lang[] = ['en', 'ko'];
export const isLang = (x: string): x is Lang => x === 'en' || x === 'ko';
export const other = (l: Lang): Lang => (l === 'ko' ? 'en' : 'ko');

const S = {
  en: {
    siteName: 'global-network',
    tagline: 'Funding and trade on one screen',
    description: 'For each economy, where its funding comes from and where its goods go, on one screen: BIS, IMF and UN Comtrade statistics joined on the economy, with early-warning signals validated against past stress and first-round scenarios. Every number carries its own period and source.',
    skip: 'Skip to content',
    nav: { overview: 'Overview', stress: 'Stress signals', economies: 'Economies', shocks: 'Shocks', about: 'About', menu: 'Menu', close: 'Close menu', home: 'Overview', countries: 'Economies', pairs: 'Pairs', changes: 'What changed', scenarios: 'Scenarios', dollar: 'Dollar channel', method: 'Method', sources: 'Sources', digest: 'Digest' },
    night: 'Switch to Night', dayTheme: 'Switch to Day',
    money: 'Funding', trade: 'Trade',
    source: 'Source: ', calc: 'Calculations: datasteg global-network',
    asOf: 'as of', period: 'Period', feed: 'RSS feed',
    footerNote: 'Built from money-flow.datasteg.com and trade-flow.datasteg.com. Money data from BIS, IMF, the Federal Reserve and US Treasury TIC; trade data from UN Comtrade and the Korea Customs Service. No commercial data in any form.',
    sources: { bis: 'BIS', imf: 'IMF', fred: 'Federal Reserve (FRED)', tic: 'US Treasury TIC', comtrade: 'UN Comtrade', kcs: 'Korea Customs Service' },
    est: { 0: 'reported', 1: 'benchmarked', 2: 'spliced', 3: 'partner-only', 4: 'interpolated' } as Record<number, string>,
    estNote: '[[partner|Partner-reported or estimated]] where the importer has not filed.',
    divergence: 'the two reports of this flow diverge from their usual ratio ([[mirror|mirror divergence]])',
    notScored: 'shown, not scored',
    none: 'none',
    more: 'More',
    back: 'Back',
  },
  ko: {
    siteName: 'global-network',
    tagline: '자금과 교역을 한 화면에',
    description: '경제마다 자금이 어디서 유입되고 상품이 어디로 수출되는지 한 화면에 나타냅니다. BIS, IMF, UN Comtrade 통계를 경제 단위로 이었습니다. 과거 위기로 검증한 조기경보 신호와 1차 효과 시나리오도 더했습니다. 수치마다 기준 시점과 출처를 밝힙니다.',
    skip: '본문 바로가기',
    nav: { overview: '개요', stress: '스트레스 신호', economies: '경제', shocks: '충격', about: '소개', menu: '메뉴', close: '메뉴 닫기', home: '개요', countries: '경제', pairs: '양자 관계', changes: '무엇이 바뀌었나', scenarios: '시나리오', dollar: '달러 경로', method: '방법론', sources: '출처', digest: '요약' },
    night: '야간 모드로', dayTheme: '주간 모드로',
    money: '자금', trade: '교역',
    source: '자료: ', calc: '계산: datasteg global-network',
    asOf: '기준', period: '기준 시점', feed: 'RSS 피드',
    footerNote: 'money-flow.datasteg.com과 trade-flow.datasteg.com의 자료로 만들었습니다. 자금 자료는 BIS, IMF, 미국 연준, 미 재무부 TIC에서, 교역 자료는 UN Comtrade와 관세청에서 왔습니다. 상업 자료는 어떤 형태로도 쓰지 않습니다.',
    sources: { bis: 'BIS', imf: 'IMF', fred: '미국 연준(FRED)', tic: '미 재무부 TIC', comtrade: 'UN Comtrade', kcs: '관세청' },
    est: { 0: '보고값', 1: '벤치마크 추정', 2: '접합 추정', 3: '상대국 보고', 4: '보간 추정' } as Record<number, string>,
    estNote: '수입국이 신고하지 않은 달은 [[partner|상대국 보고나 추정치]]로 채웠습니다.',
    divergence: '이 흐름의 두 보고가 평소 비율에서 벗어났습니다([[mirror|거울 괴리]])',
    notScored: '표시만, 점수 제외',
    none: '없음',
    more: '더 보기',
    back: '돌아가기',
  },
};

export type Strings = typeof S.en;
export const t = (lang: Lang): Strings => (lang === 'ko' ? (S.ko as unknown as Strings) : S.en);

/** An economy's short name in the page language. */
export function nameOf(code: string, lang: Lang, names: Record<string, { en: string; ko: string }>): string {
  const n = names[code];
  return n ? n[lang] : code;
}
