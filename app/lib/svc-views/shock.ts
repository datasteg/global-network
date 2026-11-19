// The shock replays /{lang}/shocks and /{lang}/shocks/{id} as views. A replay (data/shocks/<id>.json.br) follows a
// shock through trade links month by month: wave 1 the origin's exports, wave 2 its direct importers' purchases,
// wave 3 those importers' sales to third markets, with funding flow scores by quarter, the dollar and swap-line strips,
// the "who was hit" table, medians by how economies earn, and the stress count one quarter before. part=summary (the
// default) is the page's summary and wave lines; part=network the nodes and edges the map draws; part=dollar the two
// weekly strips. economy= focuses the summary (or the network) on one economy.
import { readMeta, readShock, readShocks, readStress } from '@/lib/data';
import { siteUrl } from '@/lib/family';
import { plain } from '@/lib/rich';
import { earn } from '@/lib/strings/earn';
import { shock as shockStrings } from '@/lib/strings/shock';
import { SERIES } from '@/lib/sources';
import { SvcFail, badParam } from '@/lib/svc';
import type { Lang, Quadrant, Shock } from '@/lib/types';
import { economyParam, enumParam, envelope, n, nameEn, nameOf, sources, ym, type BasisMap, type Cite, type Envelope } from './common';

export const SHOCK_PARTS = ['summary', 'network', 'dollar'] as const;
type Part = (typeof SHOCK_PARTS)[number];
const QUADS: Quadrant[] = ['trade', 'both', 'finance', 'neither'];

export function shockIds(): string[] { return readShocks().replays.map((r) => r.id); }

export function shocksView(lang: Lang): Envelope {
  const meta = readMeta();
  const list = readShocks().replays;
  const replays = list.map((r) => ({ id: r.id, label: r.label[lang], title: r.title[lang], shock_month: ym(r.t0), ongoing: r.ongoing, page: `/${lang}/shocks/${r.id}` }));
  return envelope('shocks', `/${lang}/shocks`, {
    period: { freq: 'M', shown: ym(meta.trade.shown), newest: ym(meta.trade.shown) },
    sources: sources([{ src: 'comtrade', period: `12- and 3-month windows to ${ym(meta.trade.shown)}, monthly` }, { src: 'tf.events' }], meta),
    summary: `${list.length} shock replays on global-network, each following a shock through trade links month by month with funding flow scores by quarter (UN Comtrade via trade-flow, BIS and IMF via money-flow): ${list.map((r) => `${r.label.en} (shock month ${ym(r.t0)}${r.ongoing ? ', ongoing' : ''})`).join('; ')}.`,
    data: { replays },
    table: { columns: [{ id: 'id', label: 'Replay id' }, { id: 'label', label: 'Replay' }, { id: 'title', label: 'Event' }, { id: 'shock_month', label: 'Shock month' }, { id: 'ongoing', label: 'Ongoing' }], rows: replays.map((r) => [r.id, r.label, r.title, r.shock_month, r.ongoing ? 'yes' : 'no']) },
    basis: {},
    notes: ['The event itself (timeline, products, sources) is trade-flow’s event page; each replay links to it.'],
  }, meta);
}

function shockParam(raw: string): Shock {
  const id = String(raw ?? '').trim().toLowerCase();
  if (!/^[a-z0-9-]{1,40}$/.test(id)) throw badParam(`id must be a replay id such as covid-2020; got "${String(raw ?? '').slice(0, 40)}". GET /v1/global-network/shocks lists them.`);
  const d = readShock(id);
  if (!d) throw new SvcFail(404, 'unknown-shock', 'Unknown shock replay', `${id} is not a shock replay. The replays are ${shockIds().join(', ')}; GET /v1/global-network/shocks lists them.`);
  return d;
}

export function shockView(raw: string, sp: URLSearchParams, lang: Lang): Envelope {
  const d = shockParam(raw);
  const part = enumParam(sp, 'part', SHOCK_PARTS, 'summary');
  const e = sp.get('economy');
  const eco = e ? economyParam(e) : null;
  return buildShock(d, lang, part, eco);
}

