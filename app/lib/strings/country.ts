// Country sheet strings (EN, KO 해라체). Since 2 Nov 2026 the sheet keeps what joins the two sides and links the rest:
// the funding lane shows V, F, A2 and net IIP with the two lines and the five largest lenders, then opens the economy on
// money-flow; the trade lane shows the 12-month totals and line, five destinations and suppliers, the HHI, five products
// each way and the chokepoint table, then opens the economy on trade-flow.
import { josa } from '../format';
import type { Lang } from '../types';

const S = {
  en: {
    kicker: 'Country sheet',
    tabSheet: 'Country sheet',
    tabCompare: (b: string) => `Compare with ${b}`,
    lede: (en: string) => `${en}: where its funding comes from and where its goods go, each figure at its own period. The full board columns are on money-flow, the full trade network on trade-flow; this sheet keeps the join.`,
    funding: 'Funding', trade: 'Trade',
    tiles: {
      v: 'Vulnerability V', vSub: (rank: number, n: number) => `rank ${rank} of ${n}`, f: 'Flow score F', fSub: '% a year, bank and bond funding',
      a2: 'BIS banks’ claims due within a year ÷ reserve base (A2)', a2Net: 'reserve base: net reserves', a2Floored: 'reserve base: a tenth of gross reserves (net reserves are lower)', a2Gross: 'reserve base: gross reserves', niip: 'Net IIP / GDP',
      x: 'Exports, 12 months', m: 'Imports, 12 months', momx: 'Exports y/y', momm: 'Imports y/y', hm: 'Export market HHI', hmSub: 'concentration of destinations',
    },
    trailNote: '[[v|V]] (line) with the economy’s own [[episode|stress quarters]] shaded. Below, the [[f|flow score F]]: above zero funding comes in, below zero it leaves.',
    flowChart: 'Flow score F, % a year',
    lenders: 'Who lends through banks', lendersNote: (q: string) => `The five largest [[reporter|reporting banking systems]] by loans and deposits on this economy, ${q}, residence basis; each share is of the loans and deposits all BIS reporters hold on it at the same quarter. Offshore centres hold intragroup funding.`,
    openMoney: (e: string) => `Open ${e} in money-flow`, openMoneyNote: 'A1, A3, reserves by month, the external balance sheet and every board column are there.',
    seriesNote: 'Tangerine exports, grey imports, USD bn, [[window12|12-month windows]]. The line stops where fewer than 90% of the economy’s usual flows are [[filed|filed]].',
    dests: 'Where its goods go', sups: 'Where its imports come from', share: 'share', yoy: 'y/y',
    products: 'What it sells and buys, by HS chapter', prodX: 'Top exports', prodM: 'Top imports',
    prodCols: { name: 'HS chapter', usd: 'Value', share: 'Share', yoy: 'y/y', net: 'Net' }, other: 'Other',
    prodNote: 'Five largest [[hs2|HS chapters]] per side over the 12-month window, US dollars. Share of the economy’s total exports or imports; y/y against the window a year earlier. Net is exports minus imports of the same chapter. * estimates are 10% or more of the row.',
    chokepoints: 'Exposure to chokepoints', chokeNote: 'Chain stages worth over $1bn where one exporter group holds most of world trade ([[hhi|HHI]] above 0.25: a [[chokepoint|chokepoint]]). This economy’s share of world imports of the stage and its top supplier; each row opens the chain on trade-flow with this economy in focus.',
    chokeCols: { chain: 'Chain', stage: 'Stage', hhi: 'HHI', top: 'Top exporter', m: 'Its import share', ts: 'Its supplier' },
    openTrade: (e: string) => `Open ${e} in trade-flow`, openTradeNote: 'The explorer with this economy in focus: every partner, every product window and the events that touched it.',
    replay: 'Bank and bond withdrawal replay', replayNote: 'What the economy’s worst past quarter of [[withdrawal|withdrawal]] would mean on today’s stock: a [[first_round|first-round]] calculation.', open: 'Open the scenario',
    pair: 'Pair with', pairNote: 'Goods, bank, portfolio and direct investment for one pair: the page only this site can draw.',
    sources: {
      funding: (q: string, method: string) => `money-flow method ${method} as of ${q}; the release is in the footer. Calculations: datasteg.`,
      trade: (m: string) => `Importer-reported where filed, partner-reported or estimated otherwise (marked), to ${m}. Calculations: datasteg.`,
    },
    hubNote: 'The United States is the [[hub|hub of the dollar system]], not a borrower in this sense; it has no board row. Its funding side is the pulse on the Overview.',
    noMoney: 'No funding data for this economy.',
    notMeaningful: 'not meaningful: net reserves are not positive',
    nesNote: 'UN Comtrade’s ‘Other Asia, not elsewhere specified’: most importers book their trade with Taiwan here; Gulf exporters book unnamed Asian destinations here.',
  },
  ko: {
    kicker: '국가 시트',
    tabSheet: '국가 시트',
    tabCompare: (b: string) => `${josa(b, '과와')} 비교`,
    lede: (ko: string) => `${ko}의 자금이 어디서 유입되고 상품이 어디로 수출되는지 정리했습니다. 수치마다 기준 시점이 다릅니다. 신호판의 모든 열은 money-flow에, 교역망 전체는 trade-flow에 있습니다. 이 시트는 둘을 이은 부분만 남깁니다.`,
    funding: '자금', trade: '교역',
    tiles: {
      v: '취약성 V', vSub: (rank: number, n: number) => `${n}개 경제 중 ${rank}위`, f: '흐름 점수 F', fSub: '연율 %, 은행·채권 자금',
      a2: 'BIS 보고은행의 잔존만기 1년 이내 채권 ÷ 외환보유액 기준(A2)', a2Net: '외환보유액 기준: 순외환보유액', a2Floored: '외환보유액 기준은 총외환보유액의 십분의 일입니다. 순외환보유액이 이보다 적기 때문입니다.', a2Gross: '외환보유액 기준: 총외환보유액', niip: 'GDP 대비 순대외금융자산',
      x: '수출, 12개월', m: '수입, 12개월', momx: '수출 전년비', momm: '수입 전년비', hm: '수출 시장 HHI', hmSub: '수출처 집중도',
    },
    trailNote: '[[v|V]](선)와 이 경제가 겪은 [[episode|위기 분기]](띠). 아래는 [[f|흐름 점수 F]]입니다. 0보다 크면 순유입, 작으면 순유출입니다.',
    flowChart: '흐름 점수 F, 연율 %',
    lenders: '은행 대출의 주요 상대국', lendersNote: (q: string) => '이 경제에 보유한 대출금·예금이 가장 많은 [[reporter|BIS 보고국 은행]] 다섯 곳입니다. 시점은 {q}, 거주지 기준입니다. 비중은 같은 분기에 모든 BIS 보고국이 이 경제에 보유한 대출금·예금에서 차지하는 몫입니다. 역외금융센터의 몫에는 그룹 내부 자금이 들어 있습니다.',
    openMoney: (e: string) => `money-flow에서 ${e} 보기`, openMoneyNote: 'A1, A3, 월별 보유액, 대외 대차대조표와 신호판의 모든 열이 여기에 있습니다.',
    seriesNote: '귤색은 수출, 회색은 수입, 억 달러, [[window12|12개월 창]]. 평소 흐름의 90% 미만만 [[filed|신고]]된 달에서 선이 멈춥니다.',
    dests: '주요 수출처', sups: '주요 수입처', share: '비중', yoy: '전년비',
    products: '품목별 수출입, HS 2단위', prodX: '수출 상위 품목', prodM: '수입 상위 품목',
    prodCols: { name: 'HS 품목', usd: '금액', share: '비중', yoy: '전년비', net: '순수출' }, other: '기타',
    prodNote: '12개월 창의 [[hs2|HS 2단위 품목]] 가운데 수출·수입별 상위 다섯 개를 달러로 표시했습니다. 비중은 그 경제의 전체 수출이나 수입 대비입니다. 전년비는 1년 전 12개월 창과 비교합니다. 순수출은 같은 품목의 수출에서 수입을 뺀 값입니다. *는 추정이 그 줄의 10% 이상입니다.',
    chokepoints: '병목 노출', chokeNote: '세계 교역이 10억 달러를 넘는 공급망 단계 가운데 한 수출국 집단이 대부분을 차지하는 단계입니다([[hhi|HHI]] 0.25 초과, [[chokepoint|병목]]). 각 단계의 세계 수입에서 이 경제가 차지하는 비중과 최대 공급국을 적었습니다. 줄마다 trade-flow의 공급망 페이지가 이 경제를 중심에 두고 열립니다.',
    chokeCols: { chain: '공급망', stage: '단계', hhi: 'HHI', top: '최대 수출국', m: '수입 비중', ts: '공급국' },
    openTrade: (e: string) => `trade-flow에서 ${e} 보기`, openTradeNote: '이 경제를 중심에 둔 탐색기입니다. 모든 교역 상대, 모든 품목 창, 이 경제에 영향을 준 사건이 여기에 있습니다.',
    replay: '은행·채권 자금 유출 충격 재생', replayNote: '이 경제의 과거 최악의 [[withdrawal|유출]] 분기가 오늘의 잔액 기준으로 얼마인지 [[first_round|1차 효과]]로 계산합니다.', open: '시나리오 열기',
    pair: '상대국', pairNote: '두 경제 사이의 상품 교역, 은행 대출·예금, 증권투자, 직접투자입니다. 이 사이트에서만 그릴 수 있는 페이지입니다.',
    sources: {
      funding: (q: string, method: string) => 'money-flow 방법론 {method}, {q} 기준입니다. 릴리스는 페이지 하단에 있습니다. 계산은 datasteg가 했습니다.',
      trade: (m: string) => `${m}까지의 값입니다. 수입국 신고가 있으면 그 값을 쓰고, 없으면 상대국 보고나 추정값을 씁니다(표시). 계산은 datasteg이 합니다.`,
    },
    hubNote: '미국은 [[hub|달러 체제의 중심]]으로, 여기서 말하는 차입국이 아닙니다. 그래서 신호판에 행이 없습니다. 자금 쪽은 개요의 맥박 타일에 있습니다.',
    noMoney: '이 경제의 자금 자료가 없습니다.',
    notMeaningful: '산출 의미 없음(순외환보유액이 0 이하)',
    nesNote: 'UN Comtrade의 ‘달리 분류되지 않은 기타 아시아’ 항목입니다. 대부분의 수입국은 대만과의 교역을 이 항목에 계상합니다. 걸프 지역 수출국은 행선지를 밝히지 않은 아시아 수출을 이 항목에 계상합니다.',
  },
};
export type CountryStrings = typeof S.en;
export const country = (lang: Lang): CountryStrings => (lang === 'ko' ? (S.ko as unknown as CountryStrings) : S.en);
