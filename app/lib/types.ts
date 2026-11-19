// Shapes of data/*.json.br as scripts/build.py writes them. Amounts are USD bn unless a field says otherwise.
export type Lang = 'en' | 'ko';

export interface EconomyMeta { code: string; en: string; ko: string; region: string; subregion: string; euro_from?: string | null; advanced?: boolean }

export interface Episode { en: string; ko: string; q: string; eco: string[] }
export interface TradeEvent { id: string; num: string; start: string; end: string | null; en: string; ko: string; dek: { en: string; ko: string } | null; economies: string[]; products: string[]; replay?: boolean }

/** The two parents' export surfaces as the build read them (docs/SURFACES.md): pinned on every footer and on About. */
export interface Surfaces {
  money: { release: string; method: string; surface: string; built?: string | null; files?: string[] | null };
  trade: { built: string; surface_written?: string | null; shown: number; surface: string; complete_a?: number | null; files?: string[] | null };
}
/** What the build read beside the surfaces: money-flow's tables by hash, the products file's trade-flow
 *  build, the measures registry, and where net reserves came from (money-flow's res_net_raw or derived here). */
export interface ReadVintages {
  tables: Record<string, { sha256: string; modified: string | null; bytes: number }>;
  products: { file: string; trade_flow_built: string | null };
  measures: { file: string; version: number | null; sha256: string | null };
  res_net_raw: 'money-flow' | 'derived';
}
/** A partner node's names and whether it is an economy (partner 490's node is not; registry id asia_nes). */
export interface PartnerName { en: string; ko: string; economy: boolean; measure?: string }

export interface Meta {
  built: string;
  read?: ReadVintages;
  partner_names?: Record<string, PartnerName>;
  money: { release: string; method: string; surface: string; date: string; quarter: string; quarters: string[]; vintages: Record<string, string>; pulse_day: string; built?: string | null };
  trade: { built: string; surface: string; shown: number; complete: { A: number; M: number }; last: { A: number; M: number }; world_bn: number };
  surfaces: Surfaces;
  periods: { bank: string; portfolio: string; fdi: string; goods: number };
  hub: string;
  economies: EconomyMeta[];
  hub_names: Record<string, EconomyMeta>;
  episodes: Record<string, Episode>;
  events: TradeEvent[];
  n_out: number;
  top_withdrawals: [string, number, number, number][];
}

/** One economy's Signal Board trail, arrays aligned on q. */
export interface BoardSeries {
  q: string[]; v: (number | null)[]; flow: (number | null)[]; exp: (number | null)[]; buf: (number | null)[];
  a1: (number | null)[]; a1n: (number | null)[]; a2: (number | null)[]; a2g: (number | null)[]; a2_basis: (string | null)[]; a2_floored: (number | null)[]; a2_scored: (number | null)[];
  a3: (number | null)[]; niip: (number | null)[]; ca: (number | null)[]; b1: (number | null)[]; b2: (number | null)[];
  size: (number | null)[]; gdp: (number | null)[]; st: (number | null)[]; res: (number | null)[]; res_net: (number | null)[]; res_net_raw: (number | null)[]; flow_note?: (string | null)[]; res_drains: (number | null)[];
  ids: (number | null)[]; loans: (number | null)[]; stock_prev: (number | null)[]; local_fx: (number | null)[]; a1_local: (number | null)[]; offshore: (number | null)[];
}
export type Board = Record<string, BoardSeries>;

