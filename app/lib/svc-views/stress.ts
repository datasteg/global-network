// The stress page /{lang}/stress as a view. With economy=: the One economy tab (the seven signals J1-J7 at a quarter
// with their thresholds, ranks and single-side inputs, the partners panel, and every quarter from 2005 Q1 as a
// table). Without: the Board tab (36 economies at a quarter). No composite: rule G19 admitted no signal on this build.
import { countAt, fires, readSel } from '@/components/stress/model';
import { readMeta, readStress, readStressEco } from '@/lib/data';
import { plain } from '@/lib/rich';
import { stress as stressStrings } from '@/lib/strings/stress';
import { SvcFail, badParam } from '@/lib/svc';
import type { Lang, Stress, StressRule, StressRuleId } from '@/lib/types';
import { NES_NOTE } from './country';
import { BOARD_SRC, boolParam, economyParam, envelope, n, nameEn, nameOf, qend, qid, sources, ym, type BasisMap, type Cite, type Envelope } from './common';

/** Each signal's measure id: the registry's where it lists the quantity (j2, overlap), else this app's own id. */
export const SIGNAL_MEASURE: Record<StressRuleId, string> = {
  j1: 'global-network:j1_import_cover', j2: 'j2', j3: 'global-network:j3_double_hit', j4: 'global-network:j4_partner_stress',
  j5: 'overlap', j6: 'global-network:j6_dollar_channel', j7: 'global-network:j7_commodities_buffers',
};
const INPUT_MEASURE = (r: StressRuleId, side: 'money' | 'trade') => `global-network:${r}_${side}_input`;
const winOf = (t: number | null | undefined) => (t ? { window_to: ym(t) } : {});

const S = stressStrings('en');

function load(): Stress {
  const s = readStress();
  if (!s) throw new Error('no stress data');
  return s;
}
const defaults = (s: Stress) => readSel({ get: () => null }, s.rules, s.K, s.K_range);
const ruleName = (r: StressRule, lang: Lang) => (lang === 'ko' ? r.ko : S.rules[r.id].short);
const CHAN = (r: string) => (['j2', 'j3'].includes(r) ? 'funding' : ['j4', 'j6', 'j7'].includes(r) ? 'trade' : 'both');
/** The channel first as the pages draw it at the default thresholds: the fired signal with the highest rank; with none
 *  fired, the One economy tab takes the highest-ranked scored signal and the Board tab the published lead. */
function leadOf(s: Stress, g: Stress['grid'][string], i: number, fired: StressRuleId[], board: boolean): string | null {
  const rank = (r: string) => (g[`${r}l`]?.[i] as number | null) ?? 0;
  const cand: string[] = fired.length ? fired : board ? [] : s.rules.filter((r) => g[`${r.id}l`]?.[i] != null).map((r) => r.id);
  if (cand.length) return cand.reduce((b, r) => (rank(r) > rank(b) ? r : b));
  return board ? ((g.lead[i] as string | null) ?? null) : null;
}
const firesWhen = (r: StressRule) => (r.threshold == null ? 'fires by definition (see formula)' : `fires when the value is ${r.dir === 'low' ? 'at or below' : 'at or above'} ${r.threshold} ${r.unit.en}`);

function quarterParam(s: Stress, raw: string | null): number {
  if (!raw) return s.quarters.length - 1;
  const q = qend(raw);
  const i = q ? s.quarters.indexOf(q) : -1;
  if (i < 0) throw badParam(`quarter must be a quarter from ${qid(s.quarters[0])} to ${qid(s.latest)}, written 2026-Q2 or 2026-06-30; got "${raw.slice(0, 20)}".`);
  return i;
}

