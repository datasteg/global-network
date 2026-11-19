// The pair page /{lang}/c/{a}/with/{b} as a view: goods, bank claims, portfolio holdings and direct investment
// between two economies, both directions, each at its own period, and the finance-to-trade ratio. history= adds one
// lane of the page's time chart (data/pairs/<A>-<B>.json.br) as a table.
import { readMeta, readPairHistory, readPairs } from '@/lib/data';
import { siteUrl } from '@/lib/family';
import { t } from '@/lib/i18n';
import type { Lang, PairHistory, PairLink } from '@/lib/types';
import { SvcFail, badParam } from '@/lib/svc';
import { bnUsd, economyParam, enumParam, envelope, intParam, n, nameEn, nameOf, round, sources, win, window12m, ym, type BasisMap, type Cite, type Envelope } from './common';

export const PAIR_HISTORY = ['none', 'goods', 'bank', 'portfolio', 'fdi', 'ratio'] as const;
type History = (typeof PAIR_HISTORY)[number];
const EST = t('en').est;
const REPORT: Record<string, string> = { debtor: 'reported by the host', creditor: 'reported by the investor', mirror_debtor: 'the host’s mirror report', mirror_creditor: 'the investor’s mirror report' };
const sum = (...v: (number | null | undefined)[]) => { const k = v.filter((x): x is number => x != null); return k.length ? k.reduce((s, x) => s + x, 0) : null; };

export function pairView(rawA: string, rawB: string, sp: URLSearchParams, lang: Lang): Envelope {
  const a = economyParam(rawA, 'a', true), b = economyParam(rawB, 'b', true);
  if (a === b) throw badParam(`a and b must be two different economies; both are ${a}.`);
  const history = enumParam(sp, 'history', PAIR_HISTORY, 'none');
  const since = intParam(sp, 'since', 2006, 2100, 2006);
  return buildPair(a, b, lang, history, since);
}

function direction(x: PairLink) {
  const g = x.goods, k = x.bank, p = x.portfolio, d = x.fdi;
  return {
    // the exporter's own window: the one its country sheet shows (below 0.9 completeness at the shown month it is the
    // economy's last complete window, own_window true), so the pair and the sheet agree
    goods: g ? { exports_12m_usd_bn: g.usd, window_from: win(g.per).window_from, window_to: ym(g.per), own_window: !!g.own, mirror_ratio: g.mr, estimate: EST[g.est] ?? null, mirror_divergence: !!g.dv } : null,
    bank: k ? { name: 'Bank loans and deposits owed (BIS locational)', position_usd_bn: k.pos, flow_in_quarter_usd_bn: k.flow, flow_kind: k.kind, quarter: k.per } : null,
    portfolio: p ? { total_usd_bn: p.portfolio ?? sum(p.portfolio_equity, p.portfolio_debt), equity_usd_bn: p.portfolio_equity ?? null, debt_usd_bn: p.portfolio_debt ?? null, period: p.per } : null,
    direct_investment: d ? { position_usd_bn: d.pos, report: REPORT[d.rep] ?? d.rep, period: d.per } : null,
  };
}

