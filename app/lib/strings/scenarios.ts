import type { Lang } from '../types';

const S = {
  en: {
    kicker: 'Scenarios',
    title: 'Two scenarios',
    lede: 'Each takes published series and does arithmetic on them, one round. No model sits behind any number here.',
    rule: 'The [[first_round|first-round]] rule: a past share or a chosen cut is applied to today’s published positions. Prices do not move, nobody reacts, nothing is rolled over or replaced. The result is the size of the first hit, not a forecast of what follows.',
    open: 'Open', pending: 'Once relation E2 is accepted',
    items: {
      replay: { id: 'S1', title: 'Bank and bond withdrawal replay', text: 'The share of bank and bond funding that left an economy in a past stress quarter, applied to its funding stock today, against its net reserves and a year of imports.', source: (method: string) => `Stock and quarter flows: BIS locational banking statistics and BIS international debt securities; net reserves: IMF IRFCL, all as money-flow method ${method} publishes them. Imports: UN Comtrade 12-month windows as trade-flow publishes them. Calculations: datasteg.` },
      dollar: { id: 'S3', title: 'The dollar scenario', text: 'A chosen dollar move carried through the tercile slopes of the dollar channel to each economy’s exports two quarters later. The dollar channel page shows the relation and its intervals; the scenario opens when relation E2 is accepted on the method page. Until then the page is the channel itself.', source: (method: string) => `Federal Reserve H.10 broad dollar index via FRED (quarterly averages); UN Comtrade 12-month windows; A1 as money-flow method ${method}.` },
    },
    moved: 'Two scenarios moved to the parents on 2 November 2026: a supplier dropping out of a chain stage is trade-flow’s “Cut a supplier” case tool; a lender pulling back is money-flow’s “Cut a lender” panel on the bank market. The old addresses redirect there.',
    movedLinks: { supplier: 'Cut a supplier on trade-flow', lenders: 'Cut a lender on money-flow' },
  },
  ko: {
    kicker: '시나리오',
    title: '시나리오 둘',
    lede: '둘 다 공표된 통계에 산수를 한 번 적용한 값입니다. 어느 수치 뒤에도 모형은 없습니다.',
    rule: '[[first_round|1차 효과]] 규칙은 이렇습니다. 과거의 비율이나 고른 감축폭을 오늘의 공표 잔액에 곱합니다. 가격은 움직이지 않고, 아무도 대응하지 않으며, 만기 연장이나 대체도 없습니다. 결과는 첫 충격의 크기이지 그 뒤의 전망이 아닙니다.',
    open: '열기', pending: '관계 E2가 받아들여지면',
    items: {
      replay: { id: 'S1', title: '은행·채권 자금 회수 재생', text: '과거 위기 분기에 유출된 은행·채권 자금의 비율을 오늘의 자금 잔액에 곱하고, 순외환보유액 및 1년치 수입과 비교합니다.', source: (method: string) => '잔액과 분기 흐름은 국제결제은행(BIS) 지역별 국제은행통계와 BIS 국제채무증권 통계, 순외환보유액은 IMF IRFCL 자료입니다. 모두 money-flow 방법론 {method}로 공표한 수치입니다. 수입은 trade-flow가 공표한 UN Comtrade 12개월 창 자료입니다. 계산: datasteg.' },
      dollar: { id: 'S3', title: '달러 시나리오', text: '고른 달러 변동을 달러 경로의 3분위 기울기로 각 경제의 두 분기 뒤 수출에 반영합니다. 그 관계와 구간은 달러 경로 페이지에 있습니다. 시나리오는 방법론 페이지에서 관계 E2가 받아들여지면 열립니다. 그때까지는 경로 페이지가 곧 이 항목입니다.', source: (method: string) => '달러지수는 FRED에서 받은 미국 연방준비제도 H.10 광의 달러지수(분기 평균)입니다. UN Comtrade 12개월 창 자료를 썼고, A1은 money-flow 방법론 {method} 기준입니다.' },
    },
    moved: '시나리오 둘은 2026년 11월 2일 원천 사이트로 옮겼습니다. 공급망 단계에서 공급국이 이탈하는 경우는 trade-flow의 “공급국 감축” 사례 도구에서 다룹니다. 대출국이 대출을 줄이는 경우는 money-flow 은행 시장의 “대출국 감축” 패널에서 다룹니다. 옛 주소는 그쪽으로 연결됩니다.',
    movedLinks: { supplier: 'trade-flow의 공급국 감축', lenders: 'money-flow의 대출국 감축' },
  },
};
export type ScenarioStrings = typeof S.en;
export const scenarios = (lang: Lang): ScenarioStrings => (lang === 'ko' ? (S.ko as unknown as ScenarioStrings) : S.en);