export interface Partner { p: string; eco?: boolean; usd: number; share: number | null; mr: number | null; src: number; est: number; dv: number; yoy: number | null }
export interface TradeNow { t: number; x_bn: number | null; m_bn: number | null; x_share: number | null; m_share: number | null; hs: number | null; hm: number | null; ts: string | null; tss: number | null; od: number | null; id: number | null; reported: number | null; est: number | null; pv: number | null; c: number | null }
export interface TradeBlock {
  t: number[]; x: (number | null)[]; m: (number | null)[]; c: number[]; mom_x: (number | null)[]; mom_m: (number | null)[];
  /** the window each growth value is compared with: the one ending exactly 12 months earlier (registry goods_trade_growth) */
  mom_base?: (number | null)[];
  /** the window joined at the funding quarter (rule C2): ending in the quarter's last month or up to 6 months earlier, partial */
  at_q?: TradeAtQ | null;
  annual: { t: number[]; x: (number | null)[]; m: (number | null)[] };
  now: TradeNow; dests: Partner[]; sups: Partner[]; commodity_share: number | null; commodity_year: number;
  products: Products;
}
export interface TradeAtQ { q: string; t: number; lag: number; partial: boolean; x_bn: number | null; m_bn: number | null; mom_x: number | null; mom_m: number | null; base: number | null }
/** One HS chapter of an economy over its 12-month window (scripts/build_products.py): exports and imports in USD bn, each
 * as % of the economy's total, % change on the window a year earlier, and the estimate code of each side (0 none, 1
 * benchmarked, 2 spliced, 3 partner-only, 4 interpolated) where estimates make up at least 10% of it. */
export interface ProductRow { ch: string; x: number; m: number; xs: number | null; ms: number | null; xy: number | null; my: number | null; xe: number; me: number }
/** The largest chapters per side (10 on the country sheet, 5 in the Overview panel); x_bn, m_bn the economy's totals. */
export interface Products { t: number; x_bn: number | null; m_bn: number | null; x: ProductRow[]; m: ProductRow[] }
export interface MoneyBlock {
  fx_reserves: [string, number][] | null; broad_money: [string, number] | null;
  iip: { in: [string, number][]; out: [string, number][]; net: [string, number][]; reserves: [string, number][] };
  bop_in: Record<string, [string, number][]>; vintage: { published: string; read: string } | null;
}
export interface ChokeRow { chain: string; en: string; ko: string; stage: string; stage_ko: string; key: string; hhi: number; top: [string, number][]; x?: number; m?: number; ts?: string | null; tss?: number | null }
export interface ReplayRow { q: string; share: number | null; b1: number | null; b2: number | null; share_bank?: number | null; share_bond?: number | null; note?: string }
/** net_reserves: registry net_reserves (IRFCL I + drains, unfloored, may be negative); a2_reserve_base: A2's floored
 *  denominator, never used as net reserves; imports over the window joined at the quarter q (rule C2). */
export interface ReplayEcon { stock: number; ids: number | null; loans: number | null; net_reserves: number | null; a2_reserve_base: number | null; a2_floored: number | null; res: number | null; st: number | null; imports_12m: number | null; imports_window_to: number | null; imports_partial: boolean | null; rows: ReplayRow[]; q: string }
export interface Country extends EconomyMeta {
  board: BoardSeries | null; trade: TradeBlock; money: MoneyBlock | null; chokepoints: ChokeRow[]; episodes: string[]; events: string[]; replay: ReplayEcon | null; stress?: StressStrip | null;
}

export interface PulseTile { ds: string; key: string; f: string; pts?: [string, number][]; latest?: [string, number]; chg?: number; kind?: 'abs' | 'pct'; age?: number; stale?: boolean; missing?: boolean }
export interface PulseTic { ds: string; f: string; official: [string, number][]; private: [string, number][]; latest: string; age: number }
export interface Pulse {
  money: { swap_lines: PulseTile; custody_treasuries: PulseTile; dollar_index: PulseTile; tic: PulseTic };
  world_mom: [number, number | null, number, number][]; world_w12: [number, number, number, number, number, number, number][];
  n_out: number; n: number; top: [string, number, number, number][]; quarter: string;
}

export interface Chokepoint { key: string; en: string; ko: string; stage: number; hhi: number; world_bn: number; top_exporters: [string, number][]; top_importers: [string, number][]; econ: Record<string, { x: number | null; m: number | null; ts: string | null; tss: number | null }> }
export interface Chain { id: string; en: string; ko: string; year: number; levels: { en: string; ko: string; who: { en: string; ko: string } }[]; chokepoint: Chokepoint | null; history: Record<string, string> }
export interface Chains { chains: Chain[] }

