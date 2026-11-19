import type { Lang } from '../types';

const S = {
  en: {
    kicker: 'About',
    title: 'How this site is built and where every number comes from',
    lede: 'The method and the sources on one page. global-network collects nothing of its own: it joins money-flow’s funding data and trade-flow’s trade data on the economy and keeps each number at its own period.',
    contents: 'On this page',
    toc: { what: 'What it joins', rules: 'Rules G1–G19', earn: 'How economies earn', chokepoint: 'Chokepoints', replay: 'Shock replay', validation: 'Validation', checks: 'Checks', limits: 'Limits', provenance: 'Periods and builds', parents: 'The two parents', datasets: 'Datasets', cite: 'How to cite' },
    earnTitle: 'How economies earn',
    earnBody: [
      'The Overview splits each economy’s current account into its two earning lines. Across: the balance on goods and services, what it earns by selling abroad less what it pays for what it buys. Up: the primary income balance, the interest, dividends and reinvested profits it earns on its foreign assets less what it pays foreigners on their assets inside it (wages of cross-border workers are in it too, and small). Both are divided by GDP in current dollars, a year at a time. Secondary income, mostly remittances and aid, is the third line of the current account and is left out.',
      'Quadrants: a balance above 1% of GDP counts as earning on that axis, one between −1% and 1% as not earning. So an economy “earns by trading” with a trade surplus above 1% and primary income at or below 1%, “earns from foreign assets” the other way round, “earns both ways” with both above, and “pays out both ways” otherwise. The band keeps a surplus of a few tenths of a percent from counting as a way of living; it is a reading aid, not a model.',
      'Bubble size is GDP per capita in current dollars; colour is the net international investment position at the last published quarter of the year (money-flow, IMF IIP), in five bins. These numbers are shown and never scored: they do not enter V or F, and nothing here recomputes either. The side panel joins them with trade-flow’s export market concentration and world share (12 months to the shown month), the chokepoints the economy holds (the last complete year) and A1 (the latest quarter), each at its own period.',
      'Two more views show the scale the net balances hide. Trade scale plots [[exports|exports]] against [[imports|imports]] of goods and services, both on the balance-of-payments basis of the net line and divided by the same World Bank GDP, so a point’s distance straight down to the [[diag|45° line]] is exactly its trade balance in the Net view. Financial scale plots [[assets|gross external assets]] against [[liabilities|gross external liabilities]] from the IMF IIP at the year’s last published quarter, on a [[log|log scale]] by default because financial centres reach five to six times GDP. Bubbles can be sized by GDP per capita, exports in dollars or gross assets in dollars; the side panel ranks each economy’s exports and gross assets among the economies shown. None of this enters V or F.',
      'Why the World Bank and not the IMF files money-flow mirrors: the IMF balance-of-payments files in money-flow’s hub carry these lines, but their currency labels do not reconcile for several economies (Germany’s “euro” primary income equals the dollar figure). The World Bank republishes the IMF’s series in current dollars with GDP beside them; Japan’s primary income matches the IMF dollar series exactly. Since the refurbish of 2 November 2026 money-flow fetches both the WDI and the IMF quarterly series and publishes them in its earn/global view; the annual-against-quarterly GDP check is money-flow’s V23, read back on this page.',
    ],
    checksTitle: 'Expectations checked, not tuned',
    checksLede: 'Before the view was built, six expectations were written down. The build checks them on the latest year and prints the result here as it comes out.',
    checkCols: { eco: 'Economy', exp: 'Expectation', trade: 'Trade', pi: 'Primary income', quad: 'Quadrant', ok: 'Result' },
    checkWords: { DEU: 'earns more from trade than from foreign assets', KOR: 'earns more from trade than from foreign assets', CHN: 'earns more from trade than from foreign assets', JPN: 'a large primary income surplus, above 3% of GDP', NOR: 'earns more from foreign assets than from trade', CHE: 'is among the board economies' } as Record<string, string>,
    ok: 'holds', flag: 'flagged', notInSet: 'not among the 36 board economies',
    earnSource: (read: string, release: string) => `World Bank WDI as money-flow’s earn/global view carries it (fetched ${read} by money-flow, release ${release}); joined in build.py build_earn. Calculations: datasteg.`,
    replayTitle: 'Shock replay',
    replayBody: [
      'A replay plays one supply shock month by month. Each frame is a window ending in that month, never a single month (trade-flow publishes none): edge width is the 12-month value, edge colour the latest 3 months against the same 3 months a year earlier. Where trade-flow writes no window of that length (a 12-month window never ends in January, a 3-month window never in January or April, so the Lunar New Year stays in one window), the frame repeats the month before and the edge is dashed. An edge is also dashed when either economy filed under 90% of its usual trade; a month in which the filing economies hold under 90% of world exports is hatched on the timeline.',
      'The three waves are picked once, from the 12 months before the shock: wave 1 is the origin; wave 2 its largest buyers of the highlighted goods, kept where the origin held at least 10% of the buyer’s imports of them; wave 3 those buyers’ largest third markets for the second-round goods. Each replay’s products and limits are in config/shocks.yaml, so a new replay is a new entry there.',
      'The funding overlay recolours each board economy by its flow score F for the quarter the frame falls in (after the newest published quarter, that quarter carries on and is marked), and rings an economy in a quarter where V rose through 60 or a scored A2 rose through 100%. The side strips show the broad dollar index and the Fed’s liquidity swaps outstanding, weekly. The summary ranks every board economy by its worst 3-month export change in the 12 months from the event and sets its F before and at its lowest beside it, with its quadrant from How economies earn. All of it is observed; none of it is attribution.',
    ],
    chokeTitle: 'Chokepoints',
    chokeBody: [
      'A supply chain on this site is a ladder of stages, from raw material to finished good, as trade-flow defines it (copper, steel, batteries, semiconductors and others). For each chain and year, trade-flow measures how concentrated each stage’s world exports are by exporting economy: the Herfindahl–Hirschman index, the sum of the squared export shares, from 0 (many small exporters) to 1 (one exporter).',
      'The chokepoint of a chain is the one stage with the highest index among the stages that trade at least $1 bn a year, flagged only if that index is above 0.25. A chain has at most one chokepoint a year, and none if no stage passes. The economy that holds it is the stage’s largest exporter.',
      'Where 0.25 comes from: it is the line above which the US Horizontal Merger Guidelines of 2010 called a market “highly concentrated” (2,500 on their 0–10,000 scale). The 2023 Merger Guidelines lowered that line to 1,800; this site keeps the stricter 0.25, so a stage it flags would count as highly concentrated under either. It is a convention for markets inside one country, used here for world export shares, not a measure of how easily a buyer could switch.',
    ],
    chokeSource: 'trade-flow scripts/chain_doc.py (CHOKE_MIN_WORLD = $1 bn, CHOKE_MIN_HHI = 0.25), on annual mirror trade; Horizontal Merger Guidelines (2010), section 5.3; Merger Guidelines (2023), section 2.1.',
  },
  ko: {
    kicker: '소개',
    title: '이 사이트를 만든 방법과 모든 숫자의 출처',
    lede: '방법론과 출처를 한 페이지에 모았습니다. global-network는 자료를 따로 모으지 않습니다. money-flow의 자금 자료와 trade-flow의 교역 자료를 경제 단위로 연결하고, 숫자마다 제 기준 시점을 붙여 둡니다.',
    contents: '이 페이지의 내용',
    toc: { what: '연결 대상', rules: '규칙 G1~G19', earn: '경제의 소득 구조', chokepoint: '병목', replay: '충격 재생', validation: '검증', checks: '검사', limits: '한계', provenance: '기준 시점과 빌드', parents: '두 원천 사이트', datasets: '데이터셋', cite: '인용 방법' },
    earnTitle: '경제의 소득 구조',
    earnBody: [
      '개요 화면은 경제마다 경상수지를 두 가지 소득원으로 나눕니다. 가로축은 상품·서비스수지입니다. 수출액에서 수입액을 뺀 값입니다. 세로축은 본원소득수지입니다. 대외금융자산에서 받는 이자·배당·재투자수익에서 외국인이 국내 자산에서 가져가는 몫을 뺀 값입니다. 국경을 넘는 근로자의 급료 및 임금도 포함하지만 규모는 작습니다. 두 지표 모두 경상 달러 GDP로 나누고 한 해씩 표시합니다. 경상수지의 세 번째 항목인 이전소득수지(주로 송금과 원조)는 제외했습니다.',
      '사분면은 이렇게 나눕니다. 한 축의 수지가 GDP의 1%를 넘으면 그 축에서 흑자로 보고, −1%와 1% 사이면 흑자로 보지 않습니다. 상품·서비스 흑자가 1%를 넘고 본원소득이 1% 이하면 "교역 흑자", 반대면 "본원소득 흑자", 둘 다 넘으면 "둘 다 흑자", 나머지는 "둘 다 적자"입니다. 이 띠는 0.몇 % 수준의 작은 흑자를 소득원으로 치지 않으려는 읽기 장치이며 모형이 아닙니다.',
      '원 크기는 경상 달러 1인당 GDP입니다. 색은 그해 마지막으로 공표된 분기의 순대외금융자산(money-flow, IMF IIP)을 다섯 구간으로 나눈 값입니다. 이 수치들은 표시만 하고 점수에 쓰지 않습니다. V나 F에 넣지 않으며, 이 화면에서 둘 중 무엇도 다시 계산하지 않습니다. 옆 패널은 trade-flow의 수출 시장 집중도와 세계 비중(공개된 달까지 12개월), 그 경제가 최대 수출국인 병목 단계(마지막 완결 연도), A1(최신 분기)를 각자의 기준 시점으로 붙입니다.',
      '두 화면을 더해 순수지로는 알 수 없는 규모를 나타냅니다. 교역 규모 화면은 상품·서비스 [[exports|총수출]]과 [[imports|총수입]]을 그립니다. 둘 다 순수지와 같은 국제수지 기준이며, 같은 세계은행 GDP로 나눴습니다. 그래서 점에서 [[diag|45도 선]]까지 수직으로 측정한 거리가 순수지 화면의 교역수지와 정확히 같습니다. 대외금융자산·부채 규모 화면은 IMF IIP의 [[assets|대외금융자산]]과 [[liabilities|대외금융부채]]를 그해 마지막 공표 분기 기준으로 그립니다. 국제금융중심지는 GDP의 5~6배에 이르므로 [[log|로그 눈금]]으로 시작합니다. 원 크기는 1인당 GDP, 달러 수출액, 달러 대외금융자산 가운데 고릅니다. 옆 패널은 수출과 대외금융자산의 순위를 화면의 경제 가운데서 매깁니다. 이 수치는 V에도 F에도 들어가지 않습니다.',
      'money-flow가 복제해 두는 IMF 파일 대신 세계은행 자료를 쓰는 데는 까닭이 있습니다. money-flow 저장소의 IMF 국제수지 파일에도 이 항목이 있지만, 몇몇 경제는 통화 표시가 서로 맞지 않습니다(독일의 "유로" 본원소득이 달러 값과 같습니다). 세계은행은 IMF 시계열을 경상 달러로 다시 공표하고 GDP를 함께 싣습니다. 일본의 본원소득은 IMF 달러 계열과 정확히 같습니다. 2026년 11월 2일 개편부터는 money-flow가 WDI와 IMF 분기 계열을 모두 받아 earn/global 뷰로 공표합니다. 연간과 분기 GDP의 대조는 money-flow의 검사 V23이 맡습니다. 이 페이지는 그 결과를 읽어 싣습니다.',
    ],
    checksTitle: '조정하지 않고 확인한 기대',
    checksLede: '이 화면을 만들기 전에 기대 여섯 가지를 적어 두었습니다. 빌드는 최신 연도로 이를 확인하고, 결과를 나오는 그대로 여기에 싣습니다.',
    checkCols: { eco: '경제', exp: '기대', trade: '교역', pi: '본원소득', quad: '사분면', ok: '결과' },
    checkWords: { DEU: '교역 흑자가 본원소득 흑자보다 큽니다', KOR: '교역 흑자가 본원소득 흑자보다 큽니다', CHN: '교역 흑자가 본원소득 흑자보다 큽니다', JPN: '본원소득 흑자가 크다(GDP의 3% 초과)', NOR: '본원소득 흑자가 교역 흑자보다 큽니다', CHE: '신호판 경제는 이사회 대상 경제입니다' } as Record<string, string>,
    ok: '맞음', flag: '어긋남', notInSet: '신호판는 이사회 36개 경제에 없습니다.',
    earnSource: (read: string, release: string) => `세계은행 세계개발지표(CC BY 4.0)입니다. money-flow의 earn/global 뷰가 싣는 그대로 씁니다(money-flow가 ${read} 수집, 릴리스 ${release}). build.py의 build_earn에서 잇습니다.`,
    replayTitle: '충격 재생',
    replayBody: [
      '재생은 공급 충격 하나를 월별로 따라갑니다. 화면 한 장은 그달에 끝나는 창이며 한 달치 값이 아닙니다(trade-flow는 한 달 값을 공개하지 않습니다). 선 굵기는 최근 12개월 합계, 선 색은 최근 3개월을 전년동기와 비교한 값입니다. trade-flow가 그 길이의 창을 쓰지 않는 달에는 앞 달 화면을 이어 쓰고 선을 점선으로 그립니다(12개월 창은 1월에, 3개월 창은 1월과 4월에 끝나지 않아 설 연휴가 한 창 안에 들어갑니다). 두 경제 중 하나라도 평소 교역의 90% 미만을 신고했으면 점선으로 그립니다. 신고한 경제의 세계 수출 비중이 90% 미만인 달은 시간축에 빗금을 칩니다.',
      '세 파동은 충격 전 12개월 자료로 한 번 정합니다. 1파는 진원지입니다. 2파는 강조한 품목을 진원지에서 가장 많이 수입한 경제 가운데 진원지 비중이 수입의 10% 이상인 경제입니다. 3파는 그 경제들이 2차 품목을 가장 많이 수출한 제3국입니다. 재생마다 품목과 한도는 config/shocks.yaml에 있고, 새 재생은 거기에 항목 하나를 더하면 됩니다.',
      '자금 겹쳐 보기는 신호판 경제마다 화면이 속한 분기의 흐름 점수 F로 색을 바꿉니다(최신 공표 분기 뒤로는 그 분기 값을 이어 쓰고 표시합니다). V가 60을 넘거나 점수에 들어가는 A2가 100%를 넘는 분기에는 고리를 그립니다. 옆 띠는 광의 달러 지수와 연준 중앙은행 유동성 스왑 잔액의 주간 값입니다. 요약표는 신호판의 모든 경제를 사건부터 12개월 안의 최악 3개월 수출 변화 순서로 정렬합니다. 사건 전 F와 가장 낮았던 F, "경제는 무엇으로 소득을 올리나"의 사분면을 함께 표시합니다. 모두 관측 결과이며 원인을 판정하지 않습니다.',
    ],
    chokeTitle: '병목',
    chokeBody: [
      '이 사이트에서 공급망은 원료에서 완제품까지 이어지는 단계의 사다리입니다. 공급망은 구리, 철강, 배터리, 반도체 등이 있으며 정의는 trade-flow를 따릅니다. trade-flow는 공급망과 연도마다 각 단계의 세계 수출이 수출국별로 얼마나 집중돼 있는지 측정합니다. 지표는 허핀달-허쉬만 지수(HHI)로, 수출 비중을 제곱해 더한 값입니다. 수출국이 많고 작으면 0에 가깝고 한 나라뿐이면 1입니다.',
      '공급망의 병목은 한 해 교역액이 10억 달러 이상인 단계 가운데 지수가 가장 높은 단계 하나입니다. 그 지수가 0.25를 넘을 때만 병목으로 표시합니다. 공급망마다 한 해 병목은 많아야 하나이며, 기준을 넘는 단계가 없으면 병목이 없습니다. 병목을 보유한 경제는 그 단계의 최대 수출국입니다.',
      '0.25는 2010년 미국 수평결합 지침이 시장을 "고도로 집중됐다"고 부른 경계입니다(0~10,000 척도의 2,500). 2023년 결합 지침은 이 경계를 1,800으로 낮췄습니다. 이 사이트는 더 엄격한 0.25를 그대로 쓰므로, 여기서 표시한 단계는 두 지침 어느 쪽으로도 고도 집중에 해당합니다. 원래 한 나라 안의 시장에 쓰는 관행을 세계 수출 비중에 빌려 쓴 것입니다. 수입국이 수입선을 얼마나 쉽게 바꿀 수 있는지를 측정하는 지표는 아닙니다.',
    ],
    chokeSource: 'trade-flow scripts/chain_doc.py(CHOKE_MIN_WORLD = 10억 달러, CHOKE_MIN_HHI = 0.25), UN Comtrade 연간 미러 교역. 미국 법무부·연방거래위원회, 수평결합 지침(2010) 5.3절, 결합 지침(2023) 2.1절.',
  },
};
export type AboutStrings = typeof S.en;
export const about = (lang: Lang): AboutStrings => (lang === 'ko' ? (S.ko as unknown as AboutStrings) : S.en);