/** The method and the funding-episode test of each signal, as the Method tab prints them. */
/** `full` (the signal item) adds the reasoning, both sides' inputs and the hit and false rates of the Method tab. */
export function signalMeta(s: Stress, r: StressRule, lang: Lang, full = false) {
  const x = s.validation.funding.rules[r.id];
  return {
    id: r.id.toUpperCase(), key: r.id, measure: SIGNAL_MEASURE[r.id], name: ruleName(r, lang), unit: r.unit[lang], formula: S.rules[r.id].formula,
    ...(full ? { why: S.rules[r.id].why, money_side: r.money[lang], trade_side: r.trade[lang] } : {}),
    fires_when: firesWhen(r), threshold: r.threshold, threshold_from: r.threshold_from, direction: r.dir, channel: r.channel,
    test: x ? {
      auroc: x.common.j, interval_90: [x.common.j_lo, x.common.j_hi],
      ...(full ? { money_input_alone: x.common.money, trade_input_alone: x.common.trade } : {}),
      gain_over_better_side: x.inc, gain_interval_90: [x.inc_lo, x.inc_hi], admitted_to_composite: x.admitted,
      ...(full ? { positives: x.common.pos, calm_quarters: x.common.neg, hit_rate_pct: x.tpr, false_rate_pct: x.fpr, holdout_false_rate_pct: x.holdout.fpr } : {}),
    } : null,
  };
}

function validationOf(s: Stress) {
  const fd = s.validation.funding, c = fd.count;
  return {
    funding_episodes: fd.set.episodes, quarters_before: fd.set.pre, thresholds_trained_to: fd.set.train_to,
    count: { auroc: c.auroc, interval_90: [c.lo, c.hi], v_alone_auroc: c.v, v_interval_90: [c.v_lo, c.v_hi], difference: c.diff, difference_interval_90: [c.diff_lo, c.diff_hi], positives: c.pos, calm_quarters: c.neg, k: c.K },
    admitted: fd.admitted.map((x) => x.toUpperCase()), composite: fd.composite,
    composite_designs: fd.designs.map((d) => ({ id: d.id, name: d.en, tested: !d.skipped, passed: d.pass ?? null })),
  };
}
const compositeNote = (s: Stress) => (s.validation.funding.composite ? S.compositeOn(s.validation.funding.composite, s.validation.funding.admitted.length) : S.noComposite);

export function stressView(sp: URLSearchParams, lang: Lang): Envelope {
  const e = sp.get('economy');
  const s = load();
  const qi = quarterParam(s, sp.get('quarter'));
  const inputs = boolParam(sp, 'inputs');
  if (e) {
    const code = economyParam(e);
    if (!s.econs.includes(code)) throw new SvcFail(404, 'not-scored', 'Economy not scored', `${code} has no stress signals: they are scored for the 36 money-flow board economies (the United States is the hub). Call without economy for the board.`);
    return buildStressEconomy(s, code, lang, qi, sp.get('quarter') != null, inputs);
  }
  return buildStressBoard(s, lang, qi);
}

const cites = (s: Stress, meta = readMeta()): Cite[] => [
  ...BOARD_SRC.map((src) => ({ src, period: `${qid(s.quarters[0])} to ${qid(s.latest)}, quarterly` })),
  { src: 'fred' as const, series: ['DTWEXBGS'] },
  { src: 'comtrade' as const, period: `12-month windows to ${ym(meta.trade.shown)}` },
];