export interface PairLink {
  bank?: { pos: number | null; flow: number | null; kind: string; per: string };
  portfolio?: { portfolio?: number; portfolio_debt?: number; portfolio_equity?: number; per: string };
  fdi?: { pos: number | null; rep: string; per: string };
  /** per: the exporter's own window (the month its sheet shows); own: that window ends before the shown month */
  goods?: { usd: number; mr: number | null; src: number; est: number; dv: number; per: number; own?: boolean };
}
export type Pairs = Record<string, PairLink>;
/** One unordered pair's channels through time (data/pairs/<A>-<B>.json.br, A < B). `ab` is A → B
 * (A's exports to B, banks in A on residents of B, holders in A of B's securities, investors in A in B), `ba` the
 * reverse. Goods by 12-month window to each month (USD bn; null where the pair is below trade-flow's backbone that
 * month), `ab2` the other report of the same flow where both exist (the mirror band); bank by quarter, portfolio by
 * half year, direct investment by year; the ratio by quarter (positions both ways over goods both ways). */
export interface PairHistory {
  a: string; b: string; shown: number;
  goods: { t: number[]; ab: (number | null)[]; ba: (number | null)[]; ab2: (number | null)[]; ba2: (number | null)[]; est_ab: (number | null)[]; est_ba: (number | null)[] };
  bank: { q: string[]; ab: (number | null)[]; ba: (number | null)[] };
  portfolio: { p: string[]; ab: (number | null)[]; ba: (number | null)[] };
  fdi: { y: string[]; ab: (number | null)[]; ba: (number | null)[] };
  ratio: { q: string[]; v: (number | null)[]; fin?: (number | null)[]; goods?: (number | null)[]; t_ab?: (number | null)[]; t_ba?: (number | null)[]; partial?: (boolean | null)[] };
  per: { goods: number; bank: string | null; portfolio: string | null; fdi: string | null };
}
/** total: BIS:5A (all reporters) at the same quarter q, the denominator of every lender share. */
export interface Lenders { q: string; debtors: Record<string, Record<string, number>>; total?: Record<string, number>; total_from?: string }
export interface Dollar { dollar_yoy: [string, number][]; lag: number; econ: Record<string, { pts: [string, number, number, number | null][]; corr: number | null; a1_mean: number | null }>; terciles: Record<'low' | 'mid' | 'high', { econ: string[]; corr: number | null; slope: number | null; n: number }> }
/** AUROC per indicator with its bootstrap interval (lo, hi: the central `interval.level` % over `interval.draws` redraws of the economy-episodes). */
export interface Indicator { id: string; en: string; ko: string; auroc: number | null; lo: number | null; hi: number | null; pos: number; neg: number; side: 'money' | 'trade' | 'both' }
export interface Validation { episodes: number; indicators: Indicator[]; interval: { draws: number; level: number; over: string }; set?: { pre: number; threshold: number; source: string } }
/** One change item. Money kinds come from money-flow's changes/global, trade kinds from trade-flow's changes.json; the
 * joint kinds (side 'both') are computed here: funding_exports (F turned negative while 12-month exports turned down in
 * the same economy), chokepoint_lender (a chain's chokepoint moved while funding left one of the stage's top exporters). */
