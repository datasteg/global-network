// The source registry: every dataset a page cites, with its publisher, licence, landing page and the series codes the
// pipelines read. Source lines (<Cite>), glossary popovers and the About page's tables are all rendered from here, so
// they cannot disagree. Each `url` was opened on 1 Nov 2026 and seen to land on that dataset or series (the IMF and
// Comtrade pages render in the browser only); money-flow's config/sources.yaml is the upstream for the BIS, IMF, FRED
// and TIC entries (and, since the refurbish of 2 Nov 2026, for WDI, QNEA and XRU, which arrive in its earn/global
// view), trade-flow's docs/DATA.md for Comtrade and the Korea Customs Service.
import type { Lang } from './types';

type T = { en: string; ko: string };

export type SrcId =
  | 'wdi' | 'imf.iip' | 'imf.bop' | 'imf.irfcl' | 'imf.pip' | 'imf.dip'
  | 'bis.lbs' | 'bis.cbs' | 'bis.dss' | 'bis.tc' | 'bis.gli'
  | 'imf.qnea' | 'bis.xru' | 'fred' | 'tic' | 'comtrade' | 'kcs' | 'tf.events' | 'mf.episodes' | 'doj.hmg';

export interface SrcDef {
  name: T; publisher: T; licence: T; url: string; cadence: T;
  /** which of our pipelines carries it here: its methodology page is linked beside the dataset */
  via?: 'money' | 'trade';
  /** key in meta.money.vintages for the day money-flow read it */
  vintage?: string;
}

const OPEN: T = { en: 'open, with attribution', ko: '출처 표시 후 공개 이용' };

