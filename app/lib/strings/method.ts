// Method page strings (EN, KO 해라체). Numbers that come from the data (AUROC, counts, periods) are passed in.
import type { Lang } from '../types';
import { josa } from '../format';

const S = {
  en: {
    kicker: 'Method',
    title: 'What this site joins, by which rules, and how well the signals work',
    lede: 'global-network collects nothing. It reads money-flow’s release store and trade-flow’s data folder, joins them on the economy, and shows the result with each number at its own period. This page states the rules and the validation of the early-warning signals.',

    what: 'What the site is',
    whatBody: [
      'A thin third app (refurbished on 2 November 2026). The funding side is money-flow’s export surface: the Signal Board (method {method}), the economy views, the earnings series (World Bank WDI and IMF quarterly, fetched by money-flow), its change feed and its validation set, plus the links tables from BIS and IMF statistics. The trade side is trade-flow’s export surface: UN Comtrade 12-month windows, partners, chain stages, HS-chapter products, its change feed and the trade events. Nothing is fetched from a publisher here, so nothing can disagree with the two source sites; what a parent shows in full is linked, not copied.',
      'The economy set is money-flow’s board rule: the 36 borrowing economies of the Signal Board, Korea first. The United States is the hub of the dollar system, not a borrower in this sense; it appears for trade and on the pulse only, and has no score.',
    ],

    rules: 'Rules G1–G19',
    rulesLede: 'Nineteen rules decide what may be joined and shown. G11–G17 were the Fiscal Stress Monitor’s and moved with it to money-flow (rules R22–R28 there); G18 is the boundary rule of the refurbish of 2 November 2026; G19 is the stress signals’ admission rule of 3 November 2026. Each page cites the rule it follows.',
    movedRules: 'G11–G17', movedRulesText: 'The seven rules of the Fiscal Stress Monitor. The monitor is money-flow’s Sovereign section since the refurbish; its rules are R22–R28 in money-flow’s method registry and its validation runs as money-flow checks.',
    ruleList: [
      ['G1', 'Join on the economy code. money-flow’s economies.csv was built from trade-flow’s nodes, so one ISO alpha-3 code names an economy on both sides.'],
      ['G2', 'Every figure keeps its own period: the quarter for BIS and IMF series, the 12-month window ending in the shown month for trade, the week for the pulse. No total is drawn across periods.'],
      ['G3', 'Trade values follow trade-flow’s rules: 12-month windows, importer-reported where the importer has filed, partner-reported or estimated otherwise and marked. An economy’s line stops where under 90% of its usual flows are filed, and its “now” is its last complete month.'],
      ['G4', 'Money links are values in USD bn as money-flow publishes them; BIS and IMF terms allow it. Trade links are shares of world trade multiplied by the world total, as trade-flow stores them, never an original record.'],
      ['G5', 'The scores are money-flow method {method} unchanged: V = ½ exposure + ½ buffers, 0–100; F = 400 × (B1 + B2) / stock, % a year. Nothing is recomputed here.'],
      ['G6', 'The trade indicators (export and import momentum, export market HHI, chokepoint exposure, commodity share) are shown beside V but are not in the score. They enter only when the validation table below says they help, and then as a new method version on money-flow. The current-account split, GDP per capita and net IIP of How economies earn are display only and enter neither V nor F (1 Nov 2026).'],
      ['G7', 'Early warning is shown with its validation: AUROC against the named episodes. Positive = the four quarters before an episode, calm = quarters outside ±8 quarters of an economy’s own episodes and outside the 2008–09 and 2020 global windows (build.py score_sets).'],
      ['G8', 'Scenarios are first-round arithmetic on published series: a past withdrawal share on today’s stock, a supplier’s share removed from a stage. Never a model, never a forecast.'],
      ['G9', 'No commercial data. Every figure comes from an official or open source; nothing licensed passes through from money-flow, not even as an aggregate (a money-flow rule since 1 Nov 2026). The World Bank’s World Development Indicators, added for How economies earn on 1 Nov 2026, are CC BY 4.0; their balance-of-payments lines are the IMF’s, open with attribution.'],
      ['G10', '“What changed” is thresholds only: a crossing of 60 on V, a sign change of F or of export momentum, A2 passing 100%, a chokepoint moving. No trend is fitted. The parents publish their own crossings (money-flow changes/global, trade-flow changes.json) and this site shows them as published; it computes only the joint kinds.'],
      ['G18', 'global-network collects nothing; every series arrives through money-flow’s release or trade-flow’s data folder, and the footer names both versions. Each parent publishes a versioned export surface (surface.json); the build reads the manifest first and refuses a major version it was not written for.'],
      ['G19', 'A joint stress signal enters a published composite only if it separates pre-crisis quarters from calm ones better than the better of its two single-side inputs, with a 90% bootstrap interval of the gain above zero; otherwise it is shown as context. If none passes, the stress page shows the signals beside V without a composite (stress signals, 3 November 2026).'],
      ['G20', 'One rule per quantity (17 Nov 2026, C1–C5): a named quantity is computed one way everywhere and named as the shared measures registry names it; a stock at a quarter end is joined only with the 12-month window ending in that quarter’s last month, or up to six months earlier and then marked partial; growth compares a window with the window ending exactly twelve months earlier; net reserves are never floored outside A2; and the build fails when a check of these rules fails (K1, K2, K3, K8 on the About page).'],
    ] as [string, string][],

    valid: 'Early warning and its validation',
    validLede: (episodes: number) => `Every indicator is scored point in time and tested against ${episodes} economy-episodes of external funding stress, from the 2008 crisis to Türkiye in 2021. The table reads the build’s validation.json.`,
    cols: { ind: 'Indicator', side: 'Side', auroc: 'AUROC (90% interval)', pos: 'Positives', neg: 'Calm quarters' },
    intervalNote: (draws: number, level: number) => `Intervals: ${draws} bootstrap redraws of the economy-episodes (the positives) against the fixed calm set; the central ${level}%. A gap between two indicators that is smaller than their intervals is not a gain.`,
    side: { money: 'funding', trade: 'trade', both: 'both' },
    aurocMeaning: 'AUROC is the chance that a randomly drawn pre-episode quarter scores higher than a randomly drawn calm quarter. 0.5 is a coin toss; 1.0 would put every stressed quarter above every calm one. Early-warning scores in the literature sit around 0.6 to 0.8.',
    honest: (best: string, bestAuroc: string, pos: number, overlap: boolean) => `The honest reading: ${best} is highest in this build (${bestAuroc}), but on ${pos} positives. The trade indicators are percentiles of an economy’s own history that needs eight quarters, and the 12-month windows begin in 2006, so the 2008 episodes drop out of their test. ${overlap ? 'Its interval overlaps V’s, so the gain over V alone is not established' : 'Its interval clears V’s, but on this few events one episode can move it'}; the trade indicators stay beside the score and not in it (G6).`,
    memoNote: (ours: string) => `Why V reads ${ours} here and 0.686 in money-flow’s vulnerability memo (docs/methodology/vulnerability-v1.4.md): the test differs in two places. The memo’s calm set is every quarter more than four quarters from an economy’s episodes; ours leaves out ±8 quarters, so fewer near-episode quarters count as calm. The memo scores each of the four pre-episode quarters as a positive; ours takes the highest of the four, one positive per episode, which asks “did the score rise at some point in the year before” rather than “was it high every quarter”. Both choices raise the figure. The memo’s number is the memo’s reference; this one is for comparing indicators on the same footing.`,

    limits: 'Limits',
    limitList: [
      'Coverage: 36 economies, the Signal Board’s set. Monthly trade is partly estimated where importers have not filed, and marked where it is.',
      'Derived flows carry valuation effects: a flow taken as the change of a position moves with exchange rates and prices as well as with transactions. BIS adjusted changes are used where published.',
      'B1 includes interbank funding, so for financial-centre advanced economies (the UK, Japan, Canada) the flow score reads bank-to-bank positions as withdrawals.',
      'A2 is shown but not scored for the UK, Japan, Canada and euro members: reserve issuers and economies with standing dollar swap lines do not fund short-term bank debt from reserves.',
      'The BIS debt securities currency split is sparse for many economies, so no bond figure is shown by currency.',
      'The AUROC intervals redraw the economy-episodes only; the calm set is fixed and the episodes were chosen by hand, so the intervals understate the uncertainty of the list itself. A mechanical crash dating gave money-flow a lower figure (0.59).',
    ],

    checks: 'Checks at this build', checksLede: 'The joint checks the build runs before it writes a page, each with its figure as it came out. The first is money-flow’s own check, read from its release; the others compare this site’s joins with the parents’ totals and windows.',
    checkCols: { id: 'Check', what: 'What is checked', result: 'Result', figure: 'Figure' }, pass: 'pass', warn: 'warn',
    checkLog: (log: string) => `Build log: ${log} under GN_STORE (inputs, outputs, checks and timings; copied to the deploy tag after a deploy).`,
    periods: 'Periods and provenance',
    periodsLede: 'Every build records the money-flow release and the trade-flow build it read, and the version of each export surface. These are the figures of this build.',
    prov: {
      release: 'money-flow release', method: 'money-flow method', surface: 'Export surface version', quarter: 'Latest quarter', vintages: 'Source vintages read by money-flow',
      tfBuilt: 'trade-flow built', shown: 'Shown month (all windows)', completeA: 'Last complete year', completeM: 'Last complete month', lastA: 'Last year with data', lastM: 'Last month with data',
      bank: 'Bank links (BIS LBS)', portfolio: 'Portfolio links (IMF PIP)', fdi: 'Direct investment links (IMF DIP)', built: 'This build',
    },
    source: 'money-flow’s vulnerability memo (docs/methodology/vulnerability-v1.4.md); trade-flow docs/DATA.md; this site’s scripts/build.py.',
  },
  ko: {
    kicker: '방법론',
    title: '연결 대상·규칙과 신호 정확도',
    lede: 'global-network는 새로 수집하지 않습니다. money-flow의 릴리스 저장소와 trade-flow의 데이터 폴더를 읽어 경제 단위로 잇습니다. 수치마다 제 기준 시점을 붙여 표시합니다. 이 페이지는 그 규칙과 조기경보 신호의 검증 결과를 적습니다.',

    what: '이 사이트는 무엇인가',
    whatBody: [
      '',
      '경제 집합은 money-flow 신호판의 규칙을 따릅니다. 시그널 보드의 차입 경제 36개이며 한국을 맨 앞에 둡니다. 미국은 달러 체제의 중심이며 이런 의미의 차입국이 아닙니다. 교역과 맥박 타일에만 나오고 점수는 없습니다.',
    ],

    rules: '규칙 G1~G19',
    rulesLede: '무엇을 잇고 표시할지는 규칙 열아홉 개가 정합니다. G11~G17은 재정 스트레스 점검의 규칙이었고, 점검과 함께 money-flow로 옮겨 갔습니다(거기서는 R22~R28). G18은 2026년 11월 2일 개편 때 정한 경계 규칙입니다. G19는 2026년 11월 3일 정한 스트레스 신호 채택 규칙입니다. 페이지마다 따르는 규칙을 밝힙니다.',
    movedRules: 'G11~G17', movedRulesText: '재정 스트레스 점검의 일곱 규칙입니다. 점검은 개편 뒤 money-flow의 국가 재정 섹션이 됐습니다. 규칙은 money-flow 방법론 등록부의 R22~R28이고, 검증은 money-flow의 검사에서 수행합니다.',
    ruleList: [
      ['G1', '경제 코드로 잇습니다. money-flow의 economies.csv는 trade-flow의 노드에서 만들었습니다. 그래서 ISO 알파-3 코드 하나가 양쪽에서 같은 경제를 가리킵니다.'],
      ['G2', '각 수치는 자체 기준 시점을 따릅니다. BIS·IMF 계열은 분기, 교역은 표시 월에 끝나는 12개월 창, 맥박은 주 단위입니다. 기준 시점을 넘나드는 합계는 그리지 않습니다.'],
      ['G3', '교역 값은 trade-flow의 규칙을 따릅니다. 12개월 창을 쓰고, 수입국이 신고했으면 그 값을 씁니다. 수입국이 신고하지 않았으면 상대국 보고나 추정값을 쓰고 표시합니다. 평소 흐름의 90% 미만이 신고된 시점에서 선이 멈춥니다. 그 경제의 “지금”은 마지막 완결 월입니다.'],
      ['G4', '자금 링크는 money-flow가 공표하는 그대로 억 달러 값입니다. BIS와 IMF 약관이 이를 허용합니다. 교역 링크는 trade-flow가 저장하는 대로 세계 교역 비중에 세계 합계를 곱한 값이며 원본 기록이 아닙니다.'],
      ['G5', ''],
      ['G6', '교역 지표(수출·수입 모멘텀, 수출 시장 HHI, 병목 노출, 원자재 비중)는 V 옆에 표시하지만 점수에는 넣지 않습니다. 아래 검증표에서 효과가 확인되더라도 money-flow의 새 방법론 버전에서만 점수에 들어갑니다. "경제는 무엇으로 소득을 올리나"의 경상수지 분해, 1인당 GDP, 순대외금융자산은 표시만 하고 V에도 F에도 넣지 않습니다(2026년 11월 1일).'],
      ['G7', '조기경보 지표는 검증 결과와 함께 싣습니다. 검증 지표는 지정된 위기 사례에 대한 AUROC입니다. 양성은 위기 직전 네 분기입니다. 평온 분기는 그 경제의 위기 전후 8분기 밖이면서 2008~09년과 2020년 세계 구간 밖의 분기입니다(build.py score_sets).'],
      ['G8', '시나리오는 공표 계열에 대한 1차 산술입니다. 과거 유출 비율을 오늘 잔액에 곱하거나, 한 단계에서 공급국 비중을 뺍니다. 모형도 예측도 아닙니다.'],
      ['G9', '상업 자료를 쓰지 않습니다. 모든 수치는 공식 통계나 공개 자료에서 나옵니다. money-flow에서 라이선스 자료는 집계값으로도 넘어오지 않습니다(2026년 11월 1일부터 money-flow 규칙). 2026년 11월 1일 "경제는 무엇으로 소득을 올리나"에 더한 세계은행 세계개발지표는 CC BY 4.0입니다. 그 국제수지 항목은 출처 표시 조건으로 공개된 IMF 자료입니다.'],
      ['G10', '“무엇이 바뀌었나”는 기준선만 봅니다. V의 60 통과, F나 수출 모멘텀의 부호 전환, A2의 100% 통과, 병목 이동입니다. 추세선은 추정하지 않습니다. 두 원천 사이트가 제 기준선 통과를 직접 공표합니다(money-flow changes/global, trade-flow changes.json). 이 사이트는 공표된 그대로 싣고 결합 항목만 계산합니다.'],
      ['G18', 'global-network는 아무것도 수집하지 않습니다. 모든 계열은 money-flow의 릴리스나 trade-flow의 데이터 폴더를 거쳐 오며, 하단에 두 버전을 적습니다. 두 사이트는 버전이 붙은 내보내기 표면(surface.json)을 공표합니다. 빌드는 이 목록을 먼저 읽고, 모르는 주 버전이면 멈춥니다.'],
      ['G19', '결합 스트레스 신호가 공표 종합 점수에 들어가려면 두 조건을 채워야 합니다. 위기 전 분기와 평온한 분기를 자금 입력과 교역 입력 가운데 나은 쪽보다 잘 갈라야 합니다. 그 차이의 90% 부트스트랩 구간도 0보다 위여야 합니다. 아니면 참고로만 싣습니다. 통과한 신호가 없으면 스트레스 신호 페이지는 종합 점수 없이 신호를 V 옆에 표시합니다(스트레스 신호, 2026년 11월 3일).'],
      ['G20', ''],
    ] as [string, string][],

    valid: '조기경보와 그 검증',
    validLede: (episodes: number) => `모든 지표는 당시 시점의 값으로 산출합니다. 2008년 위기부터 2021년 튀르키예까지 외화자금 위기 ${episodes}건(경제×사례)으로 검증합니다. 표는 빌드의 validation.json을 읽습니다.`,
    cols: { ind: '지표', side: '쪽', auroc: 'AUROC(90% 구간)', pos: '양성', neg: '평온 분기' },
    intervalNote: (draws: number, level: number) => `구간은 경제×사례(양성)를 ${draws}번 복원 추출하고, 고정된 평온 집합과 비교해 다시 산출한 값의 가운데 ${level}%입니다. 두 지표의 차이가 구간보다 작으면 개선이 아닙니다.`,
    side: { money: '자금', trade: '교역', both: '둘 다' },
    aurocMeaning: 'AUROC는 무작위로 뽑은 위기 직전 분기가 무작위로 뽑은 평온 분기보다 점수가 높을 확률입니다. 0.5면 동전 던지기 수준이고, 1.0이면 모든 위기 분기가 모든 평온 분기보다 점수가 높습니다. 연구 문헌의 조기경보 점수는 대개 0.6~0.8입니다.',
    honest: (best: string, bestAuroc: string, pos: number, overlap: boolean) => (overlap ? `있는 그대로 읽으면 이렇습니다. 이 빌드에서는 ${josa(best, '이')}이 가장 높지만(${bestAuroc}) 양성은 ${pos}건뿐입니다. 교역 지표는 각 경제의 자기 이력 백분위이므로 여덟 분기 자료가 필요합니다. 12개월 창은 2006년에 시작하므로 2008년 사례가 검증에서 빠집니다. 그 구간이 V의 구간과 겹치므로 V 하나보다 낫다고 말할 수 없습니다. 교역 지표는 점수 옆에 두고 점수 안에는 넣지 않습니다(G6).` : `있는 그대로 읽으면 이렇습니다. 이 판본에서는 ${josa(best, '이')} 가장 높지만(${bestAuroc}) 양성이 ${pos}건뿐입니다. 교역 지표는 각 경제의 자체 기록 백분위이므로 여덟 분기 자료가 필요합니다. 12개월 창은 2006년에 시작하므로 2008년 사례가 검증에서 빠집니다. 그 구간은 V의 구간을 벗어나지만 사례가 이렇게 적으면 사례 하나가 값을 움직입니다. 교역 지표는 점수 옆에 두고 점수 안에는 넣지 않습니다(G6).`),
    memoNote: (ours: string) => 'V 값은 여기서 {ours}, money-flow 취약성 메모(docs/methodology/vulnerability-v1.4.md)에서는 0.686입니다. 검정 방식이 두 군데서 다르기 때문입니다. 메모는 각 경제의 위기 사례에서 4분기 넘게 떨어진 분기를 모두 평온 분기로 봅니다. 여기서는 위기 사례 앞뒤 ±8분기를 빼므로 위기에 가까운 분기가 평온 분기에 덜 들어갑니다. 메모는 위기 직전 4개 분기를 각각 양성으로 채점합니다. 여기서는 4개 분기 가운데 가장 높은 값을 취해 위기 사례마다 양성을 하나만 둡니다. ‘위기 전 1년 사이 어느 시점에 점수가 올랐는가’를 묻고, ‘매 분기 높았는가’를 묻지 않는 셈입니다. 두 선택 모두 수치를 높입니다. 메모의 수치는 메모의 기준값입니다. 이 수치는 같은 기준에서 지표를 비교하기 위한 것입니다.',

    limits: '한계',
    limitList: [
      '범위. 시그널 보드의 36개 경제입니다. 월별 교역은 수입국이 신고하지 않은 경우 일부를 추정하며, 추정값은 표시합니다.',
      '잔액 변동으로 산출한 파생 흐름에는 가치평가 변동이 섞입니다. 거래뿐 아니라 환율과 가격 변동에도 값이 움직입니다. BIS가 조정 변동분을 공표하는 경우에는 그 값을 씁니다.',
      'B1에는 은행 간 자금이 포함됩니다. 그래서 국제금융중심지인 선진 경제(영국, 일본, 캐나다)에서는 흐름 점수가 은행 간 잔액 변동을 유출로 잡습니다.',
      'A2는 영국, 일본, 캐나다와 유로 회원국에서 표시만 하고 점수에 넣지 않습니다. 기축통화 발행국과 상시 달러 통화스왑을 맺은 경제는 은행 단기 채무를 외환보유액으로 상환하지 않습니다.',
      'BIS 채권통계는 많은 경제에서 통화 구분에 빈 곳이 많습니다. 그래서 통화별 채권 수치는 싣지 않습니다.',
      'AUROC 구간은 경제×사례만 다시 뽑습니다. 평온 집합은 고정돼 있고 사례는 직접 선정했습니다. 그래서 구간은 사례 목록 자체의 불확실성을 충분히 반영하지 못합니다. 기계적 통화 급락 기준으로는 money-flow에서 더 낮은 값(0.59)이 나왔습니다.',
    ],

    checks: '이번 빌드의 검사', checksLede: '빌드가 페이지를 만들기 전에 실행하는 결합 검사입니다. 수치는 나온 그대로 적습니다. 첫 항목은 money-flow 자신의 검사를 릴리스에서 읽은 것입니다. 나머지는 이 사이트의 결합을 두 원천의 합계와 창에 비교합니다.',
    checkCols: { id: '검사', what: '점검 대상', result: '결과', figure: '수치' }, pass: '통과', warn: '주의',
    checkLog: (log: string) => `빌드 기록: GN_STORE의 ${log}(입력, 출력, 검사, 소요 시간. 배포 뒤 배포 태그 이름으로 복사합니다).`,
    periods: '기준 시점과 출처 기록',
    periodsLede: '빌드마다 읽은 money-flow 릴리스와 trade-flow 빌드, 그리고 두 내보내기 표면의 버전을 기록합니다. 아래는 이 빌드의 값입니다.',
    prov: {
      release: 'money-flow 릴리스', method: 'money-flow 방법론', surface: '내보내기 표면 버전', quarter: '최신 분기', vintages: 'money-flow가 읽은 원천 자료 공표 시점',
      tfBuilt: 'trade-flow 빌드', shown: '표시 월(모든 창)', completeA: '마지막 완결 연도', completeM: '마지막 자료가 모두 들어온 달', lastA: '자료가 있는 마지막 연도', lastM: '자료가 있는 마지막 월',
      bank: '은행 링크(BIS LBS)', portfolio: '증권투자 링크(IMF PIP)', fdi: '직접투자 링크(IMF DIP)', built: '이 빌드',
    },
    source: 'money-flow 취약성 메모(docs/methodology/vulnerability-v1.4.md), trade-flow docs/DATA.md와 SERIES-PLAN, 이 사이트의 scripts/build.py.',
  },
};
export type MethodStrings = typeof S.en;
export const method = (lang: Lang): MethodStrings => (lang === 'ko' ? (S.ko as unknown as MethodStrings) : S.en);