export function buildStressEconomy(s: Stress, code: string, lang: Lang, qi = s.quarters.length - 1, pinned = false, inputs = false): Envelope {
  const meta = readMeta();
  const g = s.grid[code];
  const eco = readStressEco(code);
  const sel = defaults(s);
  // the latest quarter scored for this economy, unless one was asked for (the page's pinned quarter)
  if (!pinned) { for (let i = s.quarters.length - 1; i >= 0; i--) if (g.cnt[i] != null) { qi = i; break; } }
  const at = countAt(s.rules, g, qi, sel);
  const q = s.quarters[qi];
  const lead = leadOf(s, g, qi, at.fired, false), ch = lead ? CHAN(lead) : null;
  const nm = (g.j1n?.[qi] as string | null | undefined) ?? null;
  const signals = s.rules.map((r) => ({
    ...signalMeta(s, r, lang),
    value: g[r.id][qi] as number | null, fires: fires(r, g, qi, sel), rank_pct: g[`${r.id}l`]?.[qi] as number | null,
    // J1 is null, not floored, when net reserves are not positive or a sliver of gross
    ...(r.id === 'j1' ? { not_meaningful: nm } : {}),
    ...(r.id === 'j3' ? { not_scored_reason: (g.j3n?.[qi] as string | null | undefined) ?? null } : {}),
    money_input: { name: r.single.money[lang], value: eco?.single[r.id].money[qi] ?? null, measure: INPUT_MEASURE(r.id, 'money') },
    trade_input: { name: r.single.trade[lang], value: eco?.single[r.id].trade[qi] ?? null, measure: INPUT_MEASURE(r.id, 'trade') },
  }));
  const ein = eco?.inputs;
  const inputsAt = ein ? {
    quarter: q, trade_window_to: ym(ein.t[qi] as number | null), trade_window_partial: !!ein.lag?.[qi],
    net_reserves_usd_bn: ein.res_net[qi], a2_reserve_base_usd_bn: ein.a2_base?.[qi] ?? null, bank_claims_due_within_year_usd_bn: ein.st[qi],
    financing_need_usd_bn: ein.need[qi], goods_exports_12m_usd_bn: ein.x[qi], goods_imports_12m_usd_bn: ein.m[qi],
    j1_not_meaningful: ein.j1_nm?.[qi] ?? null,
  } : null;
  const p = eco?.partners;
  const data = {
    economy: code, name: nameOf(code, lang),
    quarters: { first: s.quarters[0], latest: s.latest, shown: q },
    reading_threshold_k: s.K, composite: s.validation.funding.composite, composite_note: compositeNote(s),
    at: {
      quarter: q, signals_at_threshold: at.n, signals_scored: at.scored, reached: at.n >= s.K, firing: at.fired.map((x) => x.toUpperCase()),
      vulnerability_v: g.v[qi] as number | null, flow_score_f: g.f[qi] as number | null,
      channel_first: ch, channel_first_label: ch ? stressStrings(lang).channel[ch as 'funding'] : null, led_by: lead ? lead.toUpperCase() : null,
      trade_window_to: ym(g.tm[qi] as number | null), trade_window_partial: !!g.lag[qi],
    },
    signals,
    inputs_at_quarter: inputsAt,
    partners: p ? {
      quarter: p.q, trade_window_to: ym(p.t), lenders_quarter: p.lq,
      destinations: p.dests.map((x) => ({ partner: x.p, name: nameOf(x.p, lang), economy: x.eco !== false, ...(x.eco === false ? { note: NES_NOTE } : {}), share_of_exports_pct: x.share, partner_v: x.board ? x.v : null })),
      bank_lenders: p.lenders.map((x) => ({ partner: x.p, name: nameOf(x.p, lang), share_of_bank_borrowing_pct: x.share })),
      same_partner_both_lists: p.overlap.map((x) => ({ partner: x.p, name: nameOf(x.p, lang), lender_share_pct: x.lend, destination_share_pct: x.dest, overlap: x.min })),
    } : null,
    validation: validationOf(s),
    series_note: 'The table holds every quarter from 2005 Q1: the count at the default thresholds, V and F from money-flow, and the seven signal values as the charts draw them.' + (inputs ? ' The _money and _trade columns are the single-side inputs each signal is tested against.' : ''),
  };
  const cols: { id: string; label: string; unit?: string }[] = [{ id: 'quarter', label: 'Quarter end' }, { id: 'count', label: 'Signals at threshold', unit: 'count' }, { id: 'v', label: 'V (money-flow)', unit: '0-100' }, { id: 'f', label: 'Flow score F', unit: '% a year' },
    ...s.rules.map((r) => ({ id: r.id, label: `${r.id.toUpperCase()} ${S.rules[r.id].short}`, unit: r.unit.en })),
    ...(inputs ? s.rules.flatMap((r) => [{ id: `${r.id}_money`, label: `${r.id.toUpperCase()} money input: ${r.single.money.en}` }, { id: `${r.id}_trade`, label: `${r.id.toUpperCase()} trade input: ${r.single.trade.en}` }]) : [])];
  const rows = s.quarters.map((qq, i) => [qq, g.cnt[i] as number | null, g.v[i] as number | null, g.f[i] as number | null, ...s.rules.map((r) => g[r.id][i] as number | null),
    ...(inputs ? s.rules.flatMap((r) => [eco?.single[r.id].money[i] ?? null, eco?.single[r.id].trade[i] ?? null]) : [])]);
  const firing = at.fired.map((x) => `${x.toUpperCase()} ${S.rules[x].short}`);
  const summary = `${nameEn(code)}, ${qid(q)}: ${at.n} of ${at.scored} stress signals at threshold (reading: ${s.K} or more)${firing.length ? `, firing ${firing.join(', ')}` : ''}; V ${n(g.v[qi] as number | null, 0)} and flow score F ${n(g.f[qi] as number | null, 1, true)}% a year (money-flow board, BIS and IMF), trade windows from UN Comtrade via trade-flow. `
    + `${ch ? `Channel first: ${S.channel[ch as 'funding'].toLowerCase()}${lead ? ` (${lead.toUpperCase()})` : ''}. ` : ''}No composite is published: under rule G19 none of the seven signals beat its better single-side input on the funding episodes.`;
  return envelope('stress', `/${lang}/stress?e=${code}${pinned ? `&y=${q}` : ''}`, {
    method: `stress ${s.version}`,
    period: { freq: 'Q', shown: q, newest: s.latest, from: s.quarters[0], trade_window_to: ym(g.tm[qi] as number | null), trade_window_partial: !!g.lag[qi] },
    sources: sources(cites(s, meta), meta), summary, data, table: { columns: cols, rows }, basis: economyBasis(q, ym(g.tm[qi] as number | null), p ?? null),
    notes: [plain(S.lede), `Thresholds are the defaults of stress method ${s.version} (written ${s.written}); the page lets readers move them, this view does not.`],
  }, meta);
}