export const SOURCES: Record<SrcId, SrcDef> = {
  wdi: { name: { en: 'World Development Indicators', ko: '세계개발지표(WDI)' }, publisher: { en: 'World Bank', ko: '세계은행' }, licence: { en: 'CC BY 4.0', ko: 'CC BY 4.0' }, url: 'https://data.worldbank.org/indicator', cadence: { en: 'annual', ko: '연간' }, via: 'money' },
  'imf.iip': { name: { en: 'International Investment Position (IIP)', ko: '국제투자대조표(IIP)' }, publisher: { en: 'IMF', ko: 'IMF' }, licence: OPEN, url: 'https://data.imf.org/en/datasets/IMF.STA:IIP', cadence: { en: 'quarterly', ko: '분기' }, via: 'money', vintage: 'imf.IIP' },
  'imf.bop': { name: { en: 'Balance of Payments (BOP)', ko: '국제수지(BOP)' }, publisher: { en: 'IMF', ko: 'IMF' }, licence: OPEN, url: 'https://data.imf.org/en/datasets/IMF.STA:BOP', cadence: { en: 'quarterly', ko: '분기' }, via: 'money', vintage: 'imf.BOP' },
  'imf.irfcl': { name: { en: 'International Reserves and Foreign Currency Liquidity (IRFCL)', ko: '외환보유액 및 외화유동성(IRFCL)' }, publisher: { en: 'IMF', ko: 'IMF' }, licence: OPEN, url: 'https://data.imf.org/en/datasets/IMF.STA:IRFCL', cadence: { en: 'monthly', ko: '월' }, via: 'money', vintage: 'imf.IRFCL' },
  'imf.pip': { name: { en: 'Portfolio Investment Positions by Counterpart Economy (PIP, formerly CPIS)', ko: '상대국별 증권투자 잔액(PIP, 구 CPIS)' }, publisher: { en: 'IMF', ko: 'IMF' }, licence: OPEN, url: 'https://data.imf.org/en/datasets/IMF.STA:PIP', cadence: { en: 'half-yearly', ko: '반기' }, via: 'money', vintage: 'imf.PIP' },
  'imf.dip': { name: { en: 'Direct Investment Positions by Counterpart Economy (DIP, formerly CDIS)', ko: '상대국별 직접투자 잔액(DIP, 구 CDIS)' }, publisher: { en: 'IMF', ko: 'IMF' }, licence: OPEN, url: 'https://data.imf.org/en/datasets/IMF.STA:DIP', cadence: { en: 'annual', ko: '연간' }, via: 'money', vintage: 'imf.DIP' },
  'bis.lbs': { name: { en: 'Locational banking statistics (LBS)', ko: '소재지 기준 국제은행통계(LBS)' }, publisher: { en: 'BIS', ko: 'BIS' }, licence: OPEN, url: 'https://data.bis.org/topics/LBS', cadence: { en: 'quarterly', ko: '분기' }, via: 'money', vintage: 'bis.LBS' },
  'bis.cbs': { name: { en: 'Consolidated banking statistics (CBS)', ko: '연결기준 국제은행통계(CBS)' }, publisher: { en: 'BIS', ko: 'BIS' }, licence: OPEN, url: 'https://data.bis.org/topics/CBS', cadence: { en: 'quarterly', ko: '분기' }, via: 'money', vintage: 'bis.CBS' },
  'bis.dss': { name: { en: 'Debt securities statistics (DSS)', ko: '채권 통계(DSS)' }, publisher: { en: 'BIS', ko: 'BIS' }, licence: OPEN, url: 'https://data.bis.org/topics/DSS', cadence: { en: 'quarterly', ko: '분기' }, via: 'money', vintage: 'bis.DSS' },
  'bis.tc': { name: { en: 'Credit to the non-financial sector (GDP for every ratio)', ko: '비금융부문 신용(모든 비율의 GDP)' }, publisher: { en: 'BIS', ko: 'BIS' }, licence: OPEN, url: 'https://data.bis.org/topics/TOTAL_CREDIT', cadence: { en: 'quarterly', ko: '분기' }, via: 'money', vintage: 'bis.TC' },
  'bis.gli': { name: { en: 'Global liquidity indicators (definition A1 follows)', ko: '글로벌 유동성 지표(A1이 따르는 정의)' }, publisher: { en: 'BIS', ko: 'BIS' }, licence: OPEN, url: 'https://data.bis.org/topics/GLI', cadence: { en: 'quarterly', ko: '분기' } },
  'imf.qnea': { name: { en: 'Quarterly National Accounts (QNEA), nominal GDP', ko: '분기 국민계정(QNEA), 명목 GDP' }, publisher: { en: 'IMF', ko: 'IMF' }, licence: OPEN, url: 'https://data.imf.org/en/datasets/IMF.STA:QNEA', cadence: { en: 'quarterly', ko: '분기' }, via: 'money' },
  'bis.xru': { name: { en: 'US dollar exchange rates (XRU), quarterly averages', ko: '미 달러 환율(XRU), 분기 평균' }, publisher: { en: 'BIS', ko: 'BIS' }, licence: OPEN, url: 'https://data.bis.org/topics/XRU', cadence: { en: 'quarterly', ko: '분기' }, via: 'money' },
  fred: { name: { en: 'FRED, Federal Reserve H.4.1 and H.10 series', ko: 'FRED, 미국 연준 H.4.1·H.10 계열' }, publisher: { en: 'Federal Reserve Board, via FRED (St. Louis Fed)', ko: '미국 연준, FRED(세인트루이스 연은) 경유' }, licence: { en: 'public domain, citation requested', ko: '퍼블릭 도메인(인용 요청)' }, url: 'https://fred.stlouisfed.org/series/DTWEXBGS', cadence: { en: 'weekly, daily', ko: '주, 일' }, via: 'money', vintage: 'fred.observations' },
  tic: { name: { en: 'Treasury International Capital (TIC), SLT table 1', ko: '국제자본통계(TIC), SLT 표 1' }, publisher: { en: 'US Treasury', ko: '미 재무부' }, licence: { en: 'public domain', ko: '퍼블릭 도메인' }, url: 'https://ticdata.treasury.gov/resource-center/data-chart-center/tic/Documents/slt_table1.txt', cadence: { en: 'monthly', ko: '월' }, via: 'money', vintage: 'tic.files' },
  comtrade: { name: { en: 'UN Comtrade, goods trade by reporter and partner', ko: 'UN Comtrade, 보고국·상대국별 상품 교역' }, publisher: { en: 'UN Statistics Division', ko: '유엔 통계국' }, licence: { en: 'derived records only (shares × world total)', ko: '파생 기록만(비중 × 세계 합계)' }, url: 'https://comtradeplus.un.org/TradeFlow', cadence: { en: 'monthly, annual', ko: '월, 연' }, via: 'trade' },
  kcs: { name: { en: 'Korea Customs Service, exports and imports by item and country', ko: '관세청 품목별 국가별 수출입실적' }, publisher: { en: 'Korea Customs Service, via data.go.kr', ko: '관세청, 공공데이터포털 경유' }, licence: { en: 'open government data (data.go.kr terms)', ko: '공공데이터(공공데이터포털 이용약관)' }, url: 'https://www.data.go.kr/data/15100475/openapi.do', cadence: { en: 'monthly', ko: '월' }, via: 'trade' },
  'tf.events': { name: { en: 'Trade events (trade-flow config/events.yaml, with their cited sources)', ko: '교역 사건(trade-flow config/events.yaml, 인용 출처 포함)' }, publisher: { en: 'datasteg trade-flow', ko: 'datasteg trade-flow' }, licence: { en: 'this site', ko: '이 사이트' }, url: 'https://trade-flow.datasteg.com/en/events', cadence: { en: 'as events happen', ko: '사건 발생 시' }, via: 'trade' },
  'mf.episodes': { name: { en: 'Stress episodes (money-flow’s validation set)', ko: '' }, publisher: { en: 'datasteg money-flow', ko: 'datasteg money-flow' }, licence: { en: 'this site', ko: '이 사이트' }, url: 'https://money-flow.datasteg.com/en/method', cadence: { en: 'fixed list', ko: '고정 목록' }, via: 'money' },
  'doj.hmg': { name: { en: 'Horizontal Merger Guidelines (2010)', ko: '수평결합 지침(2010)' }, publisher: { en: 'US Department of Justice and FTC', ko: '미 법무부·연방거래위원회' }, licence: { en: 'public domain', ko: '퍼블릭 도메인' }, url: 'https://www.justice.gov/atr/horizontal-merger-guidelines-08192010', cadence: { en: 'one-off', ko: '일회' } },
};