/** YYYYMM + k months (month arithmetic). */
const addM = (t: number, k: number) => { const n = Math.floor(t / 100) * 12 + (t % 100) - 1 + k; return Math.floor(n / 12) * 100 + (n % 12) + 1; };
/** A 3-month change's own window and its base, the same 3 months a year earlier (month arithmetic). */
const w3 = (t: number | null | undefined, prefix = '') => (t ? {
  [`${prefix}window_from`]: ym(addM(t, -2)), [`${prefix}window_to`]: ym(t),
  [`${prefix}base_window_from`]: ym(addM(t, -14)), [`${prefix}base_window_to`]: ym(addM(t, -12)),
} : { [`${prefix}window_from`]: null, [`${prefix}window_to`]: null, [`${prefix}base_window_from`]: null, [`${prefix}base_window_to`]: null });

const lastMonth = (d: Shock) => { let i = d.months.length - 1; while (i > 0 && d.nodata[i]) i--; return Math.min(d.shown, d.months[i]); };
const lastFinQ = (d: Shock) => d.quarters.filter((q) => Object.values(d.finance).some((f) => f[q]?.f != null)).pop() ?? d.quarters[0];

export function buildShock(d: Shock, lang: Lang, part: Part = 'summary', eco: string | null = null): Envelope {
  const meta = readMeta();
  const E = earn(lang);
  const SL = shockStrings(lang);
  const lastM = lastMonth(d);
  const lastQ = lastFinQ(d);
  const head = {
    id: d.id, label: d.label[lang], title: d.event.title[lang], dek: d.event.dek?.[lang] ?? null, note: d.note?.[lang] ?? null,
    kind: d.event.kind, ongoing: d.event.ongoing, event_start: d.event.start, event_end: d.event.end,
    origin_economies: d.event.economies.map((c) => ({ economy: c, name: nameOf(c, lang) })),
    months: { first: ym(d.months[0]), last_with_data: ym(lastM), shock_month: ym(d.t0), base_window_to: ym(d.base) },
    reading: plain(SL.observed),
  };
  const notes = ['Values are trade-flow’s shares of world trade times the world total; partner reports where the importer has not filed. Funding is money-flow’s flow score F by quarter; after the newest published quarter that quarter carries on.'];
  const cites: Cite[] = [
    { src: 'comtrade', period: `12- and 3-month windows, ${ym(d.months[0])} to ${ym(lastM)}, monthly` },
    { src: 'bis.lbs', period: `${d.quarters[0]} to ${lastQ}, quarterly` }, { src: 'bis.dss', period: `${d.quarters[0]} to ${lastQ}, quarterly` }, { src: 'imf.irfcl', period: `${d.quarters[0]} to ${lastQ}, quarterly` },
    { src: 'tf.events' },
  ];
  const nodeOf = (c: string) => d.nodes.find((x) => x.id === c) ?? null;
  const k0 = d.months.indexOf(d.t0), kb = d.months.indexOf(d.base), kl = d.months.indexOf(lastM);
  let data: Record<string, unknown>;
  let table: Envelope['table'];
  let summary: string;

  if (part === 'dollar') {
    cites.splice(1, 3, { src: 'fred', series: ['DTWEXBGS', 'SWPT'], period: `${d.dollar[0]?.[0]} to ${d.dollar[d.dollar.length - 1]?.[0]}, weekly` });
    data = {
      ...head,
      dollar_index: { series: 'DTWEXBGS', name: SERIES.DTWEXBGS.name.en, unit: 'index, Jan 2006 = 100, weekly mean', points: d.dollar },
      swap_lines: { series: 'SWPT', name: SERIES.SWPT.name.en, unit: 'USD bn, weekly', points: d.swap },
      ...(eco ? { economy_ignored: 'The dollar and swap strips are global; economy= does not apply to part=dollar.' } : {}),
    };
    table = { columns: [{ id: 'date', label: 'Week' }, { id: 'series', label: 'Series' }, { id: 'value', label: 'Value' }], rows: [...d.dollar.map(([t, v]) => [t, 'broad dollar index (DTWEXBGS)', v]), ...d.swap.map(([t, v]) => [t, 'liquidity swaps, USD bn (SWPT)', v])] };
    const dv = d.dollar.map((p) => p[1]), sv = d.swap.map((p) => p[1]);
    summary = `${d.label.en}: the Federal Reserve’s broad dollar index (FRED DTWEXBGS, Jan 2006 = 100) ran from ${n(dv[0], 1)} to ${n(dv[dv.length - 1], 1)} between ${d.dollar[0]?.[0]} and ${d.dollar[d.dollar.length - 1]?.[0]}, peaking at ${n(Math.max(...dv), 1)}; central bank liquidity swaps outstanding (FRED SWPT) peaked at USD ${n(Math.max(...sv), 1)} bn. Weekly, via money-flow.`;
  } else if (part === 'network') {
    const keep = eco ? new Set([eco, ...d.edges.filter((x) => x.s === eco || x.t === eco).flatMap((x) => [x.s, x.t])]) : null;
    const nodes = d.nodes.filter((x) => !keep || keep.has(x.id)).map((x) => ({
      economy: x.id, name: nameOf(x.id, lang), wave: x.wave, wave_name: SL.waves[x.wave], board_economy: x.board,
      origin_share_of_imports_pct: x.share ?? null, from_origins_usd_bn: x.from_origins_bn ?? null, filed_share: x.c,
    }));
    const edges = d.edges.filter((x) => !eco || x.s === eco || x.t === eco).map((x) => ({
      from: x.s, to: x.t, wave: x.wave, value_12m_usd_bn: x.v, change_3m_yoy_pct: x.y,
      repeats_previous_month: d.months.filter((_, i) => x.held[i]).map(ym),
    }));
    // change_3m_yoy_pct[i] compares the 3 months to months[i] with the same 3 months a year earlier: base_months[i]
    data = { ...head, months: d.months.map(ym), base_months: d.months.map((m) => ym(addM(m, -12))), nodes, edges, legend: { edge_width: '12-month value, USD bn', edge_colour: '3 months against the same 3 months a year earlier, %', filed_share: 'share of the economy’s usual trade filed that month (under 0.9 is drawn dashed)' } };
    table = { columns: [{ id: 'from', label: 'From' }, { id: 'to', label: 'To' }, { id: 'wave', label: 'Wave' }, { id: 'base', label: `12-month value to ${ym(d.base)}`, unit: 'USD bn' }, { id: 'shock', label: `12-month value to ${ym(d.t0)}`, unit: 'USD bn' }, { id: 'latest', label: `12-month value to ${ym(lastM)}`, unit: 'USD bn' }, { id: 'yoy_latest', label: `3 months y/y to ${ym(lastM)}`, unit: '%' }],
      rows: edges.map((x) => [x.from, x.to, x.wave, x.value_12m_usd_bn[kb] ?? null, x.value_12m_usd_bn[k0] ?? null, x.value_12m_usd_bn[kl] ?? null, x.change_3m_yoy_pct[kl] ?? null]) };
    summary = `${d.label.en} replay network (UN Comtrade via trade-flow): ${d.nodes.length} economies in three waves and ${d.edges.length} trade links, monthly from ${ym(d.months[0])} to ${ym(lastM)}${eco ? `; shown here: the ${edges.length} links that touch ${nameEn(eco)}` : ''}. Wave 1 is the origin’s exports of ${d.wave1.en.toLowerCase()}, wave 3 the direct importers’ sales of ${d.wave3.en.toLowerCase()} to third markets.`;
  } else {
    const waves = (['1', '2', '3'] as const).map((w) => ({
      wave: Number(w), name: SL.waves[Number(w)], what: SL.waveLong[Number(w)](Number(w) === 3 ? d.wave3[lang] : d.wave1[lang]).replace(/^\d · /, ''),
      lowest: d.trough[w] && d.trough[w].v < 0 ? { month: ym(d.trough[w].t), change_3m_yoy_pct: d.trough[w].v, ...w3(d.trough[w].t) } : null,
    }));
    const row = (r: Shock['summary'][number]) => ({
      economy: r.eco, name: nameOf(r.eco, lang), wave: r.wave, how_it_earned: r.quad, how_it_earned_label: r.quad ? E.quad[r.quad] : null,
      worst_3m_export_change_pct: r.x, worst_month: ym(r.xt), ...w3(r.xt), flow_score_before: r.f0, flow_score_lowest: r.f1, change_in_flow_score: r.fd,
    });
    const tt = readStress()?.validation.trade.find((x) => x.id === d.id) ?? null;
    const rows = eco ? d.summary.filter((r) => r.eco === eco) : d.summary;
    data = {
      ...head, waves,
      wave_rule: { direct_importers: d.rule.n2, min_origin_share_of_imports_pct: Math.round(100 * d.rule.min_share), third_markets: d.rule.n3, drawn_per_importer: d.rule.per },
      who_was_hit: {
        what: `Every board economy: its worst 3-month export change in the 12 months from the event against a year earlier, its flow score F before the event and at its lowest in the four quarters from the event’s, and how it earned its living in ${d.summary_year}. Ranked by the export change.`,
        economies: rows.map(row),
      },
      medians_by_how_it_earned: eco ? undefined : QUADS.map((q) => ({ how_it_earned: q, label: E.quad[q], economies: d.medians[q].n, worst_3m_export_change_pct: d.medians[q].x, change_in_flow_score: d.medians[q].fd })),
      how_it_earned_year: d.summary_year,
      signals_before: tt ? {
        quarter: tt.q, what: 'the stress count one quarter before the shock, at the default thresholds, against the 3-month export fall each board economy then suffered',
        spearman_rho: tt.rho, p_value_one_sided: tt.p, economies: tt.n,
        rows: (eco ? tt.rows.filter((r) => r.eco === eco) : tt.rows.slice(0, 10)).map((r) => ({ economy: r.eco, name: nameOf(r.eco, lang), count: r.count, export_change_pct: r.x, worst_month: ym(r.xt), ...w3(r.xt) })),
      } : null,
    };
    if (eco) {
      const nd = nodeOf(eco);
      const fin = d.finance[eco] ?? {};
      data.focus = {
        economy: eco, name: nameOf(eco, lang), in_network: !!nd, wave: nd?.wave ?? null, wave_name: nd ? SL.waves[nd.wave] : null,
        origin_share_of_imports_pct: nd?.share ?? null, from_origins_usd_bn: nd?.from_origins_bn ?? null,
        funding_by_quarter: Object.keys(fin).sort().map((q) => ({ quarter: q, flow_score_f: fin[q].f, vulnerability_v: fin[q].v, a2_pct: fin[q].a2, v_crossed_60: !!fin[q].vx, a2_crossed_100: !!fin[q].ax })),
        links: d.edges.filter((x) => x.s === eco || x.t === eco).map((x) => ({ from: x.s, to: x.t, wave: x.wave, value_12m_usd_bn: { [ym(d.base)!]: x.v[kb] ?? null, [ym(d.t0)!]: x.v[k0] ?? null, [ym(lastM)!]: x.v[kl] ?? null }, change_3m_yoy_pct_latest: x.y[kl] ?? null, ...w3(lastM, 'change_') })),
      };
    }
    table = { columns: [{ id: 'month', label: 'Month' }, { id: 'wave1', label: 'Wave 1, 3 months y/y', unit: '%' }, { id: 'wave2', label: 'Wave 2, 3 months y/y', unit: '%' }, { id: 'wave3', label: 'Wave 3, 3 months y/y', unit: '%' }, { id: 'filed', label: 'Reporters’ share of world exports', unit: '0-1' }],
      rows: d.months.map((m, i) => [ym(m), d.waves['1']?.[i] ?? null, d.waves['2']?.[i] ?? null, d.waves['3']?.[i] ?? null, d.coverage[i] ?? null]) };
    cites.push({ src: 'wdi', series: ['BN.GSR.GNFS.CD', 'BN.GSR.FCTY.CD', 'NY.GDP.MKTP.CD'], period: `${d.summary_year}, annual` });
    const worst = d.summary[0];
    const tr3 = d.trough['3'];
    const mine = eco ? d.summary.find((r) => r.eco === eco) : null;
    summary = `${d.label.en} (${d.event.title.en}, from ${d.event.start}): replayed month by month from ${ym(d.months[0])} to ${ym(lastM)} over UN Comtrade windows via trade-flow, with money-flow’s flow score F by quarter to ${lastQ}. `
      + (tr3 && tr3.v < 0 ? `Wave 3, the direct importers’ sales to third markets, was down ${n(-tr3.v, 1)}% on a year earlier over 3 months at its lowest (${ym(tr3.t)}). ` : '')
      + (mine ? `${nameEn(eco!)}: worst 3-month export change ${n(mine.x, 1, true)}%${mine.xt ? ` (${ym(mine.xt)})` : ''}, F ${n(mine.f0, 1, true)} before and ${n(mine.f1, 1, true)} at its lowest.`
        : worst ? `Hardest hit among the board economies: ${nameEn(worst.eco)}, exports ${n(worst.x, 1, true)}% over 3 months${worst.xt ? ` to ${ym(worst.xt)}` : ''}.` : '')
      + ' Observed, not causal.';
    if (eco && !mine && !nodeOf(eco)) notes.push(`${nameEn(eco)} is neither a board economy in the summary table nor a node of this replay.`);
  }
  return envelope('shock', `/${lang}/shocks/${d.id}${part === 'summary' && !eco ? '' : part === 'summary' ? '#summary' : ''}`, {
    period: { freq: part === 'dollar' ? 'W' : 'M', shown: ym(lastM), newest: ym(lastM), shock_month: ym(d.t0), funding_quarters_to: lastQ },
    sources: sources(cites, meta), summary, data, table, basis: shockBasis(d, lastM, lastQ),
    notes: [...notes, `The event page on trade-flow: ${siteUrl('trade-flow', 'event', lang, { event: d.id })}`],
  }, meta);
}

