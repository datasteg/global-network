// The country sheet /{lang}/c/{iso3} as a view: the funding section (V, F, A2, net IIP, the five largest bank lenders,
// the stress strip, the replay tile) and the trade section (12-month totals, five destinations and suppliers, five HS
// chapters each way, the chokepoint table), each at its own period. part=funding adds V and F by quarter (the two
// lines of the funding chart), part=trade the 12-month export and import line by month.
import { readBoard, readCountry, readLenders, readMeta } from '@/lib/data';
import { siteUrl } from '@/lib/family';
import { hsName } from '@/lib/hs';
import { t } from '@/lib/i18n';
import { plain } from '@/lib/rich';
import { country as countryStrings } from '@/lib/strings/country';
import type { Country, Lang, Meta } from '@/lib/types';
import { BOARD_SRC, bnUsd, economyParam, enumParam, envelope, lastIdx, n, nameEn, nameOf, round, sources, win, window12m, yearBefore, ym, type BasisMap, type Cite, type Envelope } from './common';

export const COUNTRY_PARTS = ['sheet', 'funding', 'trade'] as const;
export type CountryPart = (typeof COUNTRY_PARTS)[number];
const TOP = 5;
/** Partner 490's node (S19, registry asia_nes): a partner, not an economy. */
export const NES_NOTE = 'UN Comtrade’s ‘Other Asia, not elsewhere specified’: most importers book their trade with Taiwan here; Gulf exporters book unnamed Asian destinations here.';
const EST = t('en').est;

export function countryView(raw: string, sp: URLSearchParams, lang: Lang): Envelope {
  const code = economyParam(raw, 'iso3', true);
  const part = enumParam(sp, 'part', COUNTRY_PARTS, 'sheet');
  return buildCountry(code, lang, part);
}

