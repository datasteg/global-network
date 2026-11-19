// Overview strings (EN, KO 해라체). Since the refurbish of 2 Nov 2026 the page keeps the hero, the replay buttons, one
// headline sentence, the "This build" strip, "Economies to watch", "What changed" and the digest card; the Signal
// Board itself lives on money-flow and is linked, not copied.
import type { Lang } from '../types';

const S = {
  en: {
    kicker: 'Overview',
    headline: (n_out: number, n: number, q: string, top: string, bn: string, win: string, tn: string, mom: string) =>
      `In ${q}, funding left ${n_out} of ${n} [[borrowing|borrowing economies]], the largest [[withdrawal|withdrawal]] from ${top} (${bn}); world goods trade in the [[window12|12 months]] to ${win} was ${tn}, ${mom} on the 3 months a year earlier ([[world_mom|momentum]]).`,
    strip: {
      title: 'This build',
      tiles: { dollar: 'Dollar index', dollarSub: '4-week change', swap: 'Fed swap lines', custody: 'Official Treasuries at the Fed', tic: 'Net official purchases of US securities', ticSub: 'latest month' },
      line: (day: string, release: string) => `Pulse to ${day}, as money-flow release ${release} publishes it (53 Wednesdays; the dollar index is Jan 2006 = 100).`,
      open: 'The World page on money-flow',
    },
    watch: {
      title: 'Economies to watch',
      lede: 'The top five of the [[stress_count|stress signals]] board this quarter: most signals at threshold first, then the highest [[v|vulnerability score]]. With the direction of funding and the latest 12-month export change.',
      cols: { eco: 'Economy', n: 'Signals', v: 'V', f: 'F', mom: 'Exports y/y', open: 'On money-flow' }, board: 'The stress signals board',
      inMoney: 'money-flow →', atRisk: 'at risk',
    },
    changes: 'What changed', changesLede: 'Joint moves first (funding and trade in the same economy or chain), then the parents’ own threshold crossings. No model behind any of them.',
    allChanges: 'All changes',
    digest: 'Digest at this build', digestOpen: 'Read the digest',
    more: 'More:', sheet: 'Open the country sheet', korea: 'Korea first',
  },
  ko: {
    kicker: '개요',
    headline: (n_out: number, n: number, q: string, top: string, bn: string, win: string, tn: string, mom: string) =>
      `${q}에 [[borrowing|차입 경제]] ${n}개 가운데 ${n_out}개 경제에서 자금이 유출됐습니다. [[withdrawal|유출 규모가 가장 큰]] 경제는 ${top}(${bn})입니다. ${win}까지 [[window12|12개월]]의 세계 상품 교역은 ${tn}였습니다. 최근 3개월은 1년 전 같은 기간보다 ${mom}였습니다([[world_mom|모멘텀]]).`,
    strip: {
      title: '이번 빌드',
      tiles: { dollar: '달러 지수', dollarSub: '4주 변화', swap: '연준 통화스왑', custody: '연준 보관 외국 공공 미 국채', tic: '외국 공공기관의 미국 증권 순매수', ticSub: '최근 월' },
      line: (day: string, release: string) => `맥박은 ${day}까지입니다. 값은 money-flow 릴리스 ${release}가 공표한 값 그대로입니다(수요일 53개, 달러 지수는 2006년 1월=100).`,
      open: 'money-flow의 세계 페이지',
    },
    watch: {
      title: '지켜볼 경제',
      lede: '이번 분기 [[stress_count|스트레스 신호]]가 많은 상위 다섯 경제입니다. 기준에 도달한 신호가 많은 순으로 정렬했고, 같으면 [[v|취약성 점수]]가 높은 경제를 앞에 두었습니다. 자금 흐름의 방향과 최근 12개월 수출 변화도 함께 적었습니다.',
      cols: { eco: '경제', n: '신호 수', v: 'V', f: 'F', mom: '수출 전년비', open: 'money-flow에서' }, board: '스트레스 신호판',
      inMoney: 'money-flow →', atRisk: '위험',
    },
    changes: '무엇이 바뀌었나', changesLede: '자금과 교역이 같은 경제나 공급망에서 함께 움직인 경우를 먼저 적었습니다. 그다음 두 원천 사이트가 공표한 기준치 통과 여부를 적었습니다. 이 기록에는 모형을 쓰지 않았습니다.',
    allChanges: '모든 변화',
    digest: '이번 빌드의 요약', digestOpen: '요약 읽기',
    more: '더 보기:', sheet: '국가 시트 열기', korea: '한국부터',
  },
};
export type HomeStrings = typeof S.en;
export const home = (lang: Lang): HomeStrings => (lang === 'ko' ? (S.ko as unknown as HomeStrings) : S.en);