/** Series codes the pipelines read, each with its own page where the publisher has one. */
export const SERIES: Record<string, { src: SrcId; url?: string; name: T }> = {
  'BN.GSR.GNFS.CD': { src: 'wdi', url: 'https://data.worldbank.org/indicator/BN.GSR.GNFS.CD', name: { en: 'net trade in goods and services, BoP', ko: '상품·서비스 순수출, 국제수지 기준' } },
  'BN.GSR.FCTY.CD': { src: 'wdi', url: 'https://data.worldbank.org/indicator/BN.GSR.FCTY.CD', name: { en: 'net primary income, BoP', ko: '본원소득수지, 국제수지 기준' } },
  'BX.GSR.GNFS.CD': { src: 'wdi', url: 'https://data.worldbank.org/indicator/BX.GSR.GNFS.CD', name: { en: 'exports of goods and services, BoP', ko: '상품·서비스 수출, 국제수지 기준' } },
  'BM.GSR.GNFS.CD': { src: 'wdi', url: 'https://data.worldbank.org/indicator/BM.GSR.GNFS.CD', name: { en: 'imports of goods and services, BoP', ko: '상품·서비스 수입, 국제수지 기준' } },
  'NY.GDP.MKTP.CD': { src: 'wdi', url: 'https://data.worldbank.org/indicator/NY.GDP.MKTP.CD', name: { en: 'GDP, current US$', ko: 'GDP, 경상 달러' } },
  'NY.GDP.PCAP.CD': { src: 'wdi', url: 'https://data.worldbank.org/indicator/NY.GDP.PCAP.CD', name: { en: 'GDP per capita, current US$', ko: '1인당 GDP, 경상 달러' } },
  DTWEXBGS: { src: 'fred', url: 'https://fred.stlouisfed.org/series/DTWEXBGS', name: { en: 'nominal broad US dollar index, Jan 2006 = 100 (H.10)', ko: '명목 광의 달러 지수, 2006년 1월 = 100(H.10)' } },
  SWPT: { src: 'fred', url: 'https://fred.stlouisfed.org/series/SWPT', name: { en: 'central bank liquidity swaps, Wednesday level (H.4.1)', ko: '중앙은행 유동성 스왑, 수요일 기준(H.4.1)' } },
  WMTSECL1: { src: 'fred', url: 'https://fred.stlouisfed.org/series/WMTSECL1', name: { en: 'marketable Treasuries in custody for foreign official accounts (H.4.1)', ko: '외국 공공계정 보관 시장성 미 국채(H.4.1)' } },
  slt_table1: { src: 'tic', url: 'https://ticdata.treasury.gov/resource-center/data-chart-center/tic/Documents/slt_table1.txt', name: { en: 'US long-term securities held by foreign residents, net purchases', ko: '외국인 보유 미국 장기증권, 순매수' } },
  'GS CD_T/DB_T': { src: 'imf.bop', name: { en: 'goods and services, credit and debit, US$', ko: '상품·서비스 수입(受入)·지급, 달러' } },
  'IN1 CD_T/DB_T': { src: 'imf.bop', name: { en: 'primary income, credit and debit, US$', ko: '본원소득 수입(受入)·지급, 달러' } },
  'B1GQ.V.NSA': { src: 'imf.qnea', name: { en: 'GDP, current prices, not seasonally adjusted, domestic currency', ko: 'GDP, 경상가격, 계절조정 전, 자국 통화' } },
  'IIP total assets / liabilities': { src: 'imf.iip', name: { en: 'gross assets and liabilities, all instruments', ko: '대외금융자산·부채 총액, 전 항목' } },
};

/** Our pipelines' method pages, linked beside every dataset that passes through them. */
export const VIA: Record<'money' | 'trade', { name: string; url: (l: Lang) => string }> = {
  money: { name: 'money-flow', url: (l) => `https://money-flow.datasteg.com/${l}/method` },
  trade: { name: 'trade-flow', url: (l) => `https://trade-flow.datasteg.com/${l}/method` },
};

/** One cited dataset on a source line: which series of it, over which period. */
export interface CiteItem { src: SrcId; series?: string[]; period?: string }

/** A datasteg page link follows the reader's language; publisher pages stay as they are. */
export function srcUrl(url: string, lang: Lang): string {
  return /^https:\/\/[a-z-]+\.datasteg\.com\/en\//.test(url) ? url.replace('/en/', `/${lang}/`) : url;
}