export function buildCountry(code: string, lang: Lang, part: CountryPart = 'sheet'): Envelope {
  const meta = readMeta();
  const c = readCountry(code);
  if (!c) throw new Error(`no country file ${code}`);
  const funding = fundingOf(c, meta, lang);
  const trade = tradeOf(c, meta, lang);
  const stress = c.stress ? {
    quarter: c.stress.q, signals_at_threshold: c.stress.count, signals_scored: c.stress.scored, reading_threshold_k: c.stress.K,
    reached: (c.stress.count ?? 0) >= c.stress.K, firing: c.stress.fired.map((x) => x.toUpperCase()),
    channel_first: c.stress.ch, led_by: c.stress.lead ? c.stress.lead.toUpperCase() : null, composite: null,
    page: `/${lang}/stress?e=${code}`,
  } : null;
  const replay = replayOf(c, meta);
  const data: Record<string, unknown> = {
    economy: code, name: c[lang] ?? nameOf(code, lang), region: c.region, subregion: c.subregion, advanced: c.advanced ?? null, euro_from: c.euro_from ?? null,
    hub: code === meta.hub,
    periods: { funding_quarter: funding ? meta.money.quarter : null, bank_lenders_quarter: funding?.bank_lenders ? readLenders().q : null, goods_window: window12m(c.trade.now.t), goods_window_at_quarter: c.trade.at_q ? { quarter: c.trade.at_q.q, ...window12m(c.trade.at_q.t), partial: c.trade.at_q.partial } : null, products_window: c.trade.products ? window12m(c.trade.products.t) : null, chokepoint_year: meta.trade.complete.A },
    unit: 'USD', scale: 'bn',
    funding: part === 'trade' ? undefined : funding,
    trade: part === 'funding' ? undefined : trade,
    stress_signals: stress,
    withdrawal_replay: part === 'trade' ? undefined : replay,
    links: [
      { label: 'Country sheet', page: `/${lang}/c/${code}` },
      ...(stress ? [{ label: 'Stress signals for this economy', page: `/${lang}/stress?e=${code}` }] : []),
      { label: `Pair with ${nameEn(code === 'KOR' ? 'USA' : 'KOR')}`, page: `/${lang}/c/${code}/with/${code === 'KOR' ? 'USA' : 'KOR'}` },
      ...(funding ? [{ label: 'The economy in money-flow', page: siteUrl('money-flow', 'economy', lang, { iso3: code }) }] : []),
      { label: 'The economy in trade-flow', page: siteUrl('trade-flow', 'economy', lang, { iso3: code }) },
    ],
  };
  let table: Envelope['table'];
  if (part === 'funding' && c.board) {
    const b = c.board;
    data.series = { freq: 'Q', from: b.q[0], to: b.q[b.q.length - 1], note: 'V (0–100, higher is more vulnerable) and the flow score F (% a year, bank and bond funding) by quarter, as the funding chart draws them; shaded quarters are funding_section.stress_episodes.' };
    table = { columns: [{ id: 'quarter', label: 'Quarter end' }, { id: 'v', label: 'Vulnerability score V', unit: '0-100' }, { id: 'f', label: 'Flow score F', unit: '% a year' }], rows: b.q.map((q, i) => [q, b.v[i], b.flow[i]]) };
  } else if (part === 'trade') {
    const tr = c.trade;
    data.series = { freq: 'M', from: ym(tr.t[0]), to: ym(tr.t[tr.t.length - 1]), note: 'Exports and imports over the 12 months ending in each month, USD bn, as the trade chart draws them; null where fewer than 90% of the economy’s usual flows were filed.' };
    table = { columns: [{ id: 'month', label: 'Month (end of the 12-month window)' }, { id: 'exports_12m', label: 'Exports, 12 months', unit: 'USD bn' }, { id: 'imports_12m', label: 'Imports, 12 months', unit: 'USD bn' }], rows: tr.t.map((m, i) => [ym(m), tr.x[i], tr.m[i]]) };
  } else {
    table = { columns: [{ id: 'section', label: 'Section' }, { id: 'measure', label: 'Measure' }, { id: 'value', label: 'Value' }, { id: 'unit', label: 'Unit' }, { id: 'period', label: 'Period' }], rows: headlineRows(code).map((h) => [h.section, h.label, h.value, h.unit, h.period]) };
  }
  if (part === 'funding' && !c.board) data.series = null;

  const cites: Cite[] = [];
  if (part !== 'trade' && funding) cites.push(...BOARD_SRC.map((src) => ({ src, period: `${qLabel(meta.money.quarters[0])} to ${qLabel(meta.money.quarter)}, quarterly` })));
  if (part !== 'funding') {
    cites.push({ src: 'comtrade', period: `12-month window, ${window12m(c.trade.now.t).from} to ${window12m(c.trade.now.t).to}` });
    if (code === 'KOR') cites.push({ src: 'kcs', period: '2000–2012 and the latest months, monthly' });
  }
  const page = `/${lang}/c/${code}${part === 'funding' ? '#funding' : part === 'trade' ? '#trade' : ''}`;
  return envelope('country', page, {
    period: { freq: part === 'trade' ? 'M' : 'Q', shown: part === 'trade' ? ym(c.trade.now.t) : meta.money.quarter, newest: part === 'trade' ? ym(c.trade.now.t) : meta.money.quarter, goods_window: window12m(c.trade.now.t), funding_quarter: meta.money.quarter },
    sources: sources(cites, meta), summary: countrySummary(c, funding, part), data, table, basis: countryBasis(c, meta, part, data),
    notes: [
      'Each figure carries its own period: funding at money-flow’s board quarter, goods over the 12-month window, chokepoints at trade-flow’s latest complete year. basis names each number’s measure (family/measures.json) and period.',
      'Goods exports come twice, never mixed: exports_12m_newest_usd_bn is the newest complete 12-month window (the sheet’s); exports_12m_at_quarter_usd_bn is the window joined with the funding quarter (ending in the quarter’s last month, or up to 6 months earlier and then partial), the one the stress signals use. exports_12m_usd_bn is a deprecated alias of the newest.',
      'Growth figures compare a window with the window ending exactly 12 months earlier (yoy_base_window_to); goods exports are as partners record them (CIF, origin), so they differ from the economy’s own customs figures by design.',
      'Goods values are trade-flow’s shares of world trade times the world total; partner-reported or estimated where the importer has not filed (estimate field). No original Comtrade records.',
      ...(code === meta.hub ? [plain(countryStrings('en').hubNote)] : []),
    ],
  }, meta);
}

const qLabel = (iso: string) => { const [y, m] = iso.split('-').map(Number); return `Q${Math.ceil(m / 3)} ${y}`; };