export function buildPair(a: string, b: string, lang: Lang, history: History = 'none', since = 2006): Envelope {
  const meta = readMeta();
  const pairs = readPairs();
  const ab: PairLink = pairs[`${a}>${b}`] ?? {};
  const ba: PairLink = pairs[`${b}>${a}`] ?? {};
  const per = meta.periods;
  // the headline finance-to-trade ratio is the last point of the ratio lane: positions at that quarter over
  // goods both ways in the 12 months to the quarter end, never goods to the shown month
  const h0 = readPairHistory(a, b);
  const ri = h0 ? h0.ratio.v.reduce<number>((acc, v, i) => (v != null ? i : acc), -1) : -1;
  const f2t = h0 && ri >= 0 ? h0.ratio.v[ri] : null;
  const fin = h0 && ri >= 0 ? h0.ratio.fin?.[ri] ?? null : null;
  const goods = h0 && ri >= 0 ? h0.ratio.goods?.[ri] ?? null : null;
  const ratioQ = h0 && ri >= 0 ? h0.ratio.q[ri] : null;
  // each direction's goods over its exporter's own complete window (the sheet's 0.9 rule), within 6 months of the quarter
  const fwd = h0 ? h0.a === a : true;
  const tA = h0 && ri >= 0 ? (fwd ? h0.ratio.t_ab : h0.ratio.t_ba)?.[ri] ?? null : null;
  const tB = h0 && ri >= 0 ? (fwd ? h0.ratio.t_ba : h0.ratio.t_ab)?.[ri] ?? null : null;
  const rPartial = h0 && ri >= 0 ? h0.ratio.partial?.[ri] ?? null : null;
  const data: Record<string, unknown> = {
    a, b, a_name: nameOf(a, lang), b_name: nameOf(b, lang), unit: 'USD', scale: 'bn',
    periods: { goods_window: window12m(per.goods), bank_quarter: per.bank, portfolio_period: per.portfolio, direct_investment_year: per.fdi },
    directions: 'a_to_b: goods exports of a to b as b records them, over a’s own window; loans and deposits of banks in a on residents of b; securities issued in b held by investors in a; direct investment of investors in a in b. b_to_a: the reverse.',
    a_to_b: direction(ab), b_to_a: direction(ba),
    finance_to_trade: { ratio: round(f2t, f2t != null && f2t >= 10 ? 0 : 1), quarter: ratioQ,
      a_to_b_goods_window_from: win(tA).window_from, a_to_b_goods_window_to: win(tA).window_to,
      b_to_a_goods_window_from: win(tB).window_from, b_to_a_goods_window_to: win(tB).window_to, partial: rPartial,
      financial_positions_both_ways_usd_bn: round(fin, 1), goods_both_ways_usd_bn: round(goods, 1),
      what: 'bank loans and deposits at the quarter, portfolio and direct-investment positions at their latest period at or before it, both directions, over goods trade both ways, each direction over its exporter’s own complete 12-month window ending in the quarter’s last month or up to 6 months earlier (partial): the last point of history=ratio' },
    links: [
      { label: 'Pair page', page: `/${lang}/c/${a}/with/${b}` },
      { label: `${nameEn(a)} country sheet`, page: `/${lang}/c/${a}` },
      { label: `${nameEn(b)} country sheet`, page: `/${lang}/c/${b}` },
      { label: 'The flow in trade-flow', page: siteUrl('trade-flow', 'flow', lang, { a, b }) },
      { label: 'The bank cell in money-flow', page: siteUrl('money-flow', 'bank_pair', lang, { a, b }) },
    ],
  };
  let table: Envelope['table'];
  const cites: Cite[] = [];
  if (history === 'none') {
    const rows: (string | number | null)[][] = [];
    for (const [dir, x] of [['a_to_b', direction(ab)], ['b_to_a', direction(ba)]] as const) {
      rows.push(['goods', dir, 'exports, 12 months', x.goods?.exports_12m_usd_bn ?? null, 'USD bn', x.goods?.window_to ?? null]);
      rows.push(['bank', dir, 'loans and deposits, position', x.bank?.position_usd_bn ?? null, 'USD bn', x.bank?.quarter ?? per.bank]);
      rows.push(['bank', dir, 'loans and deposits, flow in the quarter', x.bank?.flow_in_quarter_usd_bn ?? null, 'USD bn', x.bank?.quarter ?? per.bank]);
      rows.push(['portfolio', dir, 'holdings', x.portfolio?.total_usd_bn ?? null, 'USD bn', x.portfolio?.period ?? per.portfolio]);
      rows.push(['direct_investment', dir, 'position', x.direct_investment?.position_usd_bn ?? null, 'USD bn', x.direct_investment?.period ?? per.fdi]);
    }
    rows.push(['finance_to_trade', 'both', 'ratio', round(f2t, 1), 'times', ratioQ]);
    table = { columns: [{ id: 'channel', label: 'Channel' }, { id: 'direction', label: 'Direction' }, { id: 'measure', label: 'Measure' }, { id: 'value', label: 'Value' }, { id: 'unit', label: 'Unit' }, { id: 'period', label: 'Period' }], rows };
    cites.push({ src: 'comtrade', period: `12-month window, ${window12m(per.goods).from} to ${window12m(per.goods).to}` }, { src: 'bis.lbs', period: `${per.bank}, quarterly` }, { src: 'imf.pip', period: `${per.portfolio}, half-yearly` }, { src: 'imf.dip', period: `${per.fdi.slice(0, 4)}, annual` });
  } else {
    const h = readPairHistory(a, b);
    if (!h) throw new SvcFail(404, 'no-history', 'No history for this pair', `The build wrote no history file for ${a} and ${b}; call without history for the latest values.`);
    const { tbl, meta: lane, cite } = historyLane(h, a, history, since);
    table = tbl; data.history = lane; cites.push(cite);
  }
  const g1 = ab.goods?.usd, g2 = ba.goods?.usd;
  const gw = (g: PairLink['goods']) => (g ? `12 months to ${ym(g.per)}` : 'n/a');
  const summary = `${nameEn(a)} and ${nameEn(b)} (UN Comtrade via trade-flow, exports as partners record them): goods ${bnUsd(g1)} from ${nameEn(a)} to ${nameEn(b)} (${gw(ab.goods)}) and ${bnUsd(g2)} back (${gw(ba.goods)}). `
    + `Bank loans and deposits (BIS LBS, ${per.bank}) ${bnUsd(ab.bank?.pos)} and ${bnUsd(ba.bank?.pos)}; portfolio holdings (IMF PIP, ${per.portfolio}) ${bnUsd(ab.portfolio?.portfolio ?? null)} and ${bnUsd(ba.portfolio?.portfolio ?? null)}; direct investment (IMF DIP, ${per.fdi.slice(0, 4)}) ${bnUsd(ab.fdi?.pos)} and ${bnUsd(ba.fdi?.pos)}, each a to b then b to a. `
    + `Finance to trade: ${f2t == null ? 'n/a' : `${n(f2t, f2t >= 10 ? 0 : 1)} times at ${ratioQ}`}.`;
  return envelope('pair', `/${lang}/c/${a}/with/${b}`, {
    period: { freq: history === 'none' ? 'M' : history === 'goods' ? 'M' : history === 'fdi' ? 'A' : 'Q', shown: ym(per.goods), newest: ym(per.goods), goods_window: window12m(per.goods), bank: per.bank, portfolio: per.portfolio, direct_investment: per.fdi },
    sources: sources(cites, meta), summary, data, table, basis: pairBasis(data),
    notes: ['Each channel at its own period; a missing channel was not reported or the goods flow is below trade-flow’s backbone of 1,500 flows. Goods in each direction are over the exporter’s own window (the one its country sheet shows); own_window marks a window before the shown month.', 'The finance-to-trade ratio is the last quarter of history=ratio. Financial centres show very high ratios because they hold securities for others.'],
  }, meta);
}

