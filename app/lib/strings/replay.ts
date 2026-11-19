import { josa } from '../format';
import type { Lang } from '../types';

const S = {
  en: {
    kicker: 'Scenario S1',
    title: 'Bank and bond withdrawal replay',
    lede: 'Pick an economy and a past [[episode|stress quarter]]. The share of bank and bond funding that left in that quarter is applied to the economy’s funding stock today. It is [[first_round|arithmetic, not a forecast]]: the past quarter’s share times the current stock.',
    controls: { economy: 'Economy', quarter: 'Replay quarter', mode: 'Share', past: 'Past quarter', custom: 'Custom', customLabel: 'Custom share of the stock in one quarter', customHint: 'negative is withdrawal' },
    result: 'First-round result',
    tiles: {
      share: 'Share applied', shareSub: 'of the stock, in one quarter',
      withdrawal: 'Withdrawal on today’s stock', inflow: 'Inflow on today’s stock',
      bank: 'of which bank loans', bond: 'of which debt securities',
      after: 'Net reserves after', cover: 'Withdrawal ÷ net reserves', months: 'Months of imports', monthsSub: 'withdrawal ÷ 12-month imports × 12',
      stock: 'Funding stock today', stockSub: 'bank loans + international debt securities', resNet: 'Net reserves today', resSub: 'IRFCL I + II after known drains', imports: 'Imports, 12 months',
    },
    noShare: 'No published flows for this economy in that quarter; choose another quarter or a custom share.',
    noRes: 'no net reserves published',
    notMeaningful: 'not meaningful: net reserves are not positive',
    partial: 'window before the quarter’s last month (partial)',
    quartersH: 'This economy across the seven replay quarters',
    allH: 'Every economy in this quarter',
    allLede: 'The same quarter’s share applied to each economy’s stock today, sorted by the cover ratio.',
    cols: { eco: 'Economy', share: 'Share', withdrawal: 'Withdrawal', cover: '÷ net reserves', months: 'Months of imports' },
    source: (q: string, m: string, method: string) => `BIS locational banking statistics (loans and deposits) and BIS international debt securities for the stock and the quarter’s flows, IMF IRFCL for net reserves, both via money-flow method ${method}, ${q}; UN Comtrade 12-month imports to ${m} via trade-flow. Calculations: datasteg.`,
  },
  ko: {
    kicker: '시나리오 S1',
    title: '은행·채권 자금 유출 재생',
    lede: '경제 하나와 과거 [[episode|위기 분기]] 하나를 고릅니다. 그 분기에 유출된 은행·채권 자금의 비율을 오늘의 자금 잔액에 곱합니다. 전망이 아니라 산수입니다. 과거 분기의 비율에 현재 잔액을 곱한 값입니다.',
    controls: { economy: '경제', quarter: '재현 분기', mode: '비율', past: '과거 분기', custom: '직접 입력', customLabel: '한 분기 잔액 대비 비율 직접 입력', customHint: '음수는 유출을 뜻합니다' },
    result: '1차 효과',
    tiles: {
      share: '적용 비율', shareSub: '한 분기, 잔액 대비',
      withdrawal: '오늘 잔액에서의 유출', inflow: '오늘 잔액에서의 유입',
      bank: '그중 은행 대출', bond: '그중 채권',
      after: '유출 뒤 순외환보유액', cover: '유출 ÷ 순외환보유액', months: '수입 개월 수', monthsSub: '유출 ÷ 12개월 수입 × 12',
      stock: '오늘의 자금 잔액', stockSub: '은행 대출 + 국제채권', resNet: '오늘의 순외환보유액', resSub: 'IRFCL I + II, 알려진 유출 차감', imports: '수입, 12개월',
    },
    noShare: '이 경제는 그 분기의 공표 흐름이 없습니다. 다른 분기를 고르거나 비율을 직접 입력해 주십시오.',
    noRes: '순외환보유액 미공표',
    notMeaningful: '의미 없음(순외환보유액이 0 이하)',
    partial: '분기 마지막 달보다 앞선 창(부분)',
    quartersH: '이 경제의 일곱 재현 분기',
    allH: '이 분기의 모든 경제',
    allLede: '같은 분기의 비율을 각 경제의 오늘 잔액에 곱한 값입니다. 보유액 대비 비율 순으로 정렬했습니다.',
    cols: { eco: '경제', share: '비율', withdrawal: '유출', cover: '÷ 순보유액', months: '수입 개월 수' },
    source: (q: string, m: string, method: string) => `잔액과 분기 흐름은 국제결제은행(BIS) 지역별 국제은행통계(대출·예금)와 BIS 국제채무증권 통계, 순외환보유액은 IMF IRFCL 자료입니다. 모두 money-flow 방법론 ${method} 기준 ${q} 수치입니다. ${josa(m, '의')} 12개월 수입은 trade-flow를 거친 UN Comtrade 자료입니다. 계산: datasteg.`,
  },
};
export type ReplayStrings = typeof S.en;
export const replayStrings = (lang: Lang): ReplayStrings => (lang === 'ko' ? (S.ko as unknown as ReplayStrings) : S.en);