function fundingOf(c: Country, meta: Meta, lang: Lang) {
  const b = c.board;
  if (!b) return null;
  const k = b.q.length - 1;
  const board = readBoard();
  const ranks = meta.economies.map((e) => { const i = lastIdx(board[e.code]?.v); return { e: e.code, v: i >= 0 ? (board[e.code].v[i] as number) : -1 }; }).sort((a, z) => z.v - a.v);
  const lenders = readLenders();
  const total = b.loans[k];
  // lender shares over the all-reporter total of the same quarter as the positions (the build stops when the
  // links table and the board are at different quarters)
  const all5a = lenders.total?.[c.code] ?? null;
  const top = Object.entries(lenders.debtors[c.code] ?? {}).sort((a, z) => z[1] - a[1]).slice(0, TOP);
  return {
    quarter: b.q[k],
    vulnerability_v: { value: b.v[k], scale: '0-100, higher is more vulnerable', rank: ranks.findIndex((r) => r.e === c.code) + 1, of: meta.economies.length },
    flow_score_f: { value: b.flow[k], unit: '% a year', what: 'bank and bond funding coming in (above zero) or leaving (below zero)' },
    short_term_claims_to_reserves_a2: {
      name: 'A2: BIS banks’ claims due within a year ÷ reserve base', value_pct: b.a2[k], reserves_basis: b.a2_basis[k], reserve_base_floored: !!b.a2_floored[k], scored: b.a2_scored[k] !== 0,
      bank_claims_due_within_year_usd_bn: b.st[k], a2_reserve_base_usd_bn: b.res_net[k],
    },
    net_reserves_usd_bn: b.res_net_raw?.[k] ?? null,
    gross_reserves_usd_bn: b.res[k],
    net_iip_pct_gdp: b.niip[k],
    bank_lenders: top.length ? {
      quarter: lenders.q, basis: 'loans and deposits of BIS reporting banking systems on this economy, residence basis; shares of the all-reporter total (BIS:5A) at the same quarter',
      total_loans_usd_bn: total, all_reporters_total_usd_bn: all5a,
      top: top.map(([e, v]) => ({ lender: e, name: nameOf(e, lang), position_usd_bn: v, share_of_loans_pct: all5a ? round((100 * v) / all5a, 1) : null })),
    } : null,
    stress_episodes: c.episodes.map((id) => ({ id, name: meta.episodes[id]?.[lang] ?? id, quarter: meta.episodes[id]?.q ?? null })),
  };
}

function tradeOf(c: Country, meta: Meta, lang: Lang) {
  const tr = c.trade;
  const kt = tr.t.indexOf(tr.now.t);
  const partner = (d: Country['trade']['dests'][number]) => ({ partner: d.p, name: nameOf(d.p, lang), economy: d.eco !== false, ...(d.eco === false ? { note: NES_NOTE } : {}), value_usd_bn: d.usd, share_pct: d.share, yoy_pct: d.yoy, estimate: EST[d.est] ?? null, mirror_divergence: !!d.dv });
  const prod = (side: 'x' | 'm') => {
    const p = tr.products;
    if (!p) return null;
    const rows = p[side].slice(0, TOP);
    const total = side === 'x' ? p.x_bn : p.m_bn;
    const sum = rows.reduce((a, r) => a + r[side], 0);
    return {
      total_usd_bn: total,
      top: rows.map((r) => ({ hs_chapter: r.ch, name: hsName(r.ch, lang), value_usd_bn: r[side], share_pct: side === 'x' ? r.xs : r.ms, yoy_pct: side === 'x' ? r.xy : r.my, net_usd_bn: round(r.x - r.m, 2), estimated: (side === 'x' ? r.xe : r.me) ? EST[side === 'x' ? r.xe : r.me] : null })),
      other_usd_bn: total != null && total - sum > 0 ? round(total - sum, 2) : null,
    };
  };
  const aq = tr.at_q ?? null;
  const base = kt >= 0 ? (tr.mom_base?.[kt] ?? yearBefore(tr.now.t)) : null;
  return {
    window: window12m(tr.now.t),
    exports_12m_newest_usd_bn: tr.now.x_bn, imports_12m_newest_usd_bn: tr.now.m_bn,
    newest_window_from: win(tr.now.t).window_from, newest_window_to: win(tr.now.t).window_to,
    exports_yoy_pct: kt >= 0 ? tr.mom_x[kt] : null, imports_yoy_pct: kt >= 0 ? tr.mom_m[kt] : null,
    yoy_base_window_from: win(base).window_from, yoy_base_window_to: win(base).window_to,
    exports_12m_at_quarter_usd_bn: aq?.x_bn ?? null, imports_12m_at_quarter_usd_bn: aq?.m_bn ?? null,
    at_quarter: aq?.q ?? null, at_quarter_window_from: win(aq?.t).window_from, at_quarter_window_to: win(aq?.t).window_to,
    at_quarter_partial: aq ? aq.partial : null, at_quarter_months_before_quarter_end: aq ? aq.lag : null,
    exports_yoy_at_quarter_pct: aq?.mom_x ?? null, imports_yoy_at_quarter_pct: aq?.mom_m ?? null,
    at_quarter_yoy_base_window_to: win(aq?.base ?? null).window_to,
    exports_12m_usd_bn: tr.now.x_bn, imports_12m_usd_bn: tr.now.m_bn,
    deprecated: { exports_12m_usd_bn: 'alias of exports_12m_newest_usd_bn', imports_12m_usd_bn: 'alias of imports_12m_newest_usd_bn' },
    export_market_hhi: tr.now.hm,
    destinations: tr.dests.slice(0, TOP).map(partner),
    suppliers: tr.sups.slice(0, TOP).map(partner),
    products: tr.products ? { window: window12m(tr.products.t), exports: prod('x'), imports: prod('m') } : null,
    chokepoints: [...c.chokepoints].sort((a, z) => (z.m ?? 0) - (a.m ?? 0)).slice(0, 12).map((r) => ({
      chain: r.chain, chain_name: lang === 'ko' ? r.ko : r.en, stage: lang === 'ko' ? r.stage_ko : r.stage, hhi: r.hhi,
      top_exporters: r.top.map(([e, s]) => ({ economy: e, name: nameOf(e, lang), share_pct: s })),
      import_share_pct: r.m ?? null, top_supplier: r.ts ? { economy: r.ts, name: nameOf(r.ts, lang), share_pct: r.tss ?? null } : null,
    })),
    chokepoint_year: meta.trade.complete.A,
    trade_events: c.events.map((id) => meta.events.find((e) => e.id === id)).filter((e): e is NonNullable<typeof e> => !!e).map((e) => ({ id: e.id, title: e[lang], start: e.start, end: e.end })),
  };
}

