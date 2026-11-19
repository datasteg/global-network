// The glossary behind every <Term id> popover, English and Korean (해라체, guides/voice-ko.md). Each entry has four
// parts in a fixed order: what it is, how to read it (with an example from this build's data), how it is calculated, and
// its sources with the period and frequency used. Examples are filled from lib/glossary-facts.ts on the server.
import { bn, day, josa, month, num, pct, quarter, window12 } from './format';
import type { Facts } from './glossary-facts';
import { hsName } from './hs';
import { name } from './names';
import type { CiteItem } from './sources';
import type { Lang } from './types';

/** A glossary card. The site's entries fill what/read/calc; the Fiscal Stress Monitor's (config/glossary.yaml) fill
 * what/why/calc/thr/ex and, for R3 and its parts, the formula in symbols. Empty parts are not drawn. */
export interface Gloss { term: string; what: string; read?: string; calc?: string; why?: string; thr?: string; formula?: string; ex?: string; src: CiteItem[] }
type Text = { term: string; what: string; read: string; calc: string };
interface Def { src: (f: Facts, l: Lang) => CiteItem[]; en: (f: Facts) => Text; ko: (f: Facts) => Text }

const P = (v: number | null | undefined, l: Lang, d = 1, s = false) => pct(v, l, d, s);
const N = (c: string, l: Lang) => name(c, l);
const yr = (f: Facts, l: Lang) => (l === 'ko' ? `${f.y0}~${f.year}년, 연간` : `${f.y0}–${f.year}, annual`);
const qs = (f: Facts, l: Lang) => (l === 'ko' ? `${quarter(f.q0, l)}~${quarter(f.q, l)}, 분기` : `${quarter(f.q0, l)} to ${quarter(f.q, l)}, quarterly`);
const w12 = (f: Facts, l: Lang) => (l === 'ko' ? `12개월 창, ${window12(f.shown, l)}` : `12-month window, ${window12(f.shown, l)}`);
const wk = (f: Facts, l: Lang) => (l === 'ko' ? `${day(f.pulseDay, l)}까지, 주간` : `to ${day(f.pulseDay, l)}, weekly`);
const WDI = (f: Facts, l: Lang, series: string[]): CiteItem => ({ src: 'wdi', series, period: yr(f, l) });
const MONEY = (f: Facts, l: Lang): CiteItem[] => [
  { src: 'bis.lbs', period: qs(f, l) }, { src: 'bis.dss', period: qs(f, l) }, { src: 'bis.cbs', period: qs(f, l) },
  { src: 'imf.irfcl', period: qs(f, l) }, { src: 'imf.iip', period: qs(f, l) }, { src: 'imf.bop', period: qs(f, l) }, { src: 'bis.tc', period: qs(f, l) },
];
const TRADE = (f: Facts, l: Lang): CiteItem[] => [{ src: 'comtrade', period: w12(f, l) }];