export function buildStressBoard(s: Stress, lang: Lang, qi = s.quarters.length - 1): Envelope {
  const meta = readMeta();
  const sel = defaults(s);
  const q = s.quarters[qi];
  const order = new Map(meta.economies.map((e, i) => [e.code, i]));
  const economies = s.econs.map((code) => {
    const g = s.grid[code];
    const at = countAt(s.rules, g, qi, sel);
    const lead = leadOf(s, g, qi, at.fired, true), ch = lead ? CHAN(lead) : null;
    return {
      economy: code, name: nameOf(code, lang), signals_at_threshold: g.cnt[qi] == null ? null : at.n, signals_scored: at.scored,
      vulnerability_v: g.v[qi] as number | null, flow_score_f: g.f[qi] as number | null, channel_first: ch, led_by: lead ? lead.toUpperCase() : null,
      firing: at.fired.map((x) => x.toUpperCase()),
      // the trade window each economy's joint values use at this quarter (rule C2): ending in the quarter's last month,
      // or up to 6 months earlier and then partial
      trade_window_to: ym(g.tm[qi] as number | null), partial: g.tm[qi] == null ? null : !!g.lag[qi],
      j1_not_meaningful: (g.j1n?.[qi] as string | null | undefined) ?? null,
      j3_not_scored: (g.j3n?.[qi] as string | null | undefined) ?? null,
      values: Object.fromEntries(s.rules.map((r) => [r.id.toUpperCase(), g[r.id][qi] as number | null])) as Record<string, number | null>,
    };
  }).sort((a, z) => (z.signals_at_threshold ?? -1) - (a.signals_at_threshold ?? -1) || (z.vulnerability_v ?? -1) - (a.vulnerability_v ?? -1) || (order.get(a.economy) ?? 0) - (order.get(z.economy) ?? 0));
  const data = {
    quarter: q, reading_threshold_k: s.K, composite: s.validation.funding.composite, composite_note: compositeNote(s),
    signals: s.rules.map((r) => ({ id: r.id.toUpperCase(), measure: SIGNAL_MEASURE[r.id], name: ruleName(r, lang), unit: r.unit[lang], fires_when: firesWhen(r), channel: r.channel, admitted_to_composite: !!s.validation.funding.rules[r.id]?.admitted })),
    signals_note: 'Each signal’s formula and test: GET /stress with economy, or the item stress:j1 to stress:j7.',
    economies,
    validation: validationOf(s),
  };
  const table = {
    columns: [{ id: 'economy', label: 'Economy' }, { id: 'name', label: 'Name' }, { id: 'count', label: 'Signals at threshold', unit: 'count' }, { id: 'scored', label: 'Signals scored', unit: 'count' }, { id: 'v', label: 'V (money-flow)', unit: '0-100' }, { id: 'f', label: 'Flow score F', unit: '% a year' }, { id: 'channel', label: 'Channel first' },
      ...s.rules.map((r) => ({ id: r.id, label: `${r.id.toUpperCase()} ${S.rules[r.id].short}`, unit: r.unit.en }))],
    rows: economies.map((x) => [x.economy, x.name, x.signals_at_threshold, x.signals_scored, x.vulnerability_v, x.flow_score_f, x.channel_first, ...s.rules.map((r) => x.values[r.id.toUpperCase()])]),
  };
  const reached = economies.filter((x) => (x.signals_at_threshold ?? 0) >= s.K);
  const top = economies.slice(0, 3).filter((x) => (x.signals_at_threshold ?? 0) > 0);
  const summary = `Stress signals for the 36 money-flow board economies, ${qid(q)}: ${reached.length} at ${s.K} or more of the seven signals (each a funding quantity against a trade quantity; BIS and IMF via money-flow, UN Comtrade via trade-flow)${top.length ? `; most signals: ${top.map((x) => `${nameEn(x.economy)} ${x.signals_at_threshold} of ${x.signals_scored}`).join(', ')}` : ''}. `
    + `No composite is published: under rule G19 none of the seven beat its better single-side input on the funding episodes (count AUROC ${n(s.validation.funding.count.auroc, 3)} against ${n(s.validation.funding.count.v, 3)} for V).`;
  return envelope('stress', `/${lang}/stress?tab=board${qi === s.quarters.length - 1 ? '' : `&bq=${q}`}`, {
    method: `stress ${s.version}`,
    period: { freq: 'Q', shown: q, newest: s.latest, from: s.quarters[0] },
    sources: sources(cites(s, meta), meta), summary, data, table, basis: boardBasis(s, q),
    notes: [`Thresholds are the defaults of stress method ${s.version}; economies are ranked by the count, then V; a count of ${s.K} or more reaches the reading.`,
      'Each economy’s joint values pair the quarter with its trade_window_to (partial when the window ends before the quarter’s last month). J1 is null with j1_not_meaningful when net reserves (IRFCL Section I plus Section II drains, not floored) are not positive or under 1% of gross reserves. J2’s money side is BIS banks’ claims due within a year, not the economy’s short-term external debt.'],
  }, meta);
}