function replayOf(c: Country, meta: Meta) {
  const r = c.replay;
  if (!r) return null;
  const worst = [...r.rows].filter((x) => x.share != null).sort((a, z) => (a.share ?? 0) - (z.share ?? 0))[0];
  if (!worst) return null;
  const onToday = ((worst.share ?? 0) / 100) * r.stock;
  const nr = r.net_reserves;
  return {
    name: 'Bank and bond withdrawal replay',
    what: 'the economy’s worst past quarter of bank-loan and bond withdrawal (BIS LBS loans and deposits flow plus international debt securities net issuance, as a share of their stock) applied to today’s stock at quarter, a first-round calculation',
    quarter: r.q ?? meta.money.quarter,
    worst_quarter: worst.q, change_pct_of_stock: worst.share, on_todays_stock_usd_bn: round(onToday, 1), stock_usd_bn: r.stock,
    net_reserves_usd_bn: nr, a2_reserve_base_usd_bn: r.a2_reserve_base,
    against_net_reserves_pct: nr != null && nr > 0 ? round((100 * Math.abs(onToday)) / nr, 0) : null,
    against_net_reserves_note: nr != null && nr <= 0 ? 'not meaningful: net reserves are not positive (IRFCL Section I plus Section II drains, not floored)' : null,
    imports_12m_usd_bn: r.imports_12m, imports_window_from: win(r.imports_window_to).window_from, imports_window_to: win(r.imports_window_to).window_to, imports_partial: r.imports_partial,
  };
}

/** The sheet's headline tiles, for the economy hook and the sheet table. */
export function headlineRows(code: string) {
  const c = readCountry(code);
  if (!c) return [];
  const out: { section: string; label: string; value: number | null; unit: string; period: string | null; measure: string | null }[] = [];
  const b = c.board;
  if (b) {
    const k = b.q.length - 1;
    out.push({ section: 'funding', label: 'Vulnerability score V', value: b.v[k], unit: '0-100', period: b.q[k], measure: 'money-flow:v' });
    out.push({ section: 'funding', label: 'Flow score F', value: b.flow[k], unit: '% a year', period: b.q[k], measure: 'money-flow:f' });
    out.push({ section: 'funding', label: `A2: BIS banks’ claims due within a year ÷ reserve base (${b.a2_basis[k] === 'gross' ? 'gross reserves' : b.a2_floored[k] ? 'a tenth of gross reserves' : 'net reserves'})`, value: b.a2[k], unit: '%', period: b.q[k], measure: 'a2' });
    out.push({ section: 'funding', label: 'Net IIP / GDP', value: b.niip[k], unit: '%', period: b.q[k], measure: 'money-flow:niip_gdp' });
  }
  const w = window12m(c.trade.now.t);
  out.push({ section: 'trade', label: 'Goods exports as partners record them, 12 months', value: c.trade.now.x_bn, unit: 'USD bn', period: `${w.from}/${w.to}`, measure: 'goods_exports_partner' });
  out.push({ section: 'trade', label: 'Goods imports, 12 months', value: c.trade.now.m_bn, unit: 'USD bn', period: `${w.from}/${w.to}`, measure: 'goods_imports_own' });
  out.push({ section: 'trade', label: 'Export market HHI', value: c.trade.now.hm, unit: '0-1', period: `${w.from}/${w.to}`, measure: 'trade-flow:export_market_hhi' });
  if (c.stress) out.push({ section: 'stress', label: `Stress signals at threshold (of ${c.stress.scored} scored)`, value: c.stress.count, unit: 'count', period: c.stress.q, measure: 'global-network:stress_count' });
  return out;
}