function historyLane(h: PairHistory, a: string, lane: Exclude<History, 'none'>, since: number) {
  const fwd = h.a === a;
  const pick = <T,>(x: T, y: T) => (fwd ? [x, y] : [y, x]) as [T, T];
  const from = (p: string | number) => Number(String(p).slice(0, 4)) >= since;
  const cols = (extra: { id: string; label: string; unit?: string }[]) => [{ id: 'period', label: 'Period' }, ...extra];
  if (lane === 'goods') {
    const [x, y] = pick(h.goods.ab, h.goods.ba), [x2, y2] = pick(h.goods.ab2, h.goods.ba2), [ex, ey] = pick(h.goods.est_ab, h.goods.est_ba);
    const rows = h.goods.t.map((m, i) => [ym(m), x[i], y[i], x2[i], y2[i], ex[i] ? EST[ex[i] as number] ?? null : null, ey[i] ? EST[ey[i] as number] ?? null : null] as (string | number | null)[]).filter((r) => from(r[0] as string));
    return {
      tbl: { columns: cols([{ id: 'a_to_b', label: 'Goods a to b, 12 months', unit: 'USD bn' }, { id: 'b_to_a', label: 'Goods b to a, 12 months', unit: 'USD bn' }, { id: 'a_to_b_other_report', label: 'a to b, the other report', unit: 'USD bn' }, { id: 'b_to_a_other_report', label: 'b to a, the other report', unit: 'USD bn' }, { id: 'a_to_b_estimate', label: 'a to b estimate' }, { id: 'b_to_a_estimate', label: 'b to a estimate' }]), rows },
      meta: { channel: 'goods', freq: 'M', since, rows: rows.length, note: 'Each month is the 12-month window ending then; the other report is the mirror (the band on the chart); null where the pair fell below trade-flow’s 1,500 largest flows.' },
      cite: { src: 'comtrade' as const, period: `12-month windows, ${since} to ${ym(h.shown)}, monthly` },
    };
  }
  const simple = (key: 'bank' | 'portfolio' | 'fdi', t: string[], ab: (number | null)[], ba: (number | null)[], freq: string, src: 'bis.lbs' | 'imf.pip' | 'imf.dip', what: string) => {
    const [x, y] = pick(ab, ba);
    const rows = t.map((p, i) => [p, x[i], y[i]] as (string | number | null)[]).filter((r) => from(r[0] as string));
    return {
      tbl: { columns: cols([{ id: 'a_to_b', label: `${what}, a to b`, unit: 'USD bn' }, { id: 'b_to_a', label: `${what}, b to a`, unit: 'USD bn' }]), rows },
      meta: { channel: key === 'fdi' ? 'direct_investment' : key, freq, since, rows: rows.length },
      cite: { src, period: `${since} to ${t[t.length - 1]}, ${freq === 'Q' ? 'quarterly' : freq === 'H' ? 'half-yearly' : 'annual'}` },
    };
  };
  if (lane === 'bank') return simple('bank', h.bank.q, h.bank.ab, h.bank.ba, 'Q', 'bis.lbs', 'Bank loans and deposits');
  if (lane === 'portfolio') return simple('portfolio', h.portfolio.p, h.portfolio.ab, h.portfolio.ba, 'H', 'imf.pip', 'Portfolio holdings');
  if (lane === 'fdi') return simple('fdi', h.fdi.y, h.fdi.ab, h.fdi.ba, 'A', 'imf.dip', 'Direct investment');
  const [ta, tb] = pick(h.ratio.t_ab ?? [], h.ratio.t_ba ?? []);
  const rows = h.ratio.q.map((q, i) => [q, h.ratio.v[i], ym(ta[i] ?? null), ym(tb[i] ?? null), h.ratio.partial?.[i] == null ? null : h.ratio.partial[i] ? 'yes' : 'no'] as (string | number | null)[]).filter((r) => from(r[0] as string));
  return {
    tbl: { columns: cols([{ id: 'ratio', label: 'Finance to trade', unit: 'times' }, { id: 'a_to_b_goods_window_to', label: 'Goods a to b, 12-month window to' }, { id: 'b_to_a_goods_window_to', label: 'Goods b to a, 12-month window to' }, { id: 'partial', label: 'A goods window ends before the quarter’s last month' }]), rows },
    meta: { channel: 'finance_to_trade', freq: 'Q', since, rows: rows.length, note: 'Bank loans and deposits at the quarter, portfolio and direct investment at their latest period at or before it, over goods both ways, each direction over its exporter’s own complete 12-month window ending in the quarter’s last month or up to 6 months earlier (partial; the sheet’s 0.9 completeness rule); no ratio where an exporter has no complete window within 6 months.' },
    cite: { src: 'bis.lbs' as const, period: `${since} to ${h.ratio.q[h.ratio.q.length - 1]}, quarterly` },
  };
}