/** One signal's method, test and board column (item stress:j1). */
export function buildSignal(s: Stress, id: StressRuleId, lang: Lang): Envelope {
  const meta = readMeta();
  const r = s.rules.find((x) => x.id === id)!;
  const qi = s.quarters.length - 1;
  const sel = defaults(s);
  const col = s.econs.map((code) => ({ economy: code, name: nameOf(code, lang), value: s.grid[code][id][qi] as number | null, rank_pct: s.grid[code][`${id}l`]?.[qi] as number | null, fires: fires(r, s.grid[code], qi, sel) }))
    .filter((x) => x.value != null).sort((a, z) => (z.rank_pct ?? -1) - (a.rank_pct ?? -1));
  const m = signalMeta(s, r, lang, true);
  const firing = col.filter((x) => x.fires).length;
  return envelope('stress', `/${lang}/stress?tab=method`, {
    method: `stress ${s.version}`, period: { freq: 'Q', shown: s.latest, newest: s.latest, from: s.quarters[0] },
    sources: sources(cites(s, meta), meta),
    summary: `${m.id} ${S.rules[id].short} (global-network stress signals, ${qid(s.latest)}): ${S.rules[id].formula}; ${m.fires_when}. ${firing} of ${col.length} scored board economies fire. Funding-episode AUROC ${n(m.test?.auroc, 3)}; not admitted to a composite (rule G19).`,
    data: { signal: m, quarter: s.latest, economies: col },
    basis: {
      'signal.threshold': { measure: null, kind: 'threshold', period: { quarter: s.latest } },
      'signal.test.**': { measure: null, kind: 'test', period: { from: s.quarters[0], to: s.latest, thresholds_trained_to: s.validation.funding.set.train_to } },
      'economies[].value': { measure: SIGNAL_MEASURE[id], period: { quarter: s.latest } },
      'economies[].rank_pct': { measure: null, kind: 'rank', period: { quarter: s.latest } },
    },
    notes: [compositeNote(s)],
  }, meta);
}