function countrySummary(c: Country, f: ReturnType<typeof fundingOf>, part: CountryPart): string {
  const nm = c.code === readMeta().hub ? `the ${c.en}` : c.en;
  const tr = c.trade;
  const w = window12m(tr.now.t);
  const kt = tr.t.indexOf(tr.now.t);
  const parts: string[] = [];
  if (part !== 'trade') {
    if (f) {
      parts.push(`${nm}, ${qLabel(f.quarter)} (money-flow board from BIS and IMF statistics): vulnerability score V ${n(f.vulnerability_v.value, 0)} of 100 (rank ${f.vulnerability_v.rank} of ${f.vulnerability_v.of}), flow score F ${n(f.flow_score_f.value, 1, true)}% a year, BIS banks’ claims due within a year at ${n(f.short_term_claims_to_reserves_a2.value_pct, 0)}% of A2’s reserve base, net reserves ${f.net_reserves_usd_bn == null ? 'n/a' : `USD ${n(f.net_reserves_usd_bn, 1)} bn`}, net IIP ${n(f.net_iip_pct_gdp, 0, true)}% of GDP.`);
      if (f.bank_lenders?.top[0]) parts.push(`Largest bank lender: ${nameEn(f.bank_lenders.top[0].lender)} (BIS LBS, ${qLabel(f.bank_lenders.quarter)}).`);
    } else parts.push(`${nm.charAt(0).toUpperCase()}${nm.slice(1)} is the hub of the dollar system and has no funding row on money-flow’s board.`);
  }
  if (part !== 'funding') {
    const d = tr.dests[0];
    parts.push(`${part === 'trade' ? `${nm.charAt(0).toUpperCase()}${nm.slice(1)}: goods` : 'Goods'} in the 12 months ${w.from} to ${w.to} (UN Comtrade via trade-flow, exports as partners record them): exports ${bnUsd(tr.now.x_bn)}${kt >= 0 && tr.mom_x[kt] != null ? ` (${n(tr.mom_x[kt], 1, true)}% on the 12 months to ${ym(tr.mom_base?.[kt] ?? null)})` : ''}, imports ${bnUsd(tr.now.m_bn)}${d ? `; largest destination ${nameEn(d.p)} (${n(d.share, 1)}%)` : ''}.`);
  }
  if (c.stress && part !== 'trade') parts.push(`Stress signals, ${qLabel(c.stress.q)}: ${c.stress.count ?? 0} of ${c.stress.scored} at threshold (reading: ${c.stress.K} or more); no composite is published (rule G19).`);
  return parts.join(' ');
}