export function pairText(e: Envelope): string {
  const d = e.data as Record<string, any>;
  const L: string[] = [`# ${d.a_name} and ${d.b_name} (${d.a}, ${d.b}): pair`, '', e.summary, '', 'USD bn; each channel at its own period.', '',
    `| Channel | ${d.a_name} → ${d.b_name} | ${d.b_name} → ${d.a_name} | Period |`, '|---|---:|---:|---|'];
  const x = d.a_to_b, y = d.b_to_a;
  L.push(`| Goods, 12 months | ${n(x.goods?.exports_12m_usd_bn, 1)} | ${n(y.goods?.exports_12m_usd_bn, 1)} | to ${x.goods?.window_to ?? '–'} / to ${y.goods?.window_to ?? '–'} |`);
  L.push(`| Mirror ratio | ${n(x.goods?.mirror_ratio, 2)} | ${n(y.goods?.mirror_ratio, 2)} | |`);
  L.push(`| Bank loans and deposits, position | ${n(x.bank?.position_usd_bn, 1)} | ${n(y.bank?.position_usd_bn, 1)} | ${d.periods.bank_quarter} |`);
  L.push(`| Bank loans and deposits, flow in the quarter | ${n(x.bank?.flow_in_quarter_usd_bn, 1, true)} | ${n(y.bank?.flow_in_quarter_usd_bn, 1, true)} | ${d.periods.bank_quarter} |`);
  L.push(`| Portfolio holdings | ${n(x.portfolio?.total_usd_bn, 1)} | ${n(y.portfolio?.total_usd_bn, 1)} | ${d.periods.portfolio_period} |`);
  L.push(`| of which equity | ${n(x.portfolio?.equity_usd_bn, 1)} | ${n(y.portfolio?.equity_usd_bn, 1)} | |`);
  L.push(`| of which debt securities | ${n(x.portfolio?.debt_usd_bn, 1)} | ${n(y.portfolio?.debt_usd_bn, 1)} | |`);
  L.push(`| Direct investment, position | ${n(x.direct_investment?.position_usd_bn, 1)} | ${n(y.direct_investment?.position_usd_bn, 1)} | ${d.periods.direct_investment_year} |`);
  L.push('', `Finance to trade (positions both ways over goods both ways in the 12 months to the quarter end): ${d.finance_to_trade.ratio == null ? 'n/a' : `${d.finance_to_trade.ratio} times at ${d.finance_to_trade.quarter}, goods to ${d.finance_to_trade.a_to_b_goods_window_to} and ${d.finance_to_trade.b_to_a_goods_window_to}${d.finance_to_trade.partial ? ', partial' : ''}`}.`, '', d.directions, '');
  L.push('Sources: ' + e.sources.map((s) => `${s.publisher}, ${s.dataset}`).join('; ') + '.');
  return L.join('\n');
}