export interface Change { eco?: string; side: 'money' | 'trade' | 'both'; kind: string; q?: string; t?: number; v?: [number, number]; flow?: [number, number]; b1?: number; b2?: number; a2?: [number, number]; basis?: string; mom?: [number, number]; partner?: string; dir?: number; mr?: number | null; chain?: string; chain_name?: { en: string; ko: string }; year?: number; from?: string | null; to?: string | null; from_name?: { en: string; ko: string } | null; to_name?: { en: string; ko: string } | null; share?: number | null; stage_name?: { en: string; ko: string }; count?: [number, number]; K?: number; fired?: string[]; j4?: [number | null, number | null]; terc?: [number, number] }
export interface Changes { q: string; prev_q: string | null; t: number; prev_t?: number | null; items: Change[]; via?: { money: string; trade: string; stress?: string } }
/** The build's governance checks (scripts/build.py): each passes or warns with its figure; the build log holds the detail. */
export interface Check { id: string; status: 'pass' | 'warn' | 'fail' | 'wait'; en: string; ko: string; figure: string; detail?: unknown }
export interface Checks { built: string; items: Check[]; log: string; tolerance?: { pairs_pct: number; interval: { draws: number; level: number } } }
export interface Replay { quarters: { episode: string; q: string; en: string; ko: string }[]; econ: Record<string, ReplayEcon> }

/** How economies earn (data/earn.json.br): annual current-account split, display only (G5, G6). */
export type Quadrant = 'trade' | 'finance' | 'both' | 'neither';
export interface EarnEcon {
  gs: (number | null)[]; pi: (number | null)[]; pc: (number | null)[]; gdp: (number | null)[]; niip: (number | null)[]; q: (Quadrant | null)[];
  /** 1 where net IIP was filled from gross IIP positions over WDI GDP because the board has no value */
  nf?: number[];
  /** exports and imports of goods and services, BoP basis: % of GDP and USD bn (xg - mg = gs) */
  xg: (number | null)[]; mg: (number | null)[]; xu: (number | null)[]; mu: (number | null)[];
  /** gross external assets and liabilities at the year's last published quarter (IMF IIP): USD bn and % of GDP */
  fa: (number | null)[]; fl: (number | null)[]; fag: (number | null)[]; flg: (number | null)[];
}
export interface EarnHold { chain: string; en: string; ko: string; stage: string; stage_ko: string; share: number; hhi: number; year: number }
export interface EarnPanel { t: number; hm: number | null; x_share: number | null; x_bn: number | null; holds: EarnHold[]; a1: number | null; a1q: string | null; a1_local: number | null; prod: Products }
export interface EarnCheck { eco: string; axis: string; test: string; en: string; ok: boolean; gs?: number | null; pi?: number | null; quad?: Quadrant | null; note?: string }
/** The quarterly frame (data/earn.json.br `q`): flows are rolling 4-quarter sums over rolling 4-quarter USD GDP, stocks at
 * quarter end; periods "2005-Q1"…; null where a series is missing (never interpolated). Display only. */
export interface EarnQEcon { gs: (number | null)[]; pi: (number | null)[]; xg: (number | null)[]; mg: (number | null)[]; xu: (number | null)[]; mu: (number | null)[]; gdp: (number | null)[]; fa: (number | null)[]; fl: (number | null)[]; fag: (number | null)[]; flg: (number | null)[]; niip: (number | null)[]; pc: (number | null)[]; nf?: number[] }
export interface EarnQ {
  periods: string[]; econ: Record<string, EarnQEcon>;
  latest: { bop?: string | null; gdp?: string | null; iip?: string | null; fx?: string | null };
  econ_latest?: Record<string, { bop?: string | null; gdp?: string | null; iip?: string | null }>;
  checks?: { eco: string; series: string; median_ratio: number | null; unit_used: string | null; ok: boolean; note?: string }[];
  read: string; sources?: Record<string, unknown>;
}
export type RegionGroup = 'apac' | 'europe' | 'americas' | 'mea';
export interface EarnGroup { region: RegionGroup; euro: boolean; advanced: boolean; borrower: boolean }
/** Who holds an economy's gross external liabilities (the funding lens): per year the share held by the three
 * largest named creditor economies and by all named creditors (bank loans and deposits + portfolio + direct investment
 * at each channel's latest period in the year, over IMF IIP gross liabilities), the three for the latest year with their
 * shares, and the periods used. Aggregates are never a creditor; a lower bound (confidential cells, uncovered instruments). */