const G: Record<string, Def> = {
  gs: {
    src: (f, l) => [WDI(f, l, ['BN.GSR.GNFS.CD', 'NY.GDP.MKTP.CD'])],
    en: (f) => ({ term: 'Goods and services balance', what: 'What an economy earns by selling goods and services abroad, minus what it pays for the goods and services it buys from abroad.', read: `Above zero, it sells more than it buys. Korea’s balance in ${f.year} was ${P(f.earn.KOR?.gs, 'en', 1, true)} of GDP. Japan’s was ${P(f.earn.JPN?.gs, 'en', 1, true)}: it is a big exporter, but its energy and food imports and its deficit on digital services and royalties offset the exports.`, calc: 'Exports of goods and services minus imports, from the balance of payments, divided by GDP.' }),
    ko: (f) => ({ term: '상품·서비스 수지', what: '상품과 서비스의 수출액에서 수입액을 뺀 값입니다.', read: `0보다 크면 수출이 수입보다 많습니다. ${f.year}년 한국은 GDP의 ${P(f.earn.KOR?.gs, 'ko', 1, true)}이었습니다. 일본은 ${P(f.earn.JPN?.gs, 'ko', 1, true)}였습니다. 일본은 수출이 많지만 에너지·식량 수입과 디지털 서비스·지식재산권사용료 적자가 그만큼 큽니다.`, calc: '국제수지의 상품·서비스 수출에서 수입을 빼고 GDP로 나눈 값입니다.' }),
  },
  pi: {
    src: (f, l) => [WDI(f, l, ['BN.GSR.FCTY.CD', 'NY.GDP.MKTP.CD'])],
    en: (f) => ({ term: 'Primary income balance', what: 'The interest, dividends and reinvested profits an economy earns on what it owns abroad, minus what it pays foreigners on what they own inside it. Wages of cross-border workers count too.', read: `Above zero, its foreign assets pay it more than foreigners take out. Japan’s was ${P(f.earn.JPN?.pi, 'en', 1, true)} of GDP in ${f.year}, one of the largest: decades of surpluses invested abroad now pay income.`, calc: 'Primary income credits minus debits, from the balance of payments, divided by GDP.' }),
    ko: (f) => ({ term: '본원소득수지', what: '해외 자산에서 받는 이자·배당·재투자수익에서 외국인에게 지급하는 몫을 뺀 값입니다. 국경을 넘나드는 근로자의 급료 및 임금도 포함합니다.', read: `0보다 크면 해외 자산에서 받는 소득이 외국인에게 지급하는 소득보다 많습니다. ${f.year}년 일본은 GDP의 ${josa(P(f.earn.JPN?.pi, 'ko', 1, true), '으로')} 손꼽히게 컸습니다. 수십 년 동안 쌓은 흑자를 해외에 투자해 그 소득을 받습니다.`, calc: '국제수지의 본원소득수지(수입에서 지급을 뺀 값)를 GDP로 나눈 값입니다.' }),
  },
  niip: {
    src: (f, l) => [{ src: 'imf.iip', series: ['IIP total assets / liabilities'], period: qs(f, l) }, { src: 'bis.tc', period: qs(f, l) }],
    en: (f) => ({ term: 'Net international investment position (net IIP)', what: 'Everything an economy’s residents own abroad minus everything foreigners own in it: a country’s net worth against the rest of the world.', read: `Positive is a net creditor, negative a net debtor. Japan was ${P(f.earn.JPN?.niip, 'en', 0, true)} of GDP at the end of ${f.year}, Türkiye ${P(f.earn.TUR?.niip, 'en', 0, true)}. On the chart it is the bubble’s colour.`, calc: 'Gross external assets minus gross external liabilities at the last published quarter of the year, divided by GDP (BIS), from money-flow’s board. The board covers the 36 borrowers; for the United States, and for years before an economy’s board series starts, the same IMF gross positions over World Bank GDP.' }),
    ko: (f) => ({ term: '순대외금융자산(NIIP)', what: '대외금융자산에서 대외금융부채를 뺀 값입니다. 거주자가 해외에 보유한 자산에서 비거주자가 국내에 보유한 자산을 뺍니다. 한 나라가 세계에 대해 보유한 순자산입니다.', read: `양(+)이면 순채권국, 음(−)이면 순채무국입니다. ${f.year}년 말 일본은 GDP의 ${P(f.earn.JPN?.niip, 'ko', 0, true)}, 튀르키예는 ${P(f.earn.TUR?.niip, 'ko', 0, true)}였습니다. 그래프에서는 원의 색으로 나타냅니다.`, calc: '그해 마지막으로 공표된 분기의 대외금융자산에서 대외금융부채를 빼고 GDP(BIS)로 나눕니다. money-flow 신호판 값입니다. 신호판은 36개 차입 경제만 다룹니다. 미국과 신호판 시계열이 시작되기 전 연도는 같은 IMF 대외금융자산·부채를 세계은행 GDP로 나눕니다.' }),
  },
  gdp_pct: {
    src: (f, l) => [WDI(f, l, ['NY.GDP.MKTP.CD'])],
    en: (f) => ({ term: '% of GDP', what: 'A number divided by the economy’s annual output, so that a small and a large economy can be compared.', read: `A trade surplus of ${P(f.earn.KOR?.gs, 'en', 1)} of GDP means the surplus equals that share of everything Korea produced in ${f.year}. Stocks such as assets can exceed 100%.`, calc: 'Value in US dollars ÷ GDP in current US dollars of the same year × 100.' }),
    ko: (f) => ({ term: 'GDP 대비 %', what: '어떤 값을 그 나라의 1년 국내총생산(GDP)으로 나눈 비율입니다. 경제 규모가 다른 나라를 같은 기준으로 비교합니다.', read: `흑자가 GDP의 ${P(f.earn.KOR?.gs, 'ko', 1)}라면 흑자 규모가 ${f.year}년 한국 GDP의 그만큼이라는 뜻입니다. 자산 같은 잔액은 100%를 넘을 수 있습니다.`, calc: '달러 값 ÷ 같은 해 경상 달러 GDP × 100' }),
  },
  gdp_pc: {
    src: (f, l) => [WDI(f, l, ['NY.GDP.PCAP.CD'])],
    en: (f) => ({ term: 'GDP per capita', what: 'Annual output per resident in current US dollars: a rough measure of how rich an economy is.', read: `Korea’s was $${num(f.earn.KOR?.pc, 'en', 0)} in ${f.year}, Norway’s $${num(f.earn.NOR?.pc, 'en', 0)}. It moves with the exchange rate as well as with output.`, calc: 'GDP in current US dollars ÷ mid-year population.' }),
    ko: (f) => ({ term: '1인당 GDP', what: '한 해 GDP를 인구로 나눈 값입니다. 경상 달러 기준입니다. 한 나라의 소득 수준을 대략 나타냅니다.', read: `${f.year}년 한국은 ${num(f.earn.KOR?.pc, 'ko', 0)}달러, 노르웨이는 ${num(f.earn.NOR?.pc, 'ko', 0)}달러였습니다. 생산뿐 아니라 환율에 따라서도 움직입니다.`, calc: '경상 달러 GDP ÷ 연앙 인구' }),
  },
  band: {
    src: (f, l) => [WDI(f, l, ['BN.GSR.GNFS.CD', 'BN.GSR.FCTY.CD', 'NY.GDP.MKTP.CD'])],
    en: (f) => ({ term: `The ±${f.band}% band`, what: `The shaded cross on the chart. A balance between −${f.band}% and +${f.band}% of GDP counts as not earning on that axis.`, read: 'It keeps a surplus of a few tenths of a per cent from deciding the quadrant: an economy just inside the band is neither earning nor paying out on that line.', calc: `Fixed at ${f.band}% of GDP before the view was built; it is not fitted.` }),
    ko: (f) => ({ term: `±${f.band}% 띠`, what: `그래프의 옅은 십자 띠입니다. GDP의 −${f.band}%와 +${f.band}% 사이 수지는 그 축에서 흑자도 적자도 아닌 것으로 봅니다.`, read: '0.몇 % 수준의 흑자가 사분면을 가르지 않게 하려는 장치입니다. 띠 안의 경제는 그 항목에서 흑자도 적자도 아닌 것으로 읽습니다.', calc: `화면을 만들기 전에 GDP의 ${f.band}%로 정했습니다. 자료에 맞춰 고른 값이 아닙니다.` }),
  },
  exports: {
    src: (f, l) => [WDI(f, l, ['BX.GSR.GNFS.CD', 'NY.GDP.MKTP.CD'])],
    en: (f) => ({ term: 'Exports of goods and services (gross)', what: 'Everything an economy sells abroad in a year, goods and services together, before subtracting what it buys.', read: `It shows scale, which the net balance hides. In ${f.year} the United States exported $${num(f.earn.USA?.xu, 'en', 0)} bn, ${P(f.earn.USA?.xg, 'en', 0)} of its GDP; Germany ${P(f.earn.DEU?.xg, 'en', 0)} and Korea ${P(f.earn.KOR?.xg, 'en', 0)}. A large share of GDP marks an open economy, a large dollar sum a big exporter.`, calc: 'Balance-of-payments exports of goods and services in current US dollars; as a share, divided by GDP.' }),
    ko: (f) => ({ term: '총수출', what: '한 해 동안의 상품·서비스 수출액을 모두 더한 값입니다. 수입을 빼기 전의 규모입니다.', read: `순수지로는 알 수 없는 규모를 나타냅니다. ${f.year}년 미국은 ${josa(bn(f.earn.USA?.xu, 'ko'), '을')} 수출했고 GDP의 ${P(f.earn.USA?.xg, 'ko', 0)}였습니다. 독일은 ${P(f.earn.DEU?.xg, 'ko', 0)}, 한국은 ${P(f.earn.KOR?.xg, 'ko', 0)}였습니다. GDP 대비 비율이 크면 대외개방도가 높습니다. 달러 금액이 크면 수출 대국입니다.`, calc: '국제수지 기준 상품·서비스 수출, 경상 달러. 비율은 GDP로 나눈 값입니다.' }),
  },
  imports: {
    src: (f, l) => [WDI(f, l, ['BM.GSR.GNFS.CD', 'NY.GDP.MKTP.CD'])],
    en: (f) => ({ term: 'Imports of goods and services (gross)', what: 'Everything an economy buys from abroad in a year, goods and services together.', read: `Japan’s imports were ${P(f.earn.JPN?.mg, 'en', 1)} of GDP in ${f.year} against exports of ${P(f.earn.JPN?.xg, 'en', 1)}: both large, so the net balance is close to zero.`, calc: 'Balance-of-payments imports of goods and services in current US dollars; as a share, divided by GDP.' }),
    ko: (f) => ({ term: '총수입', what: '한 해 동안의 상품·서비스 수입액을 모두 더한 값입니다.', read: `${f.year}년 일본의 수입은 GDP의 ${P(f.earn.JPN?.mg, 'ko', 1)}, 수출은 ${P(f.earn.JPN?.xg, 'ko', 1)}였습니다. 둘 다 크기 때문에 순수지는 0에 가깝습니다.`, calc: '국제수지 기준 상품·서비스 수입, 경상 달러. 비율은 GDP로 나눈 값입니다.' }),
  },
  assets: {
    src: (f, l) => [{ src: 'imf.iip', series: ['IIP total assets / liabilities'], period: qs(f, l) }, WDI(f, l, ['NY.GDP.MKTP.CD'])],
    en: (f) => ({ term: 'Gross external assets', what: 'Everything residents own abroad: shares and bonds, factories, loans and deposits, central bank reserves.', read: `It measures a financial footprint. The United Kingdom held ${P(f.earn.GBR?.fag, 'en', 0)} of its GDP abroad at the end of ${f.year}, Korea ${P(f.earn.KOR?.fag, 'en', 0)}. A London-sized balance sheet can sit on a net position close to zero.`, calc: 'IMF IIP total assets at the last published quarter of the year, US dollars; as a share, divided by WDI GDP.' }),
    ko: (f) => ({ term: '대외금융자산', what: '거주자가 해외에 보유한 금융자산 전체입니다. 주식과 채권, 해외 공장(직접투자), 대출과 예금, 중앙은행의 외환보유액을 포함합니다.', read: `대외 금융거래의 규모를 나타냅니다. ${f.year}년 말 영국은 GDP의 ${P(f.earn.GBR?.fag, 'ko', 0)}, 한국은 ${josa(P(f.earn.KOR?.fag, 'ko', 0), '을')} 해외에 보유했습니다. 영국처럼 대차대조표가 커도 순자산은 0에 가까울 수 있습니다.`, calc: '그해 마지막으로 공표된 분기의 IMF IIP 총자산(달러)입니다. 비율은 WDI GDP로 나눈 값입니다.' }),
  },
  liabilities: {
    src: (f, l) => [{ src: 'imf.iip', series: ['IIP total assets / liabilities'], period: qs(f, l) }, WDI(f, l, ['NY.GDP.MKTP.CD'])],
    en: (f) => ({ term: 'Gross external liabilities', what: 'Everything foreigners own in the economy: its shares and bonds they hold, their factories in it, the loans and deposits they made to it.', read: `The United States owed ${P(f.earn.USA?.flg, 'en', 0)} of GDP to foreigners at the end of ${f.year} against assets of ${P(f.earn.USA?.fag, 'en', 0)}: the world holds its Treasuries and shares.`, calc: 'IMF IIP total liabilities at the last published quarter of the year, US dollars; as a share, divided by WDI GDP.' }),
    ko: (f) => ({ term: '대외금융부채', what: '비거주자가 그 나라에 보유한 금융자산 전체입니다. 외국인이 보유한 주식과 채권, 외국인이 세운 공장(직접투자), 외국인의 대출과 예금을 포함합니다.', read: `${f.year}년 말 미국의 대외금융부채는 GDP의 ${P(f.earn.USA?.flg, 'ko', 0)}, 대외금융자산은 ${P(f.earn.USA?.fag, 'ko', 0)}였습니다. 세계가 미 국채와 미국 주식을 보유하고 있기 때문입니다.`, calc: '그해 마지막으로 공표된 분기의 IMF IIP 총부채(달러)입니다. 비율은 WDI GDP로 나눈 값입니다.' }),
  },
  diag: {
    src: (f, l) => [WDI(f, l, ['BX.GSR.GNFS.CD', 'BM.GSR.GNFS.CD']), { src: 'imf.iip', period: qs(f, l) }],
    en: () => ({ term: 'The 45° line', what: 'The diagonal where the two axes are equal: exports equal imports, or assets equal liabilities.', read: 'Below the line, the across-axis value is larger (a trade surplus, a net creditor); above it, the up-axis value is. On a linear scale the distance straight down or straight across to the line is the net balance; on a log scale it shows the ratio instead.', calc: 'y = x, drawn on axes that share one scale.' }),
    ko: () => ({ term: '45도 선', what: '두 축의 값이 같은 대각선입니다. 수출과 수입이, 또는 자산과 부채가 같은 지점입니다.', read: '선 아래는 가로축 값이 큽니다(교역 흑자, 순채권국). 선 위는 세로축 값이 큽니다. 일반 눈금에서는 점에서 선까지의 수직 또는 수평 거리가 순수지입니다. 로그 눈금에서는 이 거리가 두 값의 비율을 나타냅니다.', calc: 'y = x. 두 축은 같은 눈금을 씁니다.' }),
  },
  log: {
    src: (f, l) => [{ src: 'imf.iip', period: qs(f, l) }],
    en: (f) => ({ term: 'Log scale', what: 'An axis where each step multiplies the value by the same factor (10%, 100%, 1,000%) instead of adding the same amount.', read: `The United Kingdom’s assets of ${P(f.earn.GBR?.fag, 'en', 0)} of GDP and China’s ${P(f.earn.CHN?.fag, 'en', 0)} both fit on one chart. Equal gaps mean equal ratios.`, calc: 'Positions are drawn at log10 of the value.' }),
    ko: (f) => ({ term: '로그 눈금', what: '눈금마다 같은 양을 더하지 않고 같은 배수를 곱하는 축입니다(10%, 100%, 1,000%).', read: `GDP의 ${josa(P(f.earn.GBR?.fag, 'ko', 0), '인')} 영국의 대외금융자산과 ${josa(P(f.earn.CHN?.fag, 'ko', 0), '인')} 중국의 대외금융자산이 한 그래프에 들어갑니다. 같은 간격은 같은 배율을 뜻합니다.`, calc: '값의 상용로그(log10) 위치에 그립니다.' }),
  },
  hhi: {
    src: (f, l) => TRADE(f, l),
    en: (f) => ({ term: 'Export market concentration (destination HHI)', what: 'How concentrated an economy’s exports are on a few buyers, from 0 to 1.', read: `Near 0, sales are spread over many markets; near 1, one buyer takes almost everything. Japan ${num(f.panel.JPN?.hm, 'en', 2)}: its exports are spread evenly across many economies. Mexico ${num(f.panel.MEX?.hm, 'en', 2)}: most of its goods go to the United States.`, calc: 'The sum of the squared shares of each destination in the economy’s goods exports (Herfindahl–Hirschman index).' }),
    ko: (f) => ({ term: '수출 시장 집중도(수출처 HHI)', what: '수출이 소수 상대국에 얼마나 집중됐는지를 0에서 1 사이 값으로 나타낸 지표입니다.', read: `0에 가까우면 수출이 여러 시장에 고르게 분산돼 있습니다. 1에 가까우면 수출이 거의 한 나라로 향합니다. 일본(${num(f.panel.JPN?.hm, 'ko', 2)})은 수출처가 여러 나라에 고르게 분산돼 있습니다. 멕시코(${num(f.panel.MEX?.hm, 'ko', 2)})는 상품 수출 대부분이 미국으로 향합니다.`, calc: '상품 수출에서 수출처별 비중을 제곱해 모두 더합니다(허핀달-허쉬만 지수).' }),
  },
  x_share: {
    src: (f, l) => TRADE(f, l),
    en: (f) => ({ term: 'Share of world exports', what: 'An economy’s goods exports as a share of world goods trade in the same 12 months.', read: `Japan reads ${P(f.panel.JPN?.x_share, 'en', 1)} here. The share is built from what partners record as imports (valued with freight and insurance) over the world trade recorded so far, so while recent months are not all filed it runs above the WTO’s figure, which puts Japan near 3%.`, calc: 'Partner-recorded goods imports from the economy ÷ the sum of all recorded flows in the window, × 100.' }),
    ko: (f) => ({ term: '세계 수출 비중', what: '같은 12개월 동안 세계 상품 교역에서 이 경제의 상품 수출이 차지하는 비중입니다.', read: `여기서 일본은 ${josa(P(f.panel.JPN?.x_share, 'ko', 1), '입니다')}. 상대국이 수입으로 계상한 값(운임·보험 포함)을 지금까지 신고된 세계 교역으로 나눠 산출합니다. 최근 몇 달의 신고가 끝나지 않은 동안에는 WTO 수치보다 높게 나옵니다. WTO 기준 일본은 3% 내외입니다.`, calc: '상대국이 계상한 이 경제로부터의 상품 수입 ÷ 12개월 창 안에 신고된 교역 합계 × 100' }),
  },
  chokepoint: {
    src: (f, l) => [{ src: 'comtrade', period: l === 'ko' ? `${f.choke?.year}년, 연간` : `${f.choke?.year}, annual` }, { src: 'doj.hmg' }],
    en: (f) => ({ term: 'Chokepoint', what: 'The one stage of a supply chain where world exports are most concentrated in a few economies, so that losing one supplier hurts most.', read: f.choke ? `In ${f.choke.year}, ${N(f.choke.eco, 'en')} supplied ${P(f.choke.share, 'en', 0)} of world exports of ${f.choke.stage.en.toLowerCase()} in the ${f.choke.chain.en.toLowerCase()} chain (HHI ${num(f.choke.hhi, 'en', 2)}). “Largest exporter of the chokepoint stage” names that economy.` : 'No chain has a chokepoint in this build.', calc: 'Among stages trading at least $1 bn a year, the one with the highest exporter HHI, flagged only above 0.25 (the US merger guidelines’ “highly concentrated” line).' }),
    ko: (f) => ({ term: '병목', what: '공급망 단계 가운데 세계 수출이 소수 국가에 가장 집중된 단계입니다. 공급국 하나가 이탈하면 공급 차질이 가장 큽니다.', read: f.choke ? `${f.choke.year}년 ${josa(N(f.choke.eco, 'ko'), '이가')} ${f.choke.chain.ko} 공급망의 ${f.choke.stage.ko} 세계 수출의 ${josa(P(f.choke.share, 'ko', 0), '을')} 차지했습니다(HHI ${num(f.choke.hhi, 'ko', 2)}). ‘병목 단계 최대 수출국’은 이 나라를 가리킵니다.` : '이번 계산에는 병목이 있는 공급망이 없습니다.', calc: '연 10억 달러 넘게 거래되는 단계 가운데 수출국 HHI가 가장 높은 단계입니다. 0.25(미국 합병 지침의 ‘고집중’ 기준)를 넘을 때만 표시합니다.' }),
  },
  a1: {
    src: (f, l) => [{ src: 'bis.lbs', period: qs(f, l) }, { src: 'bis.dss', period: qs(f, l) }, { src: 'bis.tc', period: qs(f, l) }, { src: 'bis.gli' }],
    en: (f) => ({ term: 'Foreign-currency credit to non-banks (A1)', what: 'How much firms, governments and households outside banks owe in dollars, euros and yen, against the size of the economy.', read: `Higher means more debt that must be repaid in a currency the economy cannot print. Türkiye ${P(f.panel.TUR?.a1, 'en', 1)} of GDP, Korea ${P(f.panel.KOR?.a1, 'en', 1)}. It is one of the two exposure parts of V.`, calc: `Cross-border bank loans to non-banks and their international bonds in USD, EUR and JPY (the own currency left out), plus local foreign-currency bank credit where reported, ÷ GDP. It follows the BIS global liquidity indicators’ definition but is built from LBS and DSS (money-flow method ${f.method}).` }),
    ko: (f) => ({ term: '비은행 외화신용(A1)', what: '은행이 아닌 기업·정부·가계의 달러·유로·엔 표시 채무를 경제 규모(GDP)와 비교한 비율입니다.', read: `이 값이 높을수록 자국이 발행할 수 없는 통화로 상환해야 할 채무가 많습니다. 튀르키예는 GDP의 ${P(f.panel.TUR?.a1, 'ko', 1)}, 한국은 ${P(f.panel.KOR?.a1, 'ko', 1)}입니다. V의 노출 항목은 둘이며, 이 값은 그중 하나입니다.`, calc: '비은행 앞 국경 간 은행 대출과 비은행이 발행한 미 달러·유로·엔화 표시 국제채권(자국 통화 표시분 제외)을 더합니다. 자료가 있으면 국내 은행의 외화 신용도 더한 뒤 GDP로 나눕니다. BIS 글로벌 유동성 지표의 정의를 따르되 LBS와 DSS로 산출합니다(money-flow 방법론 {method}).' }),
  },
  a2: {
    src: (f, l) => [{ src: 'bis.cbs', period: qs(f, l) }, { src: 'imf.irfcl', period: qs(f, l) }],
    en: (f) => ({ term: 'A2: BIS banks’ claims due within a year ÷ reserve base', what: 'Claims of BIS reporting banks on the economy that fall due within a year (remaining maturity, all sectors, local foreign-currency claims included), against the reserves the central bank can actually use.', read: `Above 100%, a year of bank debt exceeds usable reserves. Türkiye ${P(f.board.TUR?.a2, 'en', 0)}, Korea ${P(f.board.KOR?.a2, 'en', 0)}. Shown but not scored for reserve-currency issuers and economies with a standing Fed swap line.`, calc: 'BIS consolidated international claims with up to one year to maturity (bank type 4O) ÷ A2’s reserve base × 100. The reserve base is net reserves (IMF IRFCL reserves minus predetermined drains within a year) but never less than a tenth of gross reserves, so the ratio stays finite; a floored quarter is flagged, and the floor is used only in A2.' }),
    ko: (f) => ({ term: 'A2: BIS 보고은행의 1년 이내 만기 청구권 ÷ 외환보유액 기준', what: '해당 경제가 BIS 보고은행에 진 채무 가운데 1년 안에 만기가 돌아오는 금액(잔존만기 기준, 모든 부문, 현지 외화 청구권 포함)을 중앙은행이 실제로 쓸 수 있는 외환보유액과 비교합니다.', read: `100%를 넘으면 1년 안에 상환해야 할 은행 차입이 가용 외환보유액보다 많습니다. 튀르키예는 ${P(f.board.TUR?.a2, 'ko', 0)}, 한국은 ${P(f.board.KOR?.a2, 'ko', 0)}입니다. 기축통화국과 연준 상설 통화스왑이 있는 나라는 표시만 하고 점수에는 넣지 않습니다.`, calc: '잔존만기 1년 이하 BIS 연결기준 국제 청구권(은행 유형 4O) ÷ A2 외환보유액 기준 × 100입니다. 외환보유액 기준은 순외환보유액(IMF IRFCL 외환보유액에서 1년 이내 확정된 외화 유출을 뺀 값)입니다. 다만 비율이 무한히 커지지 않도록 총외환보유액의 10분의 1을 하한으로 둡니다. 하한이 적용된 분기는 따로 표시하며, 하한은 A2에만 씁니다.' }),
  },
  a3: {
    src: (f, l) => [{ src: 'bis.dss', period: qs(f, l) }, { src: 'bis.lbs', period: qs(f, l) }],
    en: (f) => ({ term: 'Bond dependence (A3)', what: 'How much of an economy’s foreign funding comes from bonds rather than bank loans.', read: `Bond investors can sell quickly in a panic; banks tend to roll over. Korea ${P(f.board.KOR?.a3, 'en', 0)}, Japan ${P(f.board.JPN?.a3, 'en', 0)}.`, calc: 'International debt securities ÷ (securities + cross-border bank loans) × 100.' }),
    ko: (f) => ({ term: '채권 의존도(A3)', what: '대외 자금 가운데 은행 대출이 아닌 채권으로 조달한 비중입니다.', read: `위기 때 채권 투자자는 빠르게 매도하지만 은행은 대출을 연장(차환)하는 경향이 있습니다. 한국은 ${P(f.board.KOR?.a3, 'ko', 0)}, 일본은 ${P(f.board.JPN?.a3, 'ko', 0)}입니다.`, calc: '국제채 ÷ (국제채 + 국경 간 은행 대출) × 100' }),
  },
  net_reserves: {
    src: (f, l) => [{ src: 'imf.irfcl', period: qs(f, l) }],
    en: (f) => ({ term: 'Net reserves', what: 'The central bank’s foreign-currency reserves after the payments it has already committed within a year (forward sales, loans due).', read: `They are the first cushion when foreign funding leaves. Korea’s were ${bn(f.board.KOR?.res_net, 'en')} in ${quarter(f.q, 'en')}.`, calc: 'IMF IRFCL Section I (official reserve assets) minus Section II (predetermined net drains within a year).' }),
    ko: (f) => ({ term: '순외환보유액', what: '중앙은행의 외환보유액에서 1년 안에 지급하기로 이미 정해진 금액(선물환 매도, 만기도래 차입)을 뺀 값입니다.', read: `대외 자금이 유출될 때 가장 먼저 쓰는 완충 수단입니다. ${quarter(f.q, 'ko')} 한국은 ${bn(f.board.KOR?.res_net, 'ko')}였습니다.`, calc: 'IMF IRFCL I절(공식 준비자산) − II절(1년 안에 예정된 순유출)' }),
  },
  ca: {
    src: (f, l) => [{ src: 'imf.bop', period: qs(f, l) }, { src: 'bis.tc', period: qs(f, l) }],
    en: (f) => ({ term: 'Current account', what: 'The trade balance plus primary and secondary income: whether an economy as a whole spends less (surplus) or more (deficit) than it earns abroad.', read: `A deficit must be funded from abroad every year. Korea ${P(f.board.KOR?.ca, 'en', 1, true)} of GDP, Türkiye ${P(f.board.TUR?.ca, 'en', 1, true)}. It is one of V’s buffers.`, calc: 'IMF BOP current account balance ÷ GDP (BIS), as money-flow’s board computes it.' }),
    ko: (f) => ({ term: '경상수지', what: '상품·서비스 수지에 본원소득수지와 이전소득수지를 더한 값입니다. 한 나라 전체가 해외에서 벌어들인 소득보다 덜 지출하는지(흑자) 더 지출하는지(적자)를 나타냅니다.', read: `적자는 해마다 해외 자금으로 메워야 합니다. 한국은 GDP의 ${P(f.board.KOR?.ca, 'ko', 1, true)}, 튀르키예는 ${P(f.board.TUR?.ca, 'ko', 1, true)}입니다. V의 완충 항목 가운데 하나입니다.`, calc: 'IMF 국제수지의 경상수지 ÷ GDP(BIS). money-flow 신호판의 계산 그대로입니다.' }),
  },
  borrowing: {
    src: (f, l) => MONEY(f, l),
    en: (f) => ({ term: 'Borrowing economy', what: `One of the ${f.n} economies on money-flow’s Signal Board: economies that take in foreign bank and bond funding and could see it leave. The United States, the hub of the dollar system, is not one.`, read: 'Being on the list says nothing about risk by itself: Japan and Norway are on it. V and F say how exposed each is and whether funding is coming or going.', calc: 'Money-flow’s board rule: economies with BIS and IMF coverage, Korea first.' }),
    ko: (f) => ({ term: '차입 경제', what: `money-flow 신호판의 ${f.n}개 경제 가운데 하나입니다. 외국 은행 대출과 채권으로 자금을 조달하고, 그 자금이 유출될 수 있는 경제입니다. 달러 체제의 중심인 미국은 포함하지 않습니다.`, read: '목록에 있다고 위험하다는 뜻은 아닙니다. 일본과 노르웨이도 목록에 있습니다. 노출 정도는 V가, 자금이 유입되는지 유출되는지는 F가 나타냅니다.', calc: 'money-flow 신호판 규칙. BIS와 IMF 통계가 갖춰진 신호판 경제, 한국부터.' }),
  },
  withdrawal: {
    src: (f, l) => [{ src: 'bis.lbs', period: qs(f, l) }, { src: 'bis.dss', period: qs(f, l) }],
    en: (f) => ({ term: 'Funding withdrawal (bank and bond)', what: 'Foreign funding that left an economy in a quarter, split into bank loans and deposits pulled by foreign banks and international bonds repaid without new issues.', read: `${N(f.top[0], 'en')} saw the largest in ${quarter(f.q, 'en')}: ${bn(f.top[1], 'en', true)}, of which banks ${bn(f.top[2], 'en', true)} and bonds ${bn(f.top[3], 'en', true)}. For financial centres the bank part is mostly bank-to-bank positions.`, calc: 'B1: change in BIS LBS cross-border loans and deposits (exchange-rate and break adjusted). B2: BIS DSS net issues of international bonds. Both USD bn in the quarter.' }),
    ko: (f) => ({ term: '자금 유출(은행·채권)', what: '한 분기에 유출된 대외 자금입니다. 외국 은행이 회수한 대출·예금과, 차환하지 않고 상환한 국제채로 나눕니다.', read: `${quarter(f.q, 'ko')}에는 ${N(f.top[0], 'ko')}의 유출이 가장 컸습니다. 모두 ${bn(f.top[1], 'ko', true)}이며, 은행이 ${bn(f.top[2], 'ko', true)}, 채권이 ${bn(f.top[3], 'ko', true)}입니다. 국제금융중심지라면 은행 몫은 대부분 은행 간 거래입니다.`, calc: 'B1은 BIS LBS 국경 간 대출·예금의 변동(환율·단절 조정)입니다. B2는 BIS DSS 국제채 순발행입니다. 둘 다 분기중 달러 금액입니다.' }),
  },
  v: {
    src: (f, l) => MONEY(f, l),
    en: (f) => ({ term: 'Vulnerability score V', what: 'A 0–100 score of how exposed an economy is if foreign funding stops: half exposure (A1, A2), half missing buffers (net IIP, current account).', read: `60 or more is the at-risk range. Türkiye ${num(f.board.TUR?.v, 'en', 0)}, Korea ${num(f.board.KOR?.v, 'en', 0)} in ${quarter(f.q, 'en')}. Against past stress episodes it reaches an AUROC of ${num(f.aurocV, 'en', 2)} in this build.`, calc: `V = ½ exposure (A1, A2) + ½ buffers (net IIP, current account), each part scored 0–100 as money-flow method ${f.method} sets out. Nothing is recomputed here.` }),
    ko: (f) => ({ term: '취약성 점수 V', what: '대외 자금 유입이 중단될 때 얼마나 취약한지를 0~100으로 나타낸 점수입니다. 절반은 노출(A1, A2), 절반은 완충력 부족(순대외금융자산, 경상수지)입니다.', read: `60 이상이 위험 구간입니다. ${quarter(f.q, 'ko')} 튀르키예 ${num(f.board.TUR?.v, 'ko', 0)}, 한국 ${num(f.board.KOR?.v, 'ko', 0)}입니다. 과거 위기 사례로 검증하면 이번 계산의 AUROC는 ${num(f.aurocV, 'ko', 2)}입니다.`, calc: 'V = ½ 노출(A1, A2) + ½ 완충(순대외금융자산, 경상수지)입니다. 각 부분은 money-flow 방법론 {method}에 따라 0~100점으로 평가합니다. 여기서는 다시 계산하지 않습니다.' }),
  },
  f: {
    src: (f, l) => [{ src: 'bis.lbs', period: qs(f, l) }, { src: 'bis.dss', period: qs(f, l) }],
    en: (f) => ({ term: 'Flow score F', what: 'Whether foreign bank and bond funding is coming in or leaving, as a yearly rate of the funding stock.', read: `Above zero, funding comes in; below zero, it leaves. Japan ${num(f.board.JPN?.f, 'en', 1, true)}, Korea ${num(f.board.KOR?.f, 'en', 1, true)} in ${quarter(f.q, 'en')}.`, calc: 'F = 400 × (B1 + B2) ÷ the stock of cross-border bank loans and international bonds: the quarter’s flow, annualised, in %.' }),
    ko: (f) => ({ term: '흐름 점수 F', what: '외국 은행·채권 자금이 유입되는지 유출되는지를 잔액 대비 연율로 나타낸 값입니다.', read: `0보다 크면 순유입, 작으면 순유출입니다. ${quarter(f.q, 'ko')} 일본 ${num(f.board.JPN?.f, 'ko', 1, true)}, 한국 ${num(f.board.KOR?.f, 'ko', 1, true)}입니다.`, calc: 'F = 400 × (B1 + B2) ÷ 국경 간 은행 대출과 국제채 잔액입니다. 분기 흐름을 연율로 바꾼 %입니다.' }),
  },
  at_risk: {
    src: (f, l) => MONEY(f, l),
    en: (f) => ({ term: 'At-risk quadrant', what: 'Economies with a high vulnerability score (V ≥ 60) while funding is leaving (F < 0) in the same quarter.', read: f.atRisk.length ? `In ${quarter(f.q, 'en')}: ${f.atRisk.map((c) => N(c, 'en')).join(', ')}. A high score alone is a weakness; with funding leaving it is a warning.` : `No economy is in it in ${quarter(f.q, 'en')}.`, calc: `V from money-flow method ${f.method} at or above 60 and F below zero, latest quarter.` }),
    ko: (f) => ({ term: '위험 사분면', what: '취약성 점수가 높으면서(V 60 이상) 같은 분기에 자금이 순유출되는(F 0 미만) 경제입니다.', read: f.atRisk.length ? `${quarter(f.q, 'ko')}에는 ${josa(f.atRisk.map((c) => N(c, 'ko')).join(', '), '이가')} 없습니다. 점수만 높으면 취약 요인이며, 자금까지 유출되면 경고 신호입니다.` : `${quarter(f.q, 'ko')}에는 해당 경제가 없습니다.`, calc: '최근 분기에 money-flow 방법론 {method} 기준 V가 60 이상이고 F가 0 미만인 경우입니다.' }),
  },
  dollar_index: {
    src: (f, l) => [{ src: 'fred', series: ['DTWEXBGS'], period: wk(f, l) }],
    en: (f) => ({ term: 'Broad dollar index (Jan 2006 = 100)', what: 'The value of the US dollar against the currencies of the main US trading partners, set to 100 in January 2006.', read: `Higher means a stronger dollar, which makes dollar debt heavier for borrowers abroad. ${num(f.dollar?.[1], 'en', 1)} on ${day(f.dollar?.[0], 'en')}: about ${num(f.dollar ? f.dollar[1] - 100 : null, 'en', 0)}% stronger than in January 2006.`, calc: 'Federal Reserve H.10, trade-weighted nominal index; the site shows the weekly mean.' }),
    ko: (f) => ({ term: '달러 지수(2006년 1월 = 100)', what: '미국의 주요 교역상대국 통화에 대한 달러 가치를 2006년 1월 = 100로 산출한 지수입니다.', read: `지수가 상승하면 달러가 강세이며, 해외 차입자의 달러 부채 부담이 커집니다. ${day(f.dollar?.[0], 'ko')} ${num(f.dollar?.[1], 'ko', 1)} 기준 달러 가치는 2006년 1월보다 약 ${num(f.dollar ? f.dollar[1] - 100 : null, 'ko', 0)}% 높습니다.`, calc: '미국 연준 H.10의 교역가중 명목지수입니다. 이 사이트는 주간 평균을 씁니다.' }),
  },
  swap_lines: {
    src: (f, l) => [{ src: 'fred', series: ['SWPT'], period: wk(f, l) }],
    en: (f) => ({ term: 'Fed swap lines', what: 'Dollars the Federal Reserve lends to other central banks against their own currency, so they can lend dollars to their banks in a squeeze.', read: `Near zero in calm times; they jumped to about $450 bn in 2020. ${bn(f.swap?.[1], 'en')} on ${day(f.swap?.[0], 'en')}.`, calc: 'Federal Reserve H.4.1, central bank liquidity swaps, Wednesday level.' }),
    ko: (f) => ({ term: '연준 통화스왑', what: '미국 연준이 다른 중앙은행의 통화를 받고 달러를 공급하는 계약입니다. 달러 유동성이 부족할 때 각국 중앙은행은 이 달러를 자국 은행에 공급합니다.', read: `평소에는 0에 가깝고 2020년에는 4,500억 달러 안팎까지 늘었습니다. ${day(f.swap?.[0], 'ko')} ${bn(f.swap?.[1], 'ko')}였습니다.`, calc: '미국 연준 H.4.1의 중앙은행 유동성 스왑(수요일 기준)' }),
  },
  custody: {
    src: (f, l) => [{ src: 'fred', series: ['WMTSECL1'], period: wk(f, l) }],
    en: (f) => ({ term: 'Foreign official Treasuries in Fed custody', what: 'US Treasury securities that foreign central banks and governments keep at the New York Fed.', read: `A fall can mean central banks are selling Treasuries to raise dollars, for instance to defend their currency. ${bn(f.custody?.[1], 'en')} on ${day(f.custody?.[0], 'en')}.`, calc: 'Federal Reserve H.4.1 memorandum item, marketable Treasuries held in custody for foreign official and international accounts, Wednesday level.' }),
    ko: (f) => ({ term: '연준 보관 외국 공공 미 국채', what: '외국 중앙은행과 정부가 뉴욕 연은에 보관한 미 국채입니다.', read: `감소하면 각국 중앙은행이 달러를 확보하려고 국채를 매도한다는 신호일 수 있습니다. 자국 통화 방어가 그 예입니다. ${day(f.custody?.[0], 'ko')} ${bn(f.custody?.[1], 'ko')}였습니다.`, calc: '미국 연준 H.4.1 참고항목. 외국 공공·국제기구 계정 보관 시장성 국채, 수요일 기준.' }),
  },
  tic: {
    src: (f, l) => [{ src: 'tic', series: ['slt_table1'], period: l === 'ko' ? `${month(Number(f.ticMonth.slice(0, 7).replace('-', '')), l)}까지, 월간` : `to ${month(Number(f.ticMonth.slice(0, 7).replace('-', '')), l)}, monthly` }],
    en: (f) => ({ term: 'Net foreign official purchases of US securities (TIC)', what: 'How many US long-term securities foreign central banks and governments bought, minus what they sold, in a month.', read: `Negative means official holders sold on balance. ${bn(f.tic?.[1], 'en', true)} in ${month(Number((f.tic?.[0] ?? '').slice(0, 7).replace('-', '')), 'en')}. It arrives about seven weeks after the month.`, calc: 'US Treasury TIC SLT table 1, foreign official rows, net purchases of long-term securities.' }),
    ko: (f) => ({ term: '외국 공공기관의 미국 증권 순매수(TIC)', what: '외국 중앙은행과 정부가 한 달 동안 매수한 미국 장기증권에서 매도한 금액을 뺀 값입니다.', read: `음(−)이면 공공 보유자가 순매도했다는 뜻입니다. ${month(Number((f.tic?.[0] ?? '').slice(0, 7).replace('-', '')), 'ko')} ${bn(f.tic?.[1], 'ko', true)}였습니다. 해당 월이 끝나고 약 7주 뒤에 공표됩니다.`, calc: '미 재무부 TIC SLT 표 1의 외국 공공부문 행, 장기증권 순매수' }),
  },
  world_mom: {
    src: (f, l) => TRADE(f, l),
    en: (f) => ({ term: 'World trade momentum', what: 'Whether world goods trade is growing: the last three months against the same three months a year earlier.', read: `Above zero, trade is growing. ${P(f.worldMom[1], 'en', 1, true)} in the three months to ${month(f.worldMom[0], 'en')}, with ${P(100 * f.worldMom[2], 'en', 0)} of the usual flows filed for the last month.`, calc: 'Sum of world flows in the 3-month window ÷ the same window a year earlier − 1, in %.' }),
    ko: (f) => ({ term: '세계 교역 모멘텀', what: '세계 상품 교역의 증가 여부를 나타냅니다. 최근 3개월을 1년 전 같은 3개월과 비교합니다.', read: `0보다 크면 교역이 증가하고 있습니다. ${month(f.worldMom[0], 'ko')}까지 3개월은 ${P(f.worldMom[1], 'ko', 1, true)}였습니다. 마지막 달은 평소 흐름의 ${josa(P(100 * f.worldMom[2], 'ko', 0), '을')} 신고했습니다.`, calc: '3개월 창의 세계 흐름 합계 ÷ 1년 전 같은 창 − 1(%)' }),
  },
  mom: {
    src: (f, l) => TRADE(f, l),
    en: () => ({ term: 'Export momentum (y/y)', what: 'Whether an economy’s goods exports are growing: the last 12 months against the 12 months a year earlier.', read: 'Above zero, exports grow. It is shown beside V and tested against the stress episodes, but it is not part of the score.', calc: '12-month export sum ÷ the 12-month sum of the window ending exactly twelve months earlier − 1, in %, at the economy’s own latest complete month; empty when either window is incomplete.' }),
    ko: () => ({ term: '수출 전년비(모멘텀)', what: '상품 수출의 증가 여부를 나타냅니다. 최근 12개월을 1년 전 12개월과 비교합니다.', read: '0보다 크면 수출이 증가하고 있습니다. V와 함께 표시하고 위기 사례로 검증하지만 점수에는 넣지 않습니다.', calc: '12개월 수출 합계를 정확히 12개월 전에 끝나는 12개월 창의 합계로 나눈 뒤 1을 뺀 값(%)입니다. 각 경제의 자료가 모두 갖춰진 최근 월을 기준으로 합니다. 두 창 가운데 하나라도 자료가 다 갖춰지지 않으면 비워 둡니다.' }),
  },
  window12: {
    src: (f, l) => TRADE(f, l),
    en: (f) => ({ term: '12-month window', what: 'Trade added up over the twelve months ending in a given month, so that seasons and a single odd month do not move the figure.', read: `The window to ${month(f.shown, 'en')} runs ${window12(f.shown, 'en')}. Every trade value on this site is a window, never a single month.`, calc: 'Sum of the twelve monthly flows ending in the month shown (trade-flow).' }),
    ko: (f) => ({ term: '12개월 창', what: '어떤 달까지 12개월 동안의 교역을 더한 값입니다. 계절성이나 이례적인 한 달이 수치를 흔들지 않게 합니다.', read: `${month(f.shown, 'ko')}까지의 창은 ${window12(f.shown, 'ko')}입니다. 이 사이트의 교역 값은 모두 12개월 합계이며 단월 값은 쓰지 않습니다.`, calc: '표시한 달로 끝나는 12개월 교역의 합계(trade-flow)' }),
  },
  filed: {
    src: (f, l) => TRADE(f, l),
    en: (f) => ({ term: 'Filed share', what: 'How much of an economy’s usual trade has already been reported for a month. Customs offices report with a lag of weeks to months.', read: `Below 90%, the economy’s line stops: the figure would be too incomplete. World: ${P(100 * f.worldMom[2], 'en', 0)} filed for ${month(f.worldMom[0], 'en')}.`, calc: 'Flows reported for the month ÷ the flows the same partners usually report, by value (trade-flow completeness).' }),
    ko: (f) => ({ term: '신고 비율', what: '어떤 달의 평소 교역 가운데 이미 신고된 비율입니다. 세관은 몇 주에서 몇 달 늦게 보고합니다.', read: `90%에 못 미치면 그 경제의 선이 멈춥니다. 수치가 너무 불완전하기 때문입니다. 세계는 ${month(f.worldMom[0], 'ko')}에 ${josa(P(100 * f.worldMom[2], 'ko', 0), '이')} 신고됐습니다.`, calc: '그 달 신고된 흐름 ÷ 같은 상대국들이 평소 신고하는 흐름, 금액 기준(trade-flow 완결도)' }),
  },
  partner: {
    src: (f, l) => TRADE(f, l),
    en: () => ({ term: 'Partner-reported or estimated', what: 'When an importer has not filed a month yet, the exporter’s own report of the same flow is used, scaled by the usual gap between the two reports.', read: 'Marked wherever it is used. Such values are revised when the importer files.', calc: 'Exporter’s report × the pair’s importer-to-exporter ratio of a year earlier (trade-flow’s splice rule).' }),
    ko: () => ({ term: '상대국 보고·추정값', what: '수입국이 아직 그 달을 신고하지 않았으면 수출국이 보고한 같은 흐름을 씁니다. 두 보고의 평소 차이만큼 조정합니다.', read: '사용한 곳마다 표시합니다. 수입국이 신고하면 수정합니다.', calc: '수출국 보고 × 1년 전 같은 쌍의 수입국/수출국 보고 비율(trade-flow의 접합 규칙)' }),
  },
  mirror: {
    src: (f, l) => TRADE(f, l),
    en: () => ({ term: 'Mirror ratio and divergence', what: 'Every flow is reported twice, by the exporter and by the importer. The mirror ratio is the importer’s figure over the exporter’s.', read: 'It usually sits a little above 1, because importers add freight and insurance. A divergence is a ratio outside the pair’s usual range: a sign of rerouting, misreporting or a statistical change, not proof of any.', calc: 'Importer’s report ÷ exporter’s report; flagged outside the pair’s usual band (trade-flow).' }),
    ko: () => ({ term: '거울 비율과 괴리', what: '교역 흐름은 수출국과 수입국이 각각 한 번씩 보고합니다. 거울 비율은 수입국 수치를 수출국 수치로 나눈 값입니다.', read: '수입국이 운임과 보험료를 더하므로 이 비율은 보통 1보다 조금 큽니다. 괴리는 이 비율이 그 쌍의 평소 범위를 벗어난 경우입니다. 우회수출, 신고 오류, 통계 변경의 신호일 수 있지만 증거는 아닙니다.', calc: '수입국 보고 ÷ 수출국 보고입니다. 그 쌍의 평소 범위를 벗어나면 표시합니다(trade-flow).' }),
  },
  hub: {
    src: (f, l) => [{ src: 'fred', series: ['SWPT'], period: wk(f, l) }],
    en: () => ({ term: 'Hub of the dollar system', what: 'The United States issues the dollar, in which most of the world borrows. It cannot run short of dollars the way a borrower can.', read: 'So it has no funding score here. It appears for trade, for how it earns, and on the pulse, which tracks the dollar plumbing.', calc: 'A rule of the site, not a measurement.' }),
    ko: () => ({ term: '달러 체제의 중심', what: '세계 차입의 대부분은 달러 표시이며, 미국은 그 달러를 발행합니다. 차입국과 달리 미국은 달러가 부족해질 수 없습니다.', read: '그래서 여기서는 자금 점수가 없습니다. 교역, 소득 구조, 그리고 달러 배관을 보는 맥박 타일에만 나타납니다.', calc: '측정값이 아니라 이 사이트의 규칙입니다.' }),
  },
  auroc: {
    src: (f, l) => MONEY(f, l),
    en: (f) => ({ term: 'AUROC', what: 'How well a warning score separates the quarters before a crisis from calm quarters.', read: `The chance that a randomly drawn pre-crisis quarter scores higher than a randomly drawn calm one. 0.5 is a coin toss, 1.0 perfect. V reaches ${num(f.aurocV, 'en', 2)} here; published early-warning scores sit around 0.6 to 0.8.`, calc: 'Area under the receiver operating characteristic curve, positives = four quarters before each named episode.' }),
    ko: (f) => ({ term: 'AUROC', what: '신호 점수가 위기 전 분기와 평온한 분기를 얼마나 잘 구별하는지를 측정합니다.', read: `위기 전 분기 하나와 평온한 분기 하나를 무작위로 뽑았을 때 위기 전 분기의 점수가 더 높을 확률입니다. 0.5면 동전 던지기, 1.0이면 완벽합니다. 여기서 V는 ${num(f.aurocV, 'ko', 2)}입니다. 연구 문헌의 조기경보 점수는 0.6~0.8 안팎입니다.`, calc: 'ROC 곡선 아래 면적입니다. 양성은 위기 사례마다 그 직전 네 분기입니다.' }),
  },
  episode: {
    src: (f, l) => [{ src: 'mf.episodes' }, ...MONEY(f, l).slice(0, 2)],
    en: () => ({ term: 'Stress episode', what: 'A dated quarter in which an economy’s external funding came under stress, from the 2008 crisis to Türkiye in 2021.', read: 'They are the yellow bands on funding charts and the test set for every warning signal. One, Q1 2020, is mechanical: every currency that fell 15% or more against the dollar.', calc: 'Nine named episodes, fixed by money-flow before any validation and kept unchanged since.' }),
    ko: () => ({ term: '위기 사례', what: '한 경제의 대외 자금조달이 압박을 받은 분기를 시점으로 정합니다. 2008년 금융위기부터 2021년 튀르키예까지 있습니다.', read: '자금 그래프의 노란 띠이며 모든 신호의 검증 집합입니다. 2020년 1분기는 기계적으로 정했습니다. 그 분기에 달러 대비 15% 넘게 절하된 통화 전부입니다.', calc: 'money-flow가 검증에 앞서 이름을 붙여 정해 둔 아홉 개 사례입니다. 그 뒤로 바꾸지 않았습니다.' }),
  },
  first_round: {
    src: (f, l) => [...MONEY(f, l).slice(0, 2), ...TRADE(f, l)],
    en: () => ({ term: 'First-round scenario', what: 'Arithmetic on published figures: a past share or a chosen cut applied to today’s positions, with nothing else allowed to move.', read: 'It gives the size of the first hit, not a forecast: prices stay put, nobody reacts, nothing is replaced.', calc: 'Share × today’s stock, or a supplier’s share spread over the others by their shares.' }),
    ko: () => ({ term: '1차 효과 시나리오', what: '공표된 수치로 하는 단순 계산입니다. 과거의 비율이나 선택한 삭감률을 현재 잔액에 곱하고 다른 변수는 고정합니다.', read: '1차 충격의 크기를 나타낼 뿐 전망이 아닙니다. 가격은 그대로이고 누구도 대응하지 않으며 대체도 없습니다.', calc: '비율 × 현재 잔액입니다. 또는 이탈한 공급국의 몫을 나머지 공급국에 비중대로 배분합니다.' }),
  },
  reporter: {
    src: (f, l) => [{ src: 'bis.lbs', period: qs(f, l) }],
    en: () => ({ term: 'Reporting banking system', what: 'All the banks located in one country that report to the BIS, whatever their nationality: “banks in the UK” include foreign banks’ London offices.', read: 'Offshore centres such as the UK or the Cayman Islands carry intragroup funding, so a large position there is not always a British lender.', calc: 'BIS locational banking statistics, residence basis.' }),
    ko: () => ({ term: '보고 은행 시스템', what: '한 나라에 있으면서 BIS에 보고하는 모든 은행입니다. 국적은 따지지 않습니다. ‘영국의 은행’에는 외국 은행의 런던 지점도 포함됩니다.', read: '영국이나 케이맨제도 같은 역외금융센터의 잔액에는 그룹 내부 자금이 포함됩니다. 따라서 그곳의 큰 잔액이 늘 영국계 은행의 대출은 아닙니다.', calc: 'BIS 소재지 기준 국제은행통계(LBS), 거주성 기준' }),
  },
  waves: {
    src: (f, l) => TRADE(f, l),
    en: () => ({ term: 'The three waves of a shock', what: 'How a supply shock spreads: wave 1 is the origin, wave 2 the economies that bought most from it, wave 3 the markets those buyers sell on to.', read: 'A later fall along an edge is shown, not explained: many things move at once.', calc: 'Picked once from the 12 months before the shock (config/shocks.yaml).' }),
    ko: () => ({ term: '충격의 세 파동', what: '공급 충격의 파급 경로입니다. 1파동은 진원지입니다. 2파동은 진원지에서 가장 많이 수입하던 경제입니다. 3파동은 그 경제들이 다시 수출하는 제3국 시장입니다.', read: '나중에 어떤 연결선이 줄어도 표시만 하고 원인을 단정하지 않습니다. 많은 요인이 한꺼번에 움직이기 때문입니다.', calc: '충격 직전 12개월 자료로 한 번 정합니다(config/shocks.yaml).' }),
  },
  stress_count: {
    src: (f, l) => [...MONEY(f, l).slice(0, 4), ...TRADE(f, l)],
    en: (f) => ({ term: 'Stress signal count', what: 'How many of the seven joint signals reach their threshold in a quarter. Each signal sets a funding quantity against a trade quantity.', read: `Read it at K, three by default. Korea counts ${num(f.stress?.count, 'en', 0)} in ${quarter(f.stress?.q, 'en')}. Against past funding episodes the count scores an AUROC of ${num(f.stress?.aurocCount, 'en', 3)}, V ${num(f.stress?.aurocV, 'en', 3)} on the same quarters: the difference is inside its interval.`, calc: 'Each signal fires or not at its threshold; the count sums the signals scored that quarter. Signals switched off or not scored do not count.' }),
    ko: (f) => ({ term: '스트레스 신호 수', what: '일곱 결합 신호 가운데 한 분기에 기준치에 도달한 신호의 수입니다. 신호마다 자금 수치와 교역 수치를 결합합니다.', read: `기준 K(기본값 3)로 읽습니다. ${quarter(f.stress?.q, 'ko')} 한국은 ${num(f.stress?.count, 'ko', 0)}개입니다. 과거 자금 위기 사례에서 신호 수의 AUROC는 ${num(f.stress?.aurocCount, 'ko', 3)}, 같은 분기의 V는 ${num(f.stress?.aurocV, 'ko', 3)}입니다. 둘의 차이는 오차 구간 안에 있습니다.`, calc: '신호마다 기준 도달 여부를 판정하고, 그 분기에 계산된 신호 가운데 도달한 신호를 집계합니다. 끈 신호와 계산되지 않은 신호는 집계하지 않습니다.' }),
  },
  g19: {
    src: (f, l) => MONEY(f, l).slice(0, 2),
    en: (f) => ({ term: 'Admission rule G19', what: 'The rule that decides whether a joint signal may enter a published composite score.', read: `A signal enters only if it separates pre-crisis quarters from calm ones better than the better of its two single-side inputs, with the 90% bootstrap interval of the gain above zero. ${f.stress?.admitted ? `${f.stress.admitted} signals passed.` : 'None of the seven passed in this build, so no composite is published.'}`, calc: 'AUROC of the signal minus the AUROC of its better single-side input, on the same economy-episodes and calm quarters; 1,000 bootstrap draws over economy-episodes.' }),
    ko: (f) => ({ term: '채택 규칙 G19', what: '결합 신호가 공표 종합 점수에 들어갈 수 있는지 정하는 규칙입니다.', read: `신호는 위기 전 분기와 평온한 분기를 자금 입력과 교역 입력 가운데 나은 쪽보다 더 잘 구별해야 들어갑니다. 그 차이의 90% 부트스트랩 구간이 0보다 위여야 합니다. ${f.stress?.admitted ? `${f.stress.admitted}개 신호가 통과했다.` : '이번 계산에서는 일곱 신호 모두 통과하지 못했다. 그래서 종합 점수는 공표하지 않는다.'}`, calc: '같은 경제×사례와 평온한 분기에서 신호의 AUROC에서 둘 중 나은 입력의 AUROC를 뺀 값을 구합니다. 경제×사례를 1,000번 복원 추출해 구간을 산출합니다.' }),
  },
  channel_first: {
    src: (f, l) => [...MONEY(f, l).slice(0, 2), ...TRADE(f, l)],
    en: () => ({ term: 'Channel first', what: 'Which channel would hit first: funding, trade or both, read from the leading signal.', read: 'Funding if J2 or J3 lead, trade if J4, J6 or J7 lead, both if J1 or J5 lead. The leading signal is the fired one ranked highest among all board economy-quarters; with none fired, the highest-ranked signal.', calc: 'Each signal’s rank is the share of every board economy-quarter so far at or below its value.' }),
    ko: () => ({ term: '먼저 영향받을 경로', what: '자금, 교역, 양쪽 가운데 어느 경로로 충격이 먼저 올지를 선행 신호로 판단합니다.', read: 'J2나 J3가 앞서면 자금, J4·J6·J7이 앞서면 교역, J1이나 J5가 앞서면 양쪽입니다. 선행 신호는 기준에 도달한 신호 가운데 전체 경제×분기 순위가 가장 높은 신호입니다. 도달한 신호가 없으면 순위가 가장 높은 신호입니다.', calc: '신호의 순위는 지금까지 신호판의 모든 경제×분기 가운데 그 값 이하인 비율입니다.' }),
  },
  import_cover: {
    src: (f, l) => [{ src: 'imf.irfcl', period: qs(f, l) }, ...TRADE(f, l)],
    en: (f) => ({ term: 'J1 · Import cover', what: 'How many months of imports an economy’s net reserves would pay for.', read: `Below three months is the old danger line. Korea’s cover is ${num(f.stress?.kor.j1, 'en', 1)} months in ${quarter(f.stress?.q, 'en')}. Not scored for euro members and reserve-currency issuers.`, calc: 'Net reserves (IRFCL Section I plus the predetermined drains of Section II) ÷ (12-month imports ÷ 12).' }),
    ko: (f) => ({ term: 'J1 · 수입 지급 여력', what: '순외환보유액으로 수입 대금을 몇 개월분 지급할 수 있는지 측정합니다.', read: `3개월 미만이 오래된 위험 기준입니다. ${quarter(f.stress?.q, 'ko')} 한국은 ${num(f.stress?.kor.j1, 'ko', 1)}개월입니다. 유로 회원국과 기축통화국은 계산하지 않습니다.`, calc: '순외환보유액(IRFCL I부 + II부의 예정된 순유출) ÷ (12개월 수입 ÷ 12)' }),
  },
  fin_need: {
    src: (f, l) => [{ src: 'bis.cbs', period: qs(f, l) }, { src: 'imf.bop', period: qs(f, l) }, ...TRADE(f, l)],
    en: (f) => ({ term: 'J2 · Financing need over exports', what: 'The external financing an economy needs over the next year, set against what it earns from exports in a year.', read: `Higher is worse. Korea’s is ${pct(f.stress?.kor.j2, 'en', 0)} of exports in ${quarter(f.stress?.q, 'en')}; the threshold of ${num(f.stress?.thr.j2, 'en', 0)}% was chosen by validation.`, calc: '(BIS banks’ claims due within a year on the economy + the current-account deficit in USD, if any) ÷ 12-month goods exports as partners record them, the window ending in the quarter’s last month. The claims count only bank creditors, by remaining maturity: they are not the economy’s short-term external debt.' }),
    ko: (f) => ({ term: 'J2 · 수출 대비 자금 수요', what: '향후 1년간 필요한 대외 자금을 1년 수출액과 비교합니다.', read: `높을수록 취약합니다. 한국의 값은 ${quarter(f.stress?.q, 'ko')}이며, 수출의 ${pct(f.stress?.kor.j2, 'ko', 0)}입니다. 기준치 ${num(f.stress?.thr.j2, 'ko', 0)}%는 검증으로 정했습니다.`, calc: '(BIS 보고은행이 이 경제에 보유한 잔존만기 1년 이내 채권 + 경상수지 적자가 있으면 그 금액(달러))을 교역상대국이 집계한 12개월 상품수출로 나눈 값입니다. 12개월 창은 분기 마지막 달에 끝납니다. 이 채권은 은행 채권자의 몫만 잔존만기 기준으로 집계한 것입니다. 이 경제의 단기외채가 아닙니다.' }),
  },
  double_hit: {
    src: (f, l) => [...MONEY(f, l).slice(0, 2), ...TRADE(f, l)],
    en: () => ({ term: 'J3 · Double hit', what: 'Funding leaving an economy in the same quarter that its exports fall unusually fast.', read: 'Fires when the flow score F is below zero and export momentum is at or below its own 20th percentile. The score beside it averages how unusual the two moves are for the economy.', calc: '½ (100 − F’s own percentile) + ½ (100 − export momentum’s own percentile); percentiles over earlier quarters only.' }),
    ko: () => ({ term: 'J3 · 이중 충격', what: '자금이 유출되는 분기에 수출도 이례적으로 빠르게 감소하는 경우입니다.', read: '흐름 점수 F가 0 미만이고 수출 모멘텀이 자기 이력의 20번째 백분위 이하면 기준에 도달합니다. 옆의 점수는 두 움직임이 그 경제로서 얼마나 이례적인지를 평균한 값입니다.', calc: '½(100 − F의 자기 백분위) + ½(100 − 수출 모멘텀의 자기 백분위)입니다. 백분위는 앞선 분기로만 산출합니다.' }),
  },
  partner_stress: {
    src: (f, l) => [...MONEY(f, l).slice(0, 2), ...TRADE(f, l)],
    en: (f) => ({ term: 'J4 · Partner stress', what: 'The vulnerability of the economies an economy sells to, weighted by how much it sells to each.', read: `Korea’s is ${num(f.stress?.kor.j4, 'en', 1)} V points in ${quarter(f.stress?.q, 'en')}. Only partners on money-flow’s board have a V; the United States counts as 0. Scored when at least half of exports go to covered partners.`, calc: 'Σ partners’ V × their share of the economy’s exports to covered partners.' }),
    ko: (f) => ({ term: 'J4 · 상대국 스트레스', what: '수출 상대국의 취약성을 상대국별 수출 비중으로 가중한 값입니다.', read: `${quarter(f.stress?.q, 'ko')} 한국의 V는 ${num(f.stress?.kor.j4, 'ko', 1)}점입니다. money-flow 신호판에 있는 상대국만 V가 있고, 미국은 0으로 계산합니다. 수출의 절반 이상이 집계 대상 상대국으로 갈 때만 계산합니다.`, calc: '상대국 V × 상대국 수출 비중 합계' }),
  },
  dual_dep: {
    src: (f, l) => [{ src: 'bis.lbs', period: qs(f, l) }, ...TRADE(f, l)],
    en: (f) => ({ term: 'J5 · Dual dependence', what: 'How far the same partners both lend to an economy’s banks and borrowers and buy its exports.', read: `Korea’s overlap is ${pct(f.stress?.kor.j5, 'en', 0)} in ${quarter(f.stress?.q, 'en')}. In this build the overlap is higher in calm economies than before crises, so it is shown as context.`, calc: 'Σ over partners of min(share of the economy’s BIS LBS bank liabilities, share of its exports).' }),
    ko: (f) => ({ term: 'J5 · 이중 의존', what: '같은 상대국이 그 경제의 은행과 차입자에게 자금을 공급하면서 수출품도 수입하는 정도입니다.', read: `${quarter(f.stress?.q, 'ko')} 한국의 중첩도는 ${josa(pct(f.stress?.kor.j5, 'ko', 0), '입니다')}. 이번 계산에서는 위기 전보다 평온한 경제에서 중첩도가 더 컸습니다. 그래서 참고로만 싣습니다.`, calc: '상대국마다 min(BIS LBS 은행 부채 가운데 비중, 수출 가운데 비중)을 더합니다.' }),
  },
  dollar_ch: {
    src: (f, l) => [{ src: 'fred', series: ['DTWEXBGS'] }, { src: 'bis.lbs', period: qs(f, l) }, ...TRADE(f, l)],
    en: (f) => ({ term: 'J6 · Dollar channel', what: 'The export loss that the dollar’s latest move implies, given how exports in the economy’s FX-credit tercile have responded to the dollar before.', read: `Korea’s is ${pct(f.stress?.kor.j6, 'en', 1, true)} of exports in ${quarter(f.stress?.q, 'en')}; a negative value means the dollar fell. The same dollar move hits every economy in a tercile alike, so the signal mostly marks dollar years.`, calc: '−(slope of export growth two quarters later on the dollar’s 4-quarter change, pooled in the A1 tercile, estimated on earlier quarters) × the dollar’s 4-quarter change.' }),
    ko: (f) => ({ term: 'J6 · 달러 경로', what: '최근 달러 변동이 함축하는 수출 손실입니다. 이 손실은 외화신용(A1) 3분위가 같은 경제들의 수출이 과거 달러 변동에 반응한 정도로 산출합니다.', read: `${quarter(f.stress?.q, 'ko')} 한국은 수출의 ${josa(pct(f.stress?.kor.j6, 'ko', 1, true), '입니다')}. 음수면 달러가 하락했다는 뜻입니다. 같은 3분위의 경제는 같은 달러 변동의 영향을 함께 받습니다. 그래서 이 신호는 주로 달러가 크게 움직인 해를 가리킵니다.`, calc: '−(A1 3분위에서 모은, 달러 4분기 변화율에 대한 두 분기 뒤 수출 증가율의 기울기. 앞선 분기로만 추정) × 달러 4분기 변화율.' }),
  },
  commodity_buf: {
    src: (f, l) => [{ src: 'imf.iip', period: qs(f, l) }, { src: 'imf.bop', period: qs(f, l) }, { src: 'comtrade', period: l === 'ko' ? 'HS 25~27류, 연간' : 'HS 25–27, annual' }],
    en: (f) => ({ term: 'J7 · Commodities against buffers', what: 'How much an economy lives on commodity exports, scaled by how thin its external buffers are.', read: `Korea’s is ${num(f.stress?.kor.j7, 'en', 1)} in ${quarter(f.stress?.q, 'en')} (threshold ${num(f.stress?.thr.j7, 'en', 1)}): refined oil is its main commodity export, and its buffers are thick.`, calc: 'Share of exports in HS chapters 25–27, the year before × the buffer half of V (net IIP and current account; 100 = thinnest) ÷ 100.' }),
    ko: (f) => ({ term: 'J7 · 원자재와 완충력', what: '원자재 수출 의존도를 대외 완충력이 약할수록 크게 반영한 값입니다.', read: `${quarter(f.stress?.q, 'ko')} 한국은 ${num(f.stress?.kor.j7, 'ko', 1)}입니다(기준 ${num(f.stress?.thr.j7, 'ko', 1)}). 주된 원자재 수출품은 정제유이고 완충력은 충분합니다.`, calc: '전년 수출 가운데 HS 25~27류 비중 × V의 완충 부분(순대외금융자산과 경상수지, 100이 가장 취약) ÷ 100.' }),
  },
  tercile: {
    src: (f, l) => [{ src: 'fred', series: ['DTWEXBGS'] }, ...TRADE(f, l)],
    en: () => ({ term: 'Tercile', what: 'One of three equal groups: the economies are sorted by a measure and split into a low, a middle and a high third.', read: 'Comparing the high and low thirds asks whether the relation is stronger where the measure is larger.', calc: 'Sorted by mean A1 over the sample, cut into three groups of about twelve.' }),
    ko: () => ({ term: '3분위', what: '같은 크기의 세 그룹입니다. 경제를 어떤 값의 순서로 정렬해 하위, 중위, 상위 3분의 1로 나눕니다.', read: '상위 그룹과 하위 그룹을 비교하면 그 값이 클수록 관계가 강해지는지 확인할 수 있습니다.', calc: '표본 기간 평균 A1로 정렬해 12개 경제 내외씩 세 그룹으로 나눕니다.' }),
  },
  portfolio: {
    src: (f, l) => [{ src: 'imf.pip', period: l === 'ko' ? '반기' : 'half-yearly' }],
    en: () => ({ term: 'Portfolio holdings', what: 'Shares and bonds issued in one economy and held by investors in another, without control of the issuer.', read: 'Financial centres hold securities for others, so a pair through Luxembourg or Ireland often stands for investors elsewhere.', calc: 'IMF Portfolio Investment Positions, holder to issuer, USD bn.' }),
    ko: () => ({ term: '증권투자', what: '한 나라에서 발행한 주식과 채권을 다른 나라 투자자가 경영 참여 없이 보유한 자산입니다.', read: '국제금융중심지는 다른 나라 투자자를 대신해 증권을 보유합니다. 룩셈부르크나 아일랜드를 거친 쌍은 실제로는 다른 나라 투자자인 경우가 많습니다.', calc: 'IMF 상대국별 증권투자 잔액, 보유국 → 발행국(억 달러)' }),
  },
  fdi: {
    src: (f, l) => [{ src: 'imf.dip', period: l === 'ko' ? '연간' : 'annual' }],
    en: () => ({ term: 'Direct investment', what: 'Ownership of at least 10% of a firm abroad: factories, subsidiaries and their loans to the parent.', read: 'It is slow to move and rarely leaves in a panic, unlike bank and bond funding.', calc: 'IMF Direct Investment Positions, investor to host, USD bn; one report per pair, the host’s first.' }),
    ko: () => ({ term: '직접투자', what: '해외 기업 지분을 10% 이상 보유한 투자입니다. 공장, 자회사, 모회사와의 대출을 포함합니다.', read: '변동이 느리고, 은행·채권 자금과 달리 위기 때 한꺼번에 유출되는 경우가 드뭅니다.', calc: 'IMF 상대국별 직접투자 잔액, 투자국 → 유치국, 억 달러. 쌍마다 보고 하나, 유치국 보고 먼저.' }),
  },
  trade_scale: {
    src: (f, l) => [WDI(f, l, ['BX.GSR.GNFS.CD', 'BM.GSR.GNFS.CD', 'NY.GDP.MKTP.CD']), { src: 'imf.bop', series: ['GS CD_T/DB_T'], period: l === 'ko' ? '분기, 4분기 누적' : 'quarterly, 4-quarter sums' }],
    en: (f) => ({ term: 'Trade scale', what: 'How much an economy trades with the rest of the world: the average of its exports and its imports, as a share of GDP.', read: `Higher means a more open economy. Korea’s was ${P(f.earn.KOR?.xg != null && f.earn.KOR?.mg != null ? (f.earn.KOR.xg + f.earn.KOR.mg) / 2 : null, 'en', 0)} of GDP in ${f.year}, the United States’ ${P(f.earn.USA?.xg != null && f.earn.USA?.mg != null ? (f.earn.USA.xg + f.earn.USA.mg) / 2 : null, 'en', 0)}. It says nothing about surplus or deficit; that is the height in the rotated view.`, calc: '(Exports of goods and services + imports) ÷ 2 ÷ GDP × 100, balance-of-payments basis.' }),
    ko: (f) => ({ term: '교역 규모', what: '한 경제가 세계와 교역하는 규모입니다. 수출과 수입의 평균을 GDP 대비 비율로 나타냅니다.', read: `값이 높을수록 개방된 경제입니다. ${f.year}년 한국은 GDP의 ${P(f.earn.KOR?.xg != null && f.earn.KOR?.mg != null ? (f.earn.KOR.xg + f.earn.KOR.mg) / 2 : null, 'ko', 0)}, 미국은 ${P(f.earn.USA?.xg != null && f.earn.USA?.mg != null ? (f.earn.USA.xg + f.earn.USA.mg) / 2 : null, 'ko', 0)}였습니다. 흑자·적자 여부는 나타내지 않습니다. 그 값은 회전 보기의 높이로 표시합니다.`, calc: '(상품·서비스 수출 + 수입) ÷ 2 ÷ GDP × 100, 국제수지 기준' }),
  },
  rotated: {
    src: (f, l) => [WDI(f, l, ['BX.GSR.GNFS.CD', 'BM.GSR.GNFS.CD']), { src: 'imf.iip', period: qs(f, l) }],
    en: () => ({ term: 'Rotated view', what: 'The diagonal chart turned by 45°: across is the average of the two gross values, up is their difference. The diagonal becomes the zero line.', read: 'Exports and imports (or assets and liabilities) move together, so on the diagonal view economies crowd along the line. Rotated, the same points spread out by their balance. Above zero: exports exceed imports, or assets exceed liabilities.', calc: 'x = (a + b) ÷ 2, y = a − b, where a and b are the two gross values as % of GDP. Nothing new is computed; only the axes turn.' }),
    ko: () => ({ term: '회전 보기', what: '대각선 그래프를 45도 돌린 화면입니다. 가로축은 두 총액의 평균, 세로축은 두 총액의 차이입니다. 대각선이 0 선이 됩니다.', read: '수출과 수입(또는 자산과 부채)은 함께 움직이므로 대각선 보기에서는 경제들이 선을 따라 몰립니다. 회전하면 같은 점이 수지에 따라 분산됩니다. 0 위는 수출이 수입보다, 또는 자산이 부채보다 많습니다.', calc: 'x = (a + b) ÷ 2, y = a − b입니다. a와 b는 GDP 대비 % 총액입니다. 새로 계산하는 값은 없고 축만 회전합니다.' }),
  },
  rolling4q: {
    src: (f, l) => [{ src: 'imf.bop', series: ['GS CD_T/DB_T', 'IN1 CD_T/DB_T'], period: l === 'ko' ? '분기' : 'quarterly' }, { src: 'imf.qnea', series: ['B1GQ.V.NSA'], period: l === 'ko' ? '분기' : 'quarterly' }],
    en: () => ({ term: '4-quarter sum', what: 'A quarterly figure added up with the three quarters before it, so each point covers a full year ending in that quarter.', read: 'It removes seasons (exports dip every first quarter in some economies) and keeps the quarterly line comparable with the annual one: the fourth quarter’s 4-quarter sum is the calendar year.', calc: 'Value(q) + value(q−1) + value(q−2) + value(q−3); a missing quarter leaves the sum empty, nothing is filled in.' }),
    ko: () => ({ term: '4분기 누적', what: '한 분기 값에 직전 세 분기 값을 더한 값입니다. 점 하나가 그 분기로 끝나는 1년을 나타냅니다.', read: '계절성을 제거합니다. 어떤 나라는 해마다 1분기 수출이 감소합니다. 연간 수치와도 비교할 수 있습니다. 4분기의 4분기 누적이 곧 그해 값입니다.', calc: '값(q) + 값(q−1) + 값(q−2) + 값(q−3). 한 분기라도 빠지면 합을 비워 두고 채우지 않습니다.' }),
  },
  annualised: {
    src: (f, l) => [{ src: 'imf.qnea', series: ['B1GQ.V.NSA'], period: l === 'ko' ? '분기' : 'quarterly' }, { src: 'bis.xru', period: l === 'ko' ? '분기 평균' : 'quarterly averages' }],
    en: () => ({ term: 'Annualised', what: 'Put on a yearly footing, so a quarter can be compared with a year.', read: 'Here the flows are 4-quarter sums and GDP is a 4-quarter sum too, so a share like 5% of GDP means the same in either mode.', calc: '4-quarter sum of the flow ÷ 4-quarter sum of GDP in US dollars (each quarter’s GDP converted at that quarter’s average exchange rate) × 100.' }),
    ko: () => ({ term: '연환산', what: '한 분기 값을 1년 기준으로 환산해 연간 값과 비교할 수 있게 한 값입니다.', read: '여기서는 흐름도 4분기 누적, GDP도 4분기 누적인 값입니다. 그래서 GDP의 5%는 연간 화면이든 분기 화면이든 같은 뜻입니다.', calc: '흐름의 4분기 누적 ÷ 달러 GDP의 4분기 누적(분기마다 그 분기 평균 환율로 환산) × 100' }),
  },
  region: {
    src: () => [{ src: 'comtrade' }],
    en: () => ({ term: 'Region group', what: 'Four groups for the filter: Asia-Pacific, Europe (with the euro area inside it), the Americas, and the Middle East and Africa.', read: 'They follow the UN geoscheme that trade-flow uses, folded into four: Türkiye, Israel and Saudi Arabia count as Western Asia, so they sit in the Middle East and Africa group.', calc: 'config/regions.yaml maps each UN region and subregion to a group; the euro area is money-flow’s euro set.' }),
    ko: () => ({ term: '지역 그룹', what: '필터에 쓰는 네 그룹입니다. 아시아·태평양, 유럽(유로 지역 포함), 미주, 중동·아프리카입니다.', read: 'trade-flow가 쓰는 유엔 지역 구분을 넷으로 묶었습니다. 튀르키예·이스라엘·사우디아라비아는 서아시아로 분류해 중동·아프리카에 넣습니다.', calc: 'config/regions.yaml이 유엔 지역과 소지역을 그룹에 대응시킵니다. 유로 지역은 money-flow의 유로 회원국 목록입니다.' }),
  },
  adv_eme: {
    src: (f, l) => [{ src: 'bis.lbs', period: qs(f, l) }],
    en: () => ({ term: 'Advanced and emerging', what: 'The BIS split of economies into advanced economies and emerging market economies, as money-flow’s board uses it.', read: 'Emerging economies borrow more in foreign currency and lose funding faster in a dollar squeeze, which is why the board scores them on the same scale but they fill the at-risk range more often.', calc: 'The BIS advanced-economy list in money-flow’s board groups; every other board economy is emerging.' }),
    ko: () => ({ term: '선진·신흥 구분', what: 'BIS가 경제를 선진국과 신흥시장국으로 나눈 기준입니다. money-flow 신호판이 그대로 씁니다.', read: '신흥국은 외화 차입이 더 많고, 달러 유동성이 부족할 때 자금이 더 빨리 유출됩니다. 같은 기준으로 점수를 매겨도 위험 구간에 더 자주 듭니다.', calc: 'money-flow 신호판의 BIS 선진국 목록입니다. 나머지 신호판 경제는 신흥국입니다.' }),
  },
  topn: {
    src: (f, l) => [WDI(f, l, ['BX.GSR.GNFS.CD', 'NY.GDP.MKTP.CD']), { src: 'imf.iip', period: qs(f, l) }],
    en: () => ({ term: 'Top N', what: 'Keep only the N largest economies by a measure (exports in dollars, GDP in dollars or gross external assets) in the period shown.', read: 'The ranking is redone for every period, so an economy can enter or leave the set as you play through the years. It ranks the 37 economies on this chart, not the world.', calc: 'Sort the economies by the measure at the current period, keep the first N.' }),
    ko: () => ({ term: '상위 N', what: '표시한 시점에 어떤 기준(달러 수출액, 달러 GDP, 대외금융자산)으로 가장 큰 N개 경제만 남깁니다.', read: '순위는 시점마다 새로 매깁니다. 재생하면 어떤 경제가 들어오고 나가는지 확인할 수 있습니다. 세계 전체가 아니라 이 그래프의 37개 경제 가운데 순위입니다.', calc: '현재 시점의 값으로 경제를 정렬해 상위 N개를 남깁니다.' }),
  },
};