/** What each number of the pair view is (SVC-CONTRACT 1.1). */
function pairBasis(data: Record<string, unknown>): BasisMap {
  const B: BasisMap = {
    'finance_to_trade.ratio': { measure: 'global-network:finance_to_trade', period: { quarter: '@quarter', a_to_b_window_to: '@a_to_b_goods_window_to', b_to_a_window_to: '@b_to_a_goods_window_to', partial: '@partial' } },
    'finance_to_trade.financial_positions_both_ways_usd_bn': { measure: 'global-network:pair_financial_positions', period: { quarter: '@quarter' } },
    'finance_to_trade.goods_both_ways_usd_bn': { measure: 'goods_exports_partner', period: { quarter: '@quarter', a_to_b_window_to: '@a_to_b_goods_window_to', b_to_a_window_to: '@b_to_a_goods_window_to', partial: '@partial' } },
    'history.rows': { measure: null, kind: 'count', period: { from: '@since' } },
    'history.since': { measure: null, kind: 'count', period: { from: '@since' } },
  };
  for (const d of ['a_to_b', 'b_to_a']) Object.assign(B, {
    [`${d}.goods.exports_12m_usd_bn`]: { measure: 'goods_exports_partner', period: { window_from: '@window_from', window_to: '@window_to' } },
    [`${d}.goods.mirror_ratio`]: { measure: 'trade-flow:mirror_ratio', period: { window_from: '@window_from', window_to: '@window_to' } },
    [`${d}.bank.position_usd_bn`]: { measure: 'bank_loans_lbs', period: { quarter: '@quarter' } },
    [`${d}.bank.flow_in_quarter_usd_bn`]: { measure: 'bank_flow_lbs', period: { quarter: '@quarter' } },
    [`${d}.portfolio.total_usd_bn`]: { measure: 'global-network:portfolio_holdings', period: { period: '@period' } },
    [`${d}.portfolio.equity_usd_bn`]: { measure: 'global-network:portfolio_holdings', period: { period: '@period' } },
    [`${d}.portfolio.debt_usd_bn`]: { measure: 'global-network:portfolio_holdings', period: { period: '@period' } },
    [`${d}.direct_investment.position_usd_bn`]: { measure: 'global-network:direct_investment_position', period: { period: '@period' } },
  });
  void data;
  return B;
}