/** Markdown of the sheet for the item hook (what the page shows, English labels, names in the asked language). */
export function countryText(e: Envelope): string {
  const d = e.data as Record<string, any>;
  const L: string[] = [`# ${d.name} (${d.economy}): country sheet`, '', e.summary, ''];
  const f = d.funding;
  L.push('## Funding', '');
  if (!f) L.push(e.notes?.find((x) => x.includes('hub')) ?? 'No funding row on the board.', '');
  else {
    L.push(`Quarter ${f.quarter}, money-flow board.`, '',
      `- Vulnerability score V: ${n(f.vulnerability_v.value, 0)} (rank ${f.vulnerability_v.rank} of ${f.vulnerability_v.of})`,
      `- Flow score F: ${n(f.flow_score_f.value, 1, true)}% a year`,
      `- A2, BIS banks’ claims due within a year ÷ reserve base (${f.short_term_claims_to_reserves_a2.reserve_base_floored ? 'floored at a tenth of gross reserves' : `${f.short_term_claims_to_reserves_a2.reserves_basis} reserves`}): ${n(f.short_term_claims_to_reserves_a2.value_pct, 0)}%${f.short_term_claims_to_reserves_a2.scored ? '' : ' (shown, not scored)'}`,
      `- Net reserves (IRFCL Section I plus Section II drains, not floored): ${f.net_reserves_usd_bn == null ? 'n/a' : `USD ${n(f.net_reserves_usd_bn, 1)} bn`}`,
      `- Net IIP / GDP: ${n(f.net_iip_pct_gdp, 0, true)}%`, '');
    if (f.bank_lenders) {
      L.push(`Who lends through banks (BIS LBS loans and deposits, ${f.bank_lenders.quarter}, USD bn; shares of all reporters’ ${n(f.bank_lenders.all_reporters_total_usd_bn, 1)} bn at the same quarter):`, '', '| Lender | Position | Share |', '|---|---:|---:|');
      for (const r of f.bank_lenders.top) L.push(`| ${r.name} | ${n(r.position_usd_bn, 1)} | ${r.share_of_loans_pct == null ? '–' : `${n(r.share_of_loans_pct, 1)}%`} |`);
      L.push('');
    }
    if (f.stress_episodes.length) L.push(`Stress quarters shaded on the chart: ${f.stress_episodes.map((x: any) => `${x.name} (${x.quarter})`).join(', ')}.`, '');
  }
  const t = d.trade;
  if (t) {
    L.push('## Trade', '', `Newest 12-month window ${t.window.from} to ${t.window.to}, USD bn; growth against the window to ${t.yoy_base_window_to}.`, '',
      `- Goods exports, as partners record them: ${n(t.exports_12m_newest_usd_bn, 1)} (y/y ${n(t.exports_yoy_pct, 1, true)}%)`,
      `- Goods imports: ${n(t.imports_12m_newest_usd_bn, 1)} (y/y ${n(t.imports_yoy_pct, 1, true)}%)`,
      ...(t.at_quarter ? [`- At the funding quarter ${t.at_quarter} (window ${t.at_quarter_window_from} to ${t.at_quarter_window_to}${t.at_quarter_partial ? ', partial' : ''}): exports ${n(t.exports_12m_at_quarter_usd_bn, 1)} (y/y ${n(t.exports_yoy_at_quarter_pct, 1, true)}% against the window to ${t.at_quarter_yoy_base_window_to}), imports ${n(t.imports_12m_at_quarter_usd_bn, 1)}`] : []),
      `- Export market HHI: ${n(t.export_market_hhi, 2)}`, '');
    for (const [title, rows] of [['Where its goods go', t.destinations], ['Where its imports come from', t.suppliers]] as const) {
      L.push(`${title}:`, '', '| Partner | USD bn | Share | y/y | Estimate |', '|---|---:|---:|---:|---|');
      for (const r of rows as any[]) L.push(`| ${r.name} | ${n(r.value_usd_bn, 1)} | ${n(r.share_pct, 1)}% | ${n(r.yoy_pct, 0, true)}% | ${r.estimate ?? ''}${r.mirror_divergence ? ', mirror divergence' : ''} |`);
      L.push('');
    }
    if (t.products) {
      for (const [title, p] of [['Top exports by HS chapter', t.products.exports], ['Top imports by HS chapter', t.products.imports]] as const) {
        if (!p) continue;
        L.push(`${title} (${t.products.window.from} to ${t.products.window.to}, total ${n(p.total_usd_bn, 1)}):`, '', '| HS | Chapter | USD bn | Share | y/y | Net |', '|---|---|---:|---:|---:|---:|');
        for (const r of p.top) L.push(`| ${r.hs_chapter} | ${r.name} | ${n(r.value_usd_bn, 1)} | ${n(r.share_pct, 1)}% | ${n(r.yoy_pct, 0, true)}% | ${n(r.net_usd_bn, 1, true)} |`);
        if (p.other_usd_bn != null) L.push(`| | Other | ${n(p.other_usd_bn, 1)} | | | |`);
        L.push('');
      }
    }
    if (t.chokepoints.length) {
      L.push(`Exposure to chokepoints (chain stages with HHI above 0.25, ${t.chokepoint_year}):`, '', '| Chain | Stage | HHI | Top exporters | Its import share | Its supplier |', '|---|---|---:|---|---:|---|');
      for (const r of t.chokepoints) L.push(`| ${r.chain_name} | ${r.stage} | ${n(r.hhi, 2)} | ${r.top_exporters.map((x: any) => `${x.name} ${n(x.share_pct, 0)}%`).join(', ')} | ${r.import_share_pct == null ? '–' : `${n(r.import_share_pct, 1)}%`} | ${r.top_supplier ? `${r.top_supplier.name} ${n(r.top_supplier.share_pct, 0)}%` : '–'} |`);
      L.push('');
    }
  }
  const s = d.stress_signals;
  if (s) L.push('## Stress signals', '', `${s.quarter}: ${s.signals_at_threshold} of ${s.signals_scored} signals at threshold (reading: ${s.reading_threshold_k} or more). Firing: ${s.firing.length ? s.firing.join(', ') : 'none'}. Channel first: ${s.channel_first ?? '–'}${s.led_by ? ` (${s.led_by})` : ''}. No composite is published (rule G19).`, '');
  const r = d.withdrawal_replay;
  if (r) L.push('## Bank and bond withdrawal replay', '', `At ${r.quarter}. Worst quarter ${r.worst_quarter}: ${n(r.change_pct_of_stock, 1, true)}% of the stock in one quarter; on today’s stock of ${n(r.stock_usd_bn, 1)} bn that is ${n(r.on_todays_stock_usd_bn, 1, true)} bn, ${r.against_net_reserves_pct == null ? (r.against_net_reserves_note ?? '–') : `${n(r.against_net_reserves_pct, 0)}% of net reserves of ${n(r.net_reserves_usd_bn, 1)} bn`} (first-round calculation).`, '');
  L.push('Sources: ' + e.sources.map((x) => `${x.publisher}, ${x.dataset}${x.via ? ` (via ${x.via})` : ''}`).join('; ') + '.');
  return L.join('\n');
}