export interface EarnFund { top3: (number | null)[]; named: (number | null)[]; who: [string, number][] | null; year: number | null; per: { bank?: string; portfolio?: string; fdi?: string } | null }
export interface Earn { years: number[]; band: number; read: string; updated: string | null; series: Record<string, string>; econ: Record<string, EarnEcon>; panel: Record<string, EarnPanel>; checks: EarnCheck[]; hub: string; q?: EarnQ; groups?: Record<string, EarnGroup>; latest?: { wdi: number }; via?: { money_release: string; view: string }; fund?: Record<string, EarnFund> }

/** Shock replay (data/shocks/<id>.json.br, scripts/shocks.py). Months are YYYYMM numbers. */
export interface ShockNode { id: string; wave: 1 | 2 | 3; xy: [number, number]; board: boolean; c: (number | null)[]; from_origins_bn?: number; share?: number }
export interface ShockEdge { s: string; t: string; wave: 2 | 3; v: (number | null)[]; y: (number | null)[]; held: number[] }
export interface ShockFin { f: number | null; v: number | null; a2: number | null; vx: number; ax: number }
export interface ShockSummaryRow { eco: string; x: number | null; xt: number | null; f0: number | null; f1: number | null; fd: number | null; quad: Quadrant | null; wave: 1 | 2 | 3 | null }
export interface Shock {
  id: string; label: { en: string; ko: string }; note: { en: string; ko: string } | null;
  event: { num: string; start: string; end: string | null; ongoing: boolean; kind: string; title: { en: string; ko: string }; dek: { en: string; ko: string } | null; economies: string[] };
  t0: number; base: number; months: number[]; shown: number; nodata: boolean[]; coverage: (number | null)[];
  windows?: { expected: number; found: number; missing: number[]; slugs: string[] };
  wave1: { en: string; ko: string }; wave3: { en: string; ko: string }; products: Record<string, string[]>;
  rule: { n2: number; min_share: number; n3: number; per: number };
  nodes: ShockNode[]; edges: ShockEdge[]; waves: Record<string, (number | null)[]>; trough: Record<string, { t: number; v: number }>;
  quarters: string[]; finance: Record<string, Record<string, ShockFin>>;
  dollar: [string, number][]; swap: [string, number][];
  summary: ShockSummaryRow[]; medians: Record<Quadrant, { n: number; x: number | null; nx: number; fd: number | null; nf: number }>; summary_year: number;
}
export interface ShockIndex { replays: { id: string; label: { en: string; ko: string }; t0: number; ongoing: boolean; title: { en: string; ko: string } }[] }

/** Stress signals (data/stress.json.br, scripts/stress.py, config/stress.yaml): seven joint signals J1-J7, the count at K,
 * the composite under G19, the three validations. Arrays in `grid` run over `quarters`. */