export function shockText(e: Envelope): string {
  const d = e.data as Record<string, any>;
  const L: string[] = [`# ${d.label}: shock replay`, '', `**${d.title}** (${d.event_start}${d.event_end ? ` to ${d.event_end}` : ', ongoing'})`, ''];
  if (d.dek) L.push(d.dek, '');
  if (d.note) L.push(d.note, '');
  L.push(e.summary, '', d.reading, '', '## The three waves', '');
  for (const w of d.waves ?? []) L.push(`- Wave ${w.wave}, ${w.name}: ${w.what}; ${w.lowest ? `lowest ${n(w.lowest.change_3m_yoy_pct, 1, true)}% in ${w.lowest.month}` : 'no fall yet'}.`);
  L.push('', `Wave rule: the ${d.wave_rule.direct_importers} largest buyers of the origins’ goods in the 12 months to ${d.months.base_window_to} where the origins held at least ${d.wave_rule.min_origin_share_of_imports_pct}% of the buyer’s imports; their ${d.wave_rule.third_markets} largest third markets, ${d.wave_rule.drawn_per_importer} drawn per importer.`, '');
  L.push('## Who was hit, and did funding cushion it?', '', d.who_was_hit.what, '', '| Economy | Wave | How it earned | Worst exports, 3 months | Month | F before | F lowest | Change in F |', '|---|---|---|---:|---|---:|---:|---:|');
  for (const r of d.who_was_hit.economies) L.push(`| ${r.name} | ${r.wave ?? ''} | ${r.how_it_earned_label ?? '–'} | ${n(r.worst_3m_export_change_pct, 1, true)}% | ${r.worst_month ?? '–'} | ${n(r.flow_score_before, 1, true)} | ${n(r.flow_score_lowest, 1, true)} | ${n(r.change_in_flow_score, 1, true)} |`);
  if (d.medians_by_how_it_earned) {
    L.push('', `Medians by how economies earn (${d.how_it_earned_year}):`, '', '| Quadrant | Economies | Worst exports | Change in F |', '|---|---:|---:|---:|');
    for (const m of d.medians_by_how_it_earned) L.push(`| ${m.label} | ${m.economies} | ${n(m.worst_3m_export_change_pct, 1, true)}% | ${n(m.change_in_flow_score, 1, true)} |`);
  }
  const s = d.signals_before;
  if (s) {
    L.push('', '## Did the signals see it?', '', `The stress count in ${s.quarter} against the export fall: Spearman ${n(s.spearman_rho, 2, true)} (one-sided permutation p = ${n(s.p_value_one_sided, 3)}, ${s.economies} economies).`, '', '| Economy | Count before | Export change |', '|---|---:|---:|');
    for (const r of s.rows) L.push(`| ${r.name} | ${r.count} | ${n(r.export_change_pct, 1, true)}% |`);
  }
  L.push('', 'Sources: ' + e.sources.map((x) => `${x.publisher}, ${x.dataset}`).join('; ') + '.');
  return L.join('\n');
}