Object.assign(G, {
  unit: {
    src: (f: Facts, l: Lang) => [WDI(f, l, ['BX.GSR.GNFS.CD', 'BM.GSR.GNFS.CD', 'NY.GDP.MKTP.CD']), { src: 'imf.iip', period: qs(f, l) }],
    en: (f: Facts) => ({ term: 'Unit: % of GDP or US dollars', what: 'The same numbers measured two ways: against the size of the economy, or in dollars.', read: `% of GDP compares economies of any size: Belgium trades far more of its GDP than the United States. Dollars show weight in the world: the United States’ exports were ${bn(f.earn.USA?.xu, 'en')} in ${f.year}, Belgium’s ${bn(f.earn.BEL?.xu, 'en')}. Switching keeps the economy and the period.`, calc: 'Dollar values are the series before dividing by GDP: balance-of-payments exports and imports (World Bank WDI, or IMF quarterly sums), IMF gross external positions, balances × GDP ÷ 100.' }),
    ko: (f: Facts) => ({ term: '단위: GDP 대비 % 또는 달러', what: '같은 수치를 두 가지 단위로 나타냅니다. 경제 규모와 비교하거나 달러 금액으로 나타냅니다.', read: `GDP 대비 %로는 규모가 다른 경제를 비교할 수 있습니다. 벨기에는 GDP에 비해 미국보다 훨씬 많이 교역합니다. 달러 금액은 세계에서 차지하는 비중을 나타냅니다. ${f.year}년 미국 수출은 ${bn(f.earn.USA?.xu, 'ko')}, 벨기에는 ${bn(f.earn.BEL?.xu, 'ko')}였습니다. 단위를 바꿔도 선택한 경제와 시점은 그대로입니다.`, calc: '달러 값은 GDP로 나누기 전의 시계열입니다. 국제수지 기준 수출·수입(세계은행 WDI, 분기는 IMF 4분기 누적), IMF 대외금융자산·부채, 수지는 비율 × GDP ÷ 100입니다.' }),
  },
  symlog: {
    src: (f: Facts, l: Lang) => [WDI(f, l, ['BN.GSR.GNFS.CD', 'BX.GSR.GNFS.CD', 'BM.GSR.GNFS.CD'])],
    en: () => ({ term: 'Symmetric log scale', what: 'A log scale that also takes zero and negative values: steps are tenfold on both sides of zero, and near zero the axis is close to linear.', read: 'Dollar balances run from deficits near a trillion dollars to surpluses of the same size, with most economies within ±$50 bn. On a plain axis the small ones would sit on top of each other at zero; here $1 bn, $10 bn and $100 bn are equal steps up, and the same steps down.', calc: 'Position = sign(v) × log10(1 + |v| ÷ $1 bn).' }),
    ko: () => ({ term: '대칭 로그 눈금', what: '0과 음수도 표시하는 로그 눈금입니다. 0 위아래로 한 눈금이 10배이며, 0 근처는 일반 눈금에 가깝습니다.', read: '달러 수지는 1조 달러에 가까운 적자부터 같은 크기의 흑자까지 분포합니다. 대부분은 ±500억 달러 안에 있습니다. 일반 눈금이면 작은 경제가 0에 겹칩니다. 여기서는 10억·100억·1,000억 달러가 위로 같은 간격이고 아래로도 같습니다.', calc: '위치 = 부호(v) × log10(1 + |v| ÷ 10억 달러)' }),
  },
  hs2: {
    src: (f: Facts, l: Lang) => [{ src: 'comtrade', series: [l === 'ko' ? 'HS 2단위 품목' : 'HS 2-digit chapters'], period: w12(f, l) }],
    en: (f: Facts) => ({ term: 'HS chapter', what: 'The 97 two-digit chapters of the Harmonized System, the customs code every economy uses to classify goods: 27 is mineral fuels and oil, 30 pharmaceuticals, 85 electrical machinery and electronics.', read: `A chapter is broad: 85 holds both chips and washing machines. Belgium’s largest export chapter over the window was ${f.panel.BEL?.px ? `${hsName(f.panel.BEL.px[0], 'en')} (${pct(f.panel.BEL.px[1], 'en', 0)} of its exports)` : '–'}; in several of its top chapters Belgium imports nearly as much as it exports, goods passing through its ports, which is why the country sheet shows exports minus imports beside each chapter. Chapters 77, 98 and 99 (reserved, special use, not specified) are counted in “other”.`, calc: 'UN Comtrade monthly reports by HS chapter, summed over the 12-month window with trade-flow’s window rules: the importer’s report where it filed, else the exporter’s report spliced, benchmarked or as is; a reporter month with no row of the chapter is interpolated from the months either side.' }),
    ko: (f: Facts) => ({ term: 'HS 품목(2단위)', what: '모든 나라가 상품 분류에 쓰는 HS 품목분류의 2단위 97개 류입니다. 27류는 광물성 연료·석유, 30류는 의약품, 85류는 전기·전자기기입니다.', read: `한 류의 범위는 넓습니다. 85류에는 반도체도 세탁기도 들어갑니다. 이 창에서 벨기에의 최대 수출 품목은 ${f.panel.BEL?.px ? `${hsName(f.panel.BEL.px[0], 'ko')}(수출의 ${pct(f.panel.BEL.px[1], 'ko', 0)})` : '–'}이었습니다. 벨기에는 주요 품목 여럿에서 수출만큼 수입도 많습니다. 벨기에 항구를 거쳐 가는 물품이기 때문입니다. 그래서 국가 시트는 품목마다 수출에서 수입을 뺀 값을 함께 표시합니다. 77·98·99류(유보, 특수 용도, 미분류)는 기타에 넣습니다.`, calc: 'UN Comtrade 월별 보고를 HS 류별로 12개월 창에 더합니다. trade-flow의 창 규칙을 따릅니다. 수입국이 신고한 달에는 수입국 보고를 씁니다. 수입국 보고가 없으면 수출국 보고를 접합하거나 교차 검증하거나 그대로 씁니다. 신고한 달에 그 류가 전체로 누락되면 앞뒤 달로 보간합니다.' }),
  },
} satisfies Record<string, Def>);

export const TERM_IDS = Object.keys(G);

/** The glossary in one language, with this build's examples filled in (server only: it reads the data). */
export function glossary(lang: Lang, f: Facts): Record<string, Gloss> {
  const out: Record<string, Gloss> = {};
  for (const [id, d] of Object.entries(G)) out[id] = { ...d[lang](f), src: d.src(f, lang) };
  return out;
}