export function stressText(e: Envelope): string {
  const d = e.data as Record<string, any>;
  const L: string[] = [];
  if (d.signal) {
    const m = d.signal;
    L.push(`# ${m.id} ${m.name}: stress signal`, '', e.summary, '', `Formula: ${m.formula}`, '', m.why, '', `- Money side: ${m.money_side}`, `- Trade side: ${m.trade_side}`, `- ${m.fires_when} (${m.threshold_from})`, '');
    if (m.test) L.push(`Test against funding episodes (${m.test.positives} positives, ${m.test.calm_quarters} calm quarters): AUROC ${n(m.test.auroc, 3)} (90% interval ${n(m.test.interval_90[0], 3)} to ${n(m.test.interval_90[1], 3)}); money input alone ${n(m.test.money_input_alone, 3)}, trade input alone ${n(m.test.trade_input_alone, 3)}; gain over the better side ${n(m.test.gain_over_better_side, 3, true)}; ${m.test.admitted_to_composite ? 'admitted' : 'context only, not admitted'}.`, '');
    L.push(`Board economies at ${d.quarter}, ranked by stress rank:`, '', '| Economy | Value | Rank among all | Fires |', '|---|---:|---:|---|');
    for (const x of d.economies) L.push(`| ${x.name} | ${n(x.value, 2)} | ${n(x.rank_pct, 0)} | ${x.fires ? 'yes' : 'no'} |`);
  } else if (d.economy) {
    L.push(`# ${d.name} (${d.economy}): stress signals`, '', e.summary, '', d.composite_note, '', `## ${d.at.quarter}`, '', `${d.at.signals_at_threshold} of ${d.at.signals_scored} at threshold (reading: ${d.reading_threshold_k} or more); V ${n(d.at.vulnerability_v, 0)}, F ${n(d.at.flow_score_f, 1, true)}; trade window to ${d.at.trade_window_to}${d.at.trade_window_partial ? ' (partial)' : ''}.`, '',
      '| Signal | Value | Threshold | State | Rank among all | Money input | Trade input |', '|---|---:|---|---|---:|---:|---:|');
    for (const x of d.signals) L.push(`| ${x.id} ${x.name} (${x.unit}) | ${n(x.value, 2)} | ${x.threshold == null ? 'by definition' : `${x.direction === 'low' ? '≤' : '≥'} ${x.threshold}`} | ${x.fires == null ? 'not scored' : x.fires ? 'fires' : 'quiet'} | ${n(x.rank_pct, 0)} | ${n(x.money_input.value, 2)} | ${n(x.trade_input.value, 2)} |`);
    if (d.partners) {
      L.push('', `## Who buys, who lends (${d.partners.quarter})`, '', 'Top destinations: ' + d.partners.destinations.map((x: any) => `${x.name} ${n(x.share_of_exports_pct, 1)}%${x.partner_v != null ? ` (V ${n(x.partner_v, 0)})` : ''}`).join(', ') + '.');
      if (d.partners.bank_lenders.length) L.push('', `Largest bank lenders (BIS LBS, ${d.partners.lenders_quarter}): ` + d.partners.bank_lenders.map((x: any) => `${x.name} ${n(x.share_of_bank_borrowing_pct, 1)}%`).join(', ') + '.');
      if (d.partners.same_partner_both_lists.length) L.push('', 'Same partner on both lists (J5): ' + d.partners.same_partner_both_lists.map((x: any) => `${x.name} (lends ${n(x.lender_share_pct, 1)}%, buys ${n(x.destination_share_pct, 1)}%)`).join(', ') + '.');
    }
    const rows = (e.table?.rows ?? []).slice(-8);
    L.push('', '## The last eight quarters', '', '| Quarter | Count | V | F | ' + ['J1', 'J2', 'J3', 'J4', 'J5', 'J6', 'J7'].join(' | ') + ' |', '|---|---:|---:|---:|' + '---:|'.repeat(7));
    for (const r of rows) L.push(`| ${r.slice(0, 11).map((v) => (v == null ? '–' : String(v))).join(' | ')} |`);
  } else {
    L.push(`# Stress signals board, ${d.quarter}`, '', e.summary, '', d.composite_note, '', '| Economy | Count | V | F | Channel first | Firing | Trade window to |', '|---|---:|---:|---:|---|---|---|');
    for (const x of d.economies) L.push(`| ${x.name} | ${x.signals_at_threshold ?? '–'} / ${x.signals_scored} | ${n(x.vulnerability_v, 0)} | ${n(x.flow_score_f, 1, true)} | ${x.channel_first ?? '–'} | ${x.firing.join(', ') || '–'} | ${x.trade_window_to ?? '–'}${x.partial ? ' (partial)' : ''} |`);
    L.push('', 'Signals: ' + d.signals.map((x: any) => `${x.id} ${x.name} (${x.fires_when})`).join('; ') + '.');
  }
  L.push('', 'Sources: ' + e.sources.map((x) => `${x.publisher}, ${x.dataset}`).join('; ') + '.');
  return L.join('\n');
}