/** What each number of a shock replay is (SVC-CONTRACT 1.1): monthly arrays run over data.months (network part). */
function shockBasis(d: Shock, lastM: number, lastQ: string): BasisMap {
  const M = { months: '$months' };
  const span = { from: ym(d.months[0]), to: ym(lastM) };
  const F = { quarters_from: d.quarters[0], quarters_to: lastQ };
  const cnt = { measure: null, kind: 'count' as const, period: span };
  return {
    'waves[].wave': cnt,
    'waves[].lowest.change_3m_yoy_pct': { measure: 'global-network:shock_wave_change_3m', period: { window_from: '@window_from', window_to: '@window_to', base_window_from: '@base_window_from', base_window_to: '@base_window_to' } },
    'wave_rule.*': { measure: null, kind: 'threshold', period: { base_window_to: ym(d.base) } },
    'who_was_hit.economies[].wave': cnt,
    'who_was_hit.economies[].worst_3m_export_change_pct': { measure: 'global-network:shock_export_change_3m', period: { window_from: '@window_from', window_to: '@window_to', base_window_from: '@base_window_from', base_window_to: '@base_window_to' } },
    'who_was_hit.economies[].flow_score_before': { measure: 'money-flow:f', period: F },
    'who_was_hit.economies[].flow_score_lowest': { measure: 'money-flow:f', period: F },
    'who_was_hit.economies[].change_in_flow_score': { measure: 'money-flow:f', period: F },
    'medians_by_how_it_earned[].economies': cnt,
    'medians_by_how_it_earned[].worst_3m_export_change_pct': { measure: 'global-network:shock_export_change_3m', period: { ...span, base_window_to: 'each economy’s worst 3-month window less 12 months (who_was_hit rows)' } },
    'medians_by_how_it_earned[].change_in_flow_score': { measure: 'money-flow:f', period: F },
    'how_it_earned_year': { measure: null, kind: 'count', period: { year: d.summary_year } },
    'signals_before.spearman_rho': { measure: null, kind: 'test', period: { quarter: '@quarter' } },
    'signals_before.p_value_one_sided': { measure: null, kind: 'test', period: { quarter: '@quarter' } },
    'signals_before.economies': { measure: null, kind: 'count', period: { quarter: '@quarter' } },
    'signals_before.rows[].count': { measure: null, kind: 'count', period: { quarter: '@@quarter' } },
    'signals_before.rows[].export_change_pct': { measure: 'global-network:shock_export_change_3m', period: { window_from: '@window_from', window_to: '@window_to', base_window_from: '@base_window_from', base_window_to: '@base_window_to' } },
    'focus.wave': cnt,
    'focus.origin_share_of_imports_pct': { measure: 'goods_imports_own', kind: 'share', period: { window_to: ym(d.base) } },
    'focus.from_origins_usd_bn': { measure: 'goods_imports_own', period: { window_to: ym(d.base) } },
    'focus.funding_by_quarter[].flow_score_f': { measure: 'money-flow:f', period: { quarter: '@quarter' } },
    'focus.funding_by_quarter[].vulnerability_v': { measure: 'money-flow:v', period: { quarter: '@quarter' } },
    'focus.funding_by_quarter[].a2_pct': { measure: 'a2', period: { quarter: '@quarter' } },
    'focus.links[].wave': cnt,
    'focus.links[].value_12m_usd_bn.*': { measure: 'goods_exports_partner', period: { window_to: 'the key' } },
    'focus.links[].change_3m_yoy_pct_latest': { measure: 'global-network:goods_growth_3m', period: { window_from: '@change_window_from', window_to: '@change_window_to', base_window_from: '@change_base_window_from', base_window_to: '@change_base_window_to' } },
    'nodes[].wave': cnt,
    'nodes[].origin_share_of_imports_pct': { measure: 'goods_imports_own', kind: 'share', period: { window_to: ym(d.base) } },
    'nodes[].from_origins_usd_bn': { measure: 'goods_imports_own', period: { window_to: ym(d.base) } },
    'nodes[].filed_share[]': { measure: null, kind: 'share', period: M },
    'edges[].wave': cnt,
    'edges[].value_12m_usd_bn[]': { measure: 'goods_exports_partner', period: M },
    'edges[].change_3m_yoy_pct[]': { measure: 'global-network:goods_growth_3m', period: { months: '$months', base_months: '$base_months' } },
    'dollar_index.points[][]': { measure: 'money-flow:dollar_index', kind: 'index', period: { week: 'first element of each point' } },
    'swap_lines.points[][]': { measure: 'money-flow:fed_swap_lines', period: { week: 'first element of each point' } },
  };
}