/** What each number of the country view is (SVC-CONTRACT 1.1): its measure and its period. */
function countryBasis(c: Country, meta: Meta, part: CountryPart, data: Record<string, unknown>): BasisMap {
  const Q = { quarter: meta.money.quarter };
  const tr = c.trade;
  const nw = win(tr.now.t);
  const B: BasisMap = { 'periods.chokepoint_year': { measure: null, kind: 'count', period: { year: meta.trade.complete.A } } };
  if (data.funding) {
    const lq = readLenders().q;
    Object.assign(B, {
      'funding.vulnerability_v.value': { measure: 'money-flow:v', period: Q },
      'funding.vulnerability_v.rank': { measure: null, kind: 'rank', period: Q },
      'funding.vulnerability_v.of': { measure: null, kind: 'count', period: Q },
      'funding.flow_score_f.value': { measure: 'money-flow:f', period: Q },
      'funding.short_term_claims_to_reserves_a2.value_pct': { measure: 'a2', period: Q },
      'funding.short_term_claims_to_reserves_a2.bank_claims_due_within_year_usd_bn': { measure: 'bank_claims_short_term', period: Q },
      'funding.short_term_claims_to_reserves_a2.a2_reserve_base_usd_bn': { measure: 'a2_reserve_base', period: Q },
      'funding.net_reserves_usd_bn': { measure: 'net_reserves', period: Q },
      'funding.gross_reserves_usd_bn': { measure: 'gross_reserves', period: Q },
      'funding.net_iip_pct_gdp': { measure: 'money-flow:niip_gdp', period: Q },
      'funding.bank_lenders.total_loans_usd_bn': { measure: 'bank_loans_lbs', period: { quarter: '@quarter' } },
      'funding.bank_lenders.all_reporters_total_usd_bn': { measure: 'bank_loans_lbs', period: { quarter: '@quarter' } },
      'funding.bank_lenders.top[].position_usd_bn': { measure: 'bank_loans_lbs', period: { quarter: lq } },
      'funding.bank_lenders.top[].share_of_loans_pct': { measure: 'lender_share', kind: 'share', period: { quarter: lq } },
    });
  }
  if (data.trade) {
    const newest = { window_from: '@newest_window_from', window_to: '@newest_window_to' };
    const atq = { quarter: '@at_quarter', window_from: '@at_quarter_window_from', window_to: '@at_quarter_window_to', partial: '@at_quarter_partial' };
    const pw = tr.products ? win(tr.products.t) : nw;
    const pBase = tr.products ? win(yearBefore(tr.products.t)).window_to : null;
    const year = { year: meta.trade.complete.A };
    Object.assign(B, {
      'trade.exports_12m_newest_usd_bn': { measure: 'goods_exports_partner', period: newest },
      'trade.imports_12m_newest_usd_bn': { measure: 'goods_imports_own', period: newest },
      'trade.exports_12m_usd_bn': { measure: 'goods_exports_partner', period: newest },
      'trade.imports_12m_usd_bn': { measure: 'goods_imports_own', period: newest },
      'trade.exports_yoy_pct': { measure: 'goods_trade_growth', period: { window_to: '@newest_window_to', base_window_to: '@yoy_base_window_to' } },
      'trade.imports_yoy_pct': { measure: 'goods_trade_growth', period: { window_to: '@newest_window_to', base_window_to: '@yoy_base_window_to' } },
      'trade.exports_12m_at_quarter_usd_bn': { measure: 'goods_exports_partner', period: atq },
      'trade.imports_12m_at_quarter_usd_bn': { measure: 'goods_imports_own', period: atq },
      'trade.at_quarter_months_before_quarter_end': { measure: null, kind: 'count', period: { quarter: '@at_quarter' } },
      'trade.exports_yoy_at_quarter_pct': { measure: 'goods_trade_growth', period: { window_to: '@at_quarter_window_to', base_window_to: '@at_quarter_yoy_base_window_to' } },
      'trade.imports_yoy_at_quarter_pct': { measure: 'goods_trade_growth', period: { window_to: '@at_quarter_window_to', base_window_to: '@at_quarter_yoy_base_window_to' } },
      'trade.export_market_hhi': { measure: 'trade-flow:export_market_hhi', kind: 'index', period: nw },
      'trade.destinations[].value_usd_bn': { measure: 'goods_exports_partner', period: nw },
      'trade.destinations[].share_pct': { measure: 'goods_exports_partner', kind: 'share', period: nw },
      'trade.destinations[].yoy_pct': { measure: 'goods_trade_growth', period: { window_to: nw.window_to, base_window_to: win(yearBefore(tr.now.t)).window_to } },
      'trade.suppliers[].value_usd_bn': { measure: 'goods_imports_own', period: nw },
      'trade.suppliers[].share_pct': { measure: 'goods_imports_own', kind: 'share', period: nw },
      'trade.suppliers[].yoy_pct': { measure: 'goods_trade_growth', period: { window_to: nw.window_to, base_window_to: win(yearBefore(tr.now.t)).window_to } },
      'trade.products.exports.total_usd_bn': { measure: 'goods_exports_partner', period: pw },
      'trade.products.exports.other_usd_bn': { measure: 'goods_exports_partner', period: pw },
      'trade.products.exports.top[].value_usd_bn': { measure: 'goods_exports_partner', period: pw },
      'trade.products.exports.top[].share_pct': { measure: 'goods_exports_partner', kind: 'share', period: pw },
      'trade.products.exports.top[].yoy_pct': { measure: 'goods_trade_growth', period: { window_to: pw.window_to, base_window_to: pBase } },
      'trade.products.exports.top[].net_usd_bn': { measure: 'trade-flow:net_goods_by_chapter', period: pw },
      'trade.products.imports.total_usd_bn': { measure: 'goods_imports_own', period: pw },
      'trade.products.imports.other_usd_bn': { measure: 'goods_imports_own', period: pw },
      'trade.products.imports.top[].value_usd_bn': { measure: 'goods_imports_own', period: pw },
      'trade.products.imports.top[].share_pct': { measure: 'goods_imports_own', kind: 'share', period: pw },
      'trade.products.imports.top[].yoy_pct': { measure: 'goods_trade_growth', period: { window_to: pw.window_to, base_window_to: pBase } },
      'trade.products.imports.top[].net_usd_bn': { measure: 'trade-flow:net_goods_by_chapter', period: pw },
      'trade.chokepoints[].hhi': { measure: 'trade-flow:stage_hhi', kind: 'index', period: year },
      'trade.chokepoints[].top_exporters[].share_pct': { measure: 'trade-flow:stage_world_export_share', kind: 'share', period: year },
      'trade.chokepoints[].import_share_pct': { measure: 'trade-flow:stage_world_import_share', kind: 'share', period: year },
      'trade.chokepoints[].top_supplier.share_pct': { measure: 'goods_imports_own', kind: 'share', period: year },
      'trade.chokepoint_year': { measure: null, kind: 'count', period: year },
    });
  }
  if (data.stress_signals) {
    const sq = { quarter: '@quarter' };
    Object.assign(B, {
      'stress_signals.signals_at_threshold': { measure: null, kind: 'count', period: sq },
      'stress_signals.signals_scored': { measure: null, kind: 'count', period: sq },
      'stress_signals.reading_threshold_k': { measure: null, kind: 'threshold', period: sq },
    });
  }
  if (data.withdrawal_replay) {
    const rq = { quarter: '@quarter' };
    Object.assign(B, {
      'withdrawal_replay.change_pct_of_stock': { measure: 'withdrawal_replay', period: { quarter: '@worst_quarter' } },
      'withdrawal_replay.on_todays_stock_usd_bn': { measure: 'withdrawal_replay', period: { quarter: '@quarter', replayed_quarter: '@worst_quarter' } },
      'withdrawal_replay.stock_usd_bn': { measure: 'global-network:funding_stock', period: rq },
      'withdrawal_replay.net_reserves_usd_bn': { measure: 'net_reserves', period: rq },
      'withdrawal_replay.a2_reserve_base_usd_bn': { measure: 'a2_reserve_base', period: rq },
      'withdrawal_replay.against_net_reserves_pct': { measure: 'withdrawal_replay', period: { quarter: '@quarter', replayed_quarter: '@worst_quarter' } },
      'withdrawal_replay.imports_12m_usd_bn': { measure: 'goods_imports_own', period: { quarter: '@quarter', window_from: '@imports_window_from', window_to: '@imports_window_to', partial: '@imports_partial' } },
    });
  }
  void part;
  return B;
}