export type StressRuleId = 'j1' | 'j2' | 'j3' | 'j4' | 'j5' | 'j6' | 'j7';
export type StressChannel = 'funding' | 'trade' | 'both';
type LT = { en: string; ko: string };
export interface StressRule {
  id: StressRuleId; en: string; ko: string; unit: LT; formula: string; money: LT & { src: string }; trade: LT & { src: string };
  dir: 'low' | 'high'; threshold: number | null; threshold_from: 'convention' | 'validation' | 'definition'; slider: [number, number, number] | null; channel: StressChannel;
  single: { money: LT & { dir: string }; trade: LT & { dir: string } }; fire?: { f_below: number; mom_pct_at_most: number } | null; scope?: string | null; min_coverage?: number | null;
  n: number; econ: number; first: string | null;
}
export type StressGrid = Record<string, (number | string | null)[]>;
export interface StressCand { t: number; label: string | null; tpr: number | null; fpr: number | null; j: number | null; pos: number; calm: number }
export interface StressRuleValid {
  auroc: number | null; pos: number; neg: number;
  common: { pos: number; neg: number; j: number | null; money: number | null; trade: number | null; j_lo: number | null; j_hi: number | null };
  better: 'money' | 'trade'; inc: number | null; inc_lo: number | null; inc_hi: number | null; admitted: boolean;
  loo: { min: number; min_drop: string; max: number; max_drop: string } | null; threshold: number | null; tpr: number | null; fpr: number | null;
  holdout: { tpr: number | null; fpr: number | null; pos: number; calm: number }; candidates: { rows: StressCand[]; chosen: number } | null;
}
export interface StressDesign { id: string; en: string; ko: string; auroc?: number | null; lo?: number | null; hi?: number | null; v?: number | null; diff?: number | null; diff_lo?: number | null; diff_hi?: number | null; pos?: number; neg?: number; pass?: boolean; skipped?: string }
export interface StressTradeTest { id: string; label: LT; t0: number; q: string; n: number; rho: number | null; p: number | null; rho_comp: number | null; rows: { eco: string; count: number; comp: number | null; x: number; xt: number | null }[] }
export interface StressExpect { id: string; en: string; ko: string; pass: boolean; got: unknown }
export interface Stress {
  version: string; written: string; K: number; K_range: [number, number]; quarters: string[]; latest: string; econs: string[];
  rules: StressRule[]; grid: Record<string, StressGrid>; channels: Record<StressChannel, StressRuleId[]>;
  validation: {
    funding: {
      rules: Record<StressRuleId, StressRuleValid>; set: { pre: number; global_windows: [string, string][]; train_to: string; draws: number; level: number; episodes: number };
      count: { auroc: number | null; lo: number | null; hi: number | null; v: number | null; v_lo: number | null; v_hi: number | null; diff: number | null; diff_lo: number | null; diff_hi: number | null; pos: number; neg: number; K: number; tpr: number | null; fpr: number | null; holdout: { tpr: number | null; fpr: number | null; pos: number; calm: number }; loo: { min: number; min_drop: string; max: number; max_drop: string } | null };
      v: { auroc: number | null; pos: number; neg: number }; designs: StressDesign[]; admitted: StressRuleId[]; composite: string | null;
    };
    fiscal: { spells: { eco: string; start: string; data: boolean; max?: number; hit?: boolean }[]; with_data: number; hits: number; hit_rate: number | null; calm: number; false: number; false_rate: number | null; auroc: number | null; K: number; money_flow: { auroc: number | null; hit_rate: number | null; false_rate: number | null; hits: number | null; episodes: number | null }; pre_years: [number, number]; calm_gap: number; global_years: number[] };
    trade: StressTradeTest[];
  };
  expectations: StressExpect[];
  partners: { q: string; net: { e: string; p: string; w: number; v: number; f: number | null; x: number }[]; pairs: { e: string; p: string; lend: number; dest: number; min: number }[] };
  bands: { funding: { id: string; en: string; ko: string; q: string; eco: string[] }[]; fiscal: { eco: string; start: string; end: string }[]; events: { id: string; start: string; en: string; ko: string; eco: string[] }[] };
  designs: { id: string; en: string; ko: string }[]; train_to: string; trade_max_lag: number;
}
export interface StressEco {
  code: string; q: string[];
  inputs: Record<'t' | 'lag' | 'x' | 'm' | 'res_net' | 'a2_base' | 'st' | 'need' | 'fp' | 'mp' | 'j4f' | 'cov' | 'd4' | 'slope' | 'terc' | 'com' | 'buf' | 'gdp' | 'mom', (number | null)[]> & { j1_nm?: (string | null)[] };
  single: Record<StressRuleId, { money: (number | null)[]; trade: (number | null)[] }>;
  partners: { q: string; t: number; lq: string; dests: { p: string; share: number; v: number | null; board: boolean; eco?: boolean }[]; lenders: { p: string; share: number }[]; overlap: { p: string; lend: number; dest: number; min: number }[] } | null;
}
export interface StressStrip { q: string; count: number | null; comp: number | null; v: number | null; ch: StressChannel | null; lead: StressRuleId | null; lag: number | null; tm: number | null; K: number; fired: StressRuleId[]; scored: number }
