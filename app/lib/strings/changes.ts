// "What changed" strings (EN, KO 해라체). Since 2 Nov 2026 the page merges the parents' published change feeds and puts
// the joint kinds, which only this site can see, first.
import type { Lang } from '../types';

const S = {
  en: {
    kicker: 'What changed',
    title: 'Threshold crossings, this quarter and this month',
    lede: (q: string, prevQ: string, m: string, prevM: string) => `No model is behind this list, only thresholds. Joint items pair a funding move with a trade move in the same economy or chain. Funding items are money-flow’s, ${prevQ} to ${q}; trade items are trade-flow’s, ${prevM} to ${m} at each economy’s own shown month, and the last complete year against the one before for chokepoints.`,
    joint: 'Funding and trade together', jointLede: 'Four kinds, computed here from the two feeds; two of them come from the stress signals. Neither parent can see them alone.',
    money: 'Funding (money-flow)', trade: 'Trade (trade-flow)',
    kinds: {
      funding_exports: { h: 'Funding left while exports fell', rule: 'In the same economy this period, the [[f|flow score F]] turned negative (money-flow) and [[mom|12-month exports]] turned down on a year earlier (trade-flow).' },
      stress_count: { h: 'The stress count crossed K', rule: 'The number of [[stress_count|stress signals]] at threshold reached K (3) or more this quarter, or fell below it, at the default thresholds.' },
      partner_stress: { h: 'Partner stress rose by a tercile', rule: '[[partner_stress|J4]], the trade-weighted vulnerability of an economy’s export destinations, moved up a tercile of its pooled distribution this quarter.' },
      chokepoint_lender: { h: 'A chokepoint moved while a lender withdrew', rule: 'A chain’s [[chokepoint|chokepoint]] stage changed between the last two complete years (trade-flow) and, this quarter, funding left one of the five largest exporters of that stage (money-flow F turned negative).' },
      at_risk_in: { h: 'Entered the at-risk quadrant', rule: '[[v|V]] at or above 60 while [[f|F]] is below zero: the [[at_risk|at-risk quadrant]]. Entries were outside it a quarter earlier.' },
      at_risk_out: { h: 'Left the at-risk quadrant', rule: 'In the quadrant (V ≥ 60 and F < 0) a quarter earlier and not now.' },
      flow_sign: { h: 'Funding changed direction', rule: 'The [[f|flow score F]] changed sign; the bank and bond parts of the latest quarter in USD bn.' },
      a2_100: { h: 'BIS banks’ claims due within a year crossed A2’s reserve base', rule: '[[a2|A2]] crossed 100% in either direction.' },
      v_jump: { h: 'V moved 10 points or more', rule: 'The [[v|vulnerability score]] moved by ten points or more in one quarter.' },
      export_sign: { h: '12-month exports changed direction', rule: '[[mom|Export momentum]] changed sign at the economy’s own shown month.' },
      divergence: { h: 'A top-5 destination reported differently', rule: 'The importer’s report over the exporter’s is outside the pair’s usual range (a [[mirror|mirror divergence]]).' },
      chokepoint: { h: 'A chokepoint moved along a chain', rule: 'The [[chokepoint|chokepoint]] stage of a chain in the last complete year is not the stage of the year before.' },
    },
    none: 'None this period.',
    openMoney: 'Every board move on money-flow', openTrade: 'Every event and chain on trade-flow',
    sourceJoint: 'money-flow changes/global and trade-flow changes.json, joined on the economy and the chain’s top exporters by this site’s build. Calculations: datasteg.',
    sourceMoney: (q: string, prevQ: string, method: string) => `Published by money-flow (changes/global) at its release, method ${method}; ${prevQ} to ${q}. Shown as published, not recomputed.`,
    sourceTrade: (m: string, y: number) => `Published by trade-flow (changes.json) at its build: 12-month windows to ${m}; chains in ${y}. Shown as published, not recomputed.`,
  },
  ko: {
    kicker: '무엇이 바뀌었나',
    title: '이번 분기와 이번 달 기준치 초과',
    lede: (q: string, prevQ: string, m: string, prevM: string) => `이 목록은 모형 없이 기준선만으로 만들었습니다. 결합 항목은 같은 경제나 공급망에서 자금과 교역이 함께 움직인 경우입니다. 자금 항목은 money-flow가 공표한 ${prevQ} 대비 ${q}의 변화입니다. 교역 항목은 trade-flow가 공표한 ${prevM} 대비 ${m}의 변화이며, 각 경제의 표시 월 기준입니다. 병목은 마지막 완결 연도를 그 전해와 비교했습니다.`,
    joint: '자금과 교역이 함께', jointLede: '네 종류입니다. 두 사이트의 자료를 이어 여기서 계산합니다. 그 가운데 둘은 스트레스 신호에서 나옵니다. 어느 한쪽 사이트만으로는 알 수 없습니다.',
    money: '자금(money-flow)', trade: '교역(trade-flow)',
    kinds: {
      funding_exports: { h: '자금 유출과 수출 감소가 겹친 경제', rule: '같은 경제에서 이번 기간에 [[f|흐름 점수 F]]가 음수로 돌아섰습니다(money-flow). [[mom|12개월 수출]]도 1년 전보다 감소하기 시작했습니다(trade-flow).' },
      stress_count: { h: '스트레스 신호 수가 K를 넘거나 밑돈 경제', rule: '기본 기준치로 집계한 [[stress_count|스트레스 신호]] 수가 이번 분기에 K(3)개 이상으로 올라섰거나 그 아래로 내려왔습니다.' },
      partner_stress: { h: '상대국 스트레스가 한 단계 상승한 경제', rule: '수출처의 취약성을 수출 비중으로 가중한 [[partner_stress|J4]]가 이번 분기에 전체 경제 분포의 3분위 구간에서 한 단계 올라갔습니다.' },
      chokepoint_lender: { h: '병목이 이동하는 가운데 자금이 유출된 경제', rule: '공급망의 [[chokepoint|병목]] 단계가 마지막 두 완결 연도 사이에 바뀌었습니다(trade-flow). 이번 분기에 그 단계의 상위 다섯 수출국 가운데 한 경제에서 자금이 유출됐습니다(money-flow F 음수 전환).' },
      at_risk_in: { h: '위험 사분면에 진입한 경제', rule: '[[v|V]]가 60 이상이면서 [[f|F]]가 0 아래인 [[at_risk|위험 사분면]]입니다. 한 분기 전에는 이 사분면에 들어 있지 않았던 경제입니다.' },
      at_risk_out: { h: '위험 사분면을 벗어난 경제', rule: '한 분기 전에는 사분면 안(V 60 이상, F 0 미만)에 있었지만 지금은 아닙니다.' },
      flow_sign: { h: '자금 흐름의 방향이 바뀐 경제', rule: '[[f|흐름 점수 F]]의 부호가 바뀌었습니다. 최근 분기의 은행과 채권 몫은 억 달러로 적었습니다.' },
      a2_100: { h: 'BIS 보고은행의 잔존만기 1년 이내 채권이 A2의 외환보유액 기준을 넘었습니다.', rule: '[[a2|A2]]가 100%를 넘었거나 아래로 내려왔습니다.' },
      v_jump: { h: 'V가 10점 넘게 움직인 경제', rule: '[[v|취약성 점수]]가 한 분기에 10점 이상 움직였습니다.' },
      export_sign: { h: '12개월 수출의 방향이 바뀐 경제', rule: '[[mom|수출 모멘텀]]의 부호가 각 경제의 표시 월에 바뀌었습니다.' },
      divergence: { h: '상위 5개 수출처의 보고가 엇갈린 경제', rule: '수입국 보고를 수출국 보고로 나눈 비율이 해당 쌍의 평소 범위를 벗어났습니다([[mirror|거울 괴리]]).' },
      chokepoint: { h: '병목이 이동한 공급망', rule: '공급망의 [[chokepoint|병목]] 단계가 마지막 완결 연도와 그 전해에서 다릅니다.' },
    },
    none: '이번 기간에는 없습니다.',
    openMoney: '신호판의 모든 변화는 money-flow에', openTrade: '모든 사건과 공급망은 trade-flow에',
    sourceJoint: '이 사이트의 빌드가 money-flow의 changes/global과 trade-flow의 changes.json을 경제와 공급망 상위 수출국 기준으로 이어 계산했습니다. 계산: datasteg.',
    sourceMoney: (q: string, prevQ: string, method: string) => 'money-flow(changes/global)가 릴리스 때 발표한 값입니다. 방법론 {method}, 기간은 {prevQ}~{q}입니다. 다시 계산하지 않고 발표된 그대로 보여 줍니다.',
    sourceTrade: (m: string, y: number) => `trade-flow가 빌드에서 공표한 값(changes.json)입니다. ${m}까지 12개월 창이며, 공급망은 ${y}년 기준입니다. 공표된 그대로 싣고 다시 계산하지 않습니다.`,
  },
};
export type ChangesStrings = typeof S.en;
export const changes = (lang: Lang): ChangesStrings => (lang === 'ko' ? (S.ko as unknown as ChangesStrings) : S.en);