const TEST = (s: Stress) => ({ measure: null, kind: 'test' as const, period: { from: s.quarters[0], to: s.latest, thresholds_trained_to: s.validation.funding.set.train_to } });

/** What each number of the One economy view is (SVC-CONTRACT 1.1). */
function economyBasis(q: string, tw: string | null, p: { q: string; t: number; lq: string } | null): BasisMap {
  const s = load();
  const Q = { quarter: q };
  const QW = { quarter: q, window_to: tw };
  return {
    'reading_threshold_k': { measure: null, kind: 'threshold', period: Q },
    'at.signals_at_threshold': { measure: null, kind: 'count', period: Q },
    'at.signals_scored': { measure: null, kind: 'count', period: Q },
    'at.vulnerability_v': { measure: 'money-flow:v', period: Q },
    'at.flow_score_f': { measure: 'money-flow:f', period: Q },
    'signals[].value': { measure: '@measure', period: QW },
    'signals[].threshold': { measure: null, kind: 'threshold', period: Q },
    'signals[].rank_pct': { measure: null, kind: 'rank', period: Q },
    'signals[].test.**': TEST(s),
    'signals[].money_input.value': { measure: '@measure', period: Q },
    'signals[].trade_input.value': { measure: '@measure', period: QW },
    'inputs_at_quarter.net_reserves_usd_bn': { measure: 'net_reserves', period: { quarter: '@quarter' } },
    'inputs_at_quarter.a2_reserve_base_usd_bn': { measure: 'a2_reserve_base', period: { quarter: '@quarter' } },
    'inputs_at_quarter.bank_claims_due_within_year_usd_bn': { measure: 'bank_claims_short_term', period: { quarter: '@quarter' } },
    'inputs_at_quarter.financing_need_usd_bn': { measure: 'financing_need', period: { quarter: '@quarter' } },
    'inputs_at_quarter.goods_exports_12m_usd_bn': { measure: 'goods_exports_partner', period: { quarter: '@quarter', window_to: '@trade_window_to', partial: '@trade_window_partial' } },
    'inputs_at_quarter.goods_imports_12m_usd_bn': { measure: 'goods_imports_own', period: { quarter: '@quarter', window_to: '@trade_window_to', partial: '@trade_window_partial' } },
    ...(p ? {
      'partners.destinations[].share_of_exports_pct': { measure: 'goods_exports_partner', kind: 'share', period: { quarter: p.q, ...winOf(p.t) } },
      'partners.destinations[].partner_v': { measure: 'money-flow:v', period: { quarter: p.q } },
      'partners.bank_lenders[].share_of_bank_borrowing_pct': { measure: 'lender_share', kind: 'share', period: { quarter: p.lq } },
      'partners.same_partner_both_lists[].lender_share_pct': { measure: 'lender_share', kind: 'share', period: { quarter: p.lq } },
      'partners.same_partner_both_lists[].destination_share_pct': { measure: 'goods_exports_partner', kind: 'share', period: { quarter: p.q, ...winOf(p.t) } },
      'partners.same_partner_both_lists[].overlap': { measure: 'overlap', period: { quarter: p.q, lenders_quarter: p.lq, ...winOf(p.t) } },
    } : {}),
    'validation.**': TEST(s),
  };
}

/** What each number of the Board view is (SVC-CONTRACT 1.1): every value at the quarter, J's trade side at the row's window. */
function boardBasis(s: Stress, q: string): BasisMap {
  const Q = { quarter: q };
  const QW = { quarter: q, window_to: '@@trade_window_to', partial: '@@partial' };
  const out: BasisMap = {
    'reading_threshold_k': { measure: null, kind: 'threshold', period: Q },
    'economies[].signals_at_threshold': { measure: null, kind: 'count', period: Q },
    'economies[].signals_scored': { measure: null, kind: 'count', period: Q },
    'economies[].vulnerability_v': { measure: 'money-flow:v', period: Q },
    'economies[].flow_score_f': { measure: 'money-flow:f', period: Q },
    'validation.**': TEST(s),
  };
  for (const r of s.rules) out[`economies[].values.${r.id.toUpperCase()}`] = { measure: SIGNAL_MEASURE[r.id], period: QW };
  return out;
}
