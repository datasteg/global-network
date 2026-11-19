// The fixed hooks of the /svc/v1 contract: manifest, search, item, economy, economies.
import { readCountry, readMeta, readShock, readShocks, readStress } from '@/lib/data';
import { allNames } from '@/lib/names';
import { siteUrl } from '@/lib/family';
import { stress as stressStrings } from '@/lib/strings/stress';
import { SvcFail, badParam } from '@/lib/svc';
import type { Lang, StressRuleId } from '@/lib/types';
import { APP, SURFACE, VIEWS, envelope, intParam, n, nameEn, nameOf, qid, release, sheetCodes, sources, window12m, ym, type Envelope } from './common';
import { buildCountry, countryText, headlineRows } from './country';
import { buildPair, pairText } from './pair';
import { buildShock, shockText } from './shock';
import { buildSignal, buildStressBoard, buildStressEconomy, stressText } from './stress';

export const ITEM_KINDS = ['country', 'pair', 'shock', 'stress'] as const;
const MAX_TEXT = 20000;

export function manifest() {
  const meta = readMeta();
  return { app: APP, surface: SURFACE, release: release(), built: meta.built, views: [...VIEWS], hooks: ['search', 'item', 'economy', 'economies'], item_kinds: [...ITEM_KINDS] };
}

export function economies(lang: Lang): Envelope {
  const meta = readMeta();
  const list = sheetCodes(meta).map((c) => ({ code: c, name: nameOf(c, lang), page: `/${lang}/c/${c}`, board: c !== meta.hub }));
  return envelope('economies', `/${lang}/c/KOR`, {
    period: { freq: 'Q', shown: meta.money.quarter, newest: meta.money.quarter, goods_shown: ym(meta.trade.shown) }, basis: {},
    sources: sources([{ src: 'bis.lbs' }, { src: 'imf.iip' }, { src: 'comtrade' }], meta),
    summary: `global-network has a country sheet for ${list.length} economies: the ${meta.economies.length} money-flow Signal Board economies and the United States as the hub of the dollar system (funding from BIS and IMF via money-flow, goods from UN Comtrade via trade-flow).`,
    data: { economies: list },
  }, meta);
}

export function economyHook(raw: string, lang: Lang): Envelope {
  const code = String(raw ?? '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw badParam(`iso3 must be an ISO 3166-1 alpha-3 code such as KOR; got "${String(raw ?? '').slice(0, 20)}".`);
  const meta = readMeta();
  if (!sheetCodes(meta).includes(code) || !readCountry(code)) {
    const known = allNames()[code];
    return envelope('economy', `/${lang}`, {
      period: { freq: 'Q', shown: meta.money.quarter, newest: meta.money.quarter }, basis: {},
      sources: [], data: { covered: false, name: known ? known[lang] : code, headline: [], links: [] },
      summary: `global-network has no country sheet for ${known ? `${known.en} (${code})` : code}. It covers the ${meta.economies.length} money-flow board economies and the United States; GET /v1/global-network/economies lists them.`,
    }, meta);
  }
  const c = readCountry(code)!;
  const rows = headlineRows(code).slice(0, 8);
  const headline = rows.map((h) => ({ label: h.label, value: h.value, unit: h.unit, period: h.period, measure: h.measure }));
  const partner = code === 'KOR' ? 'USA' : 'KOR';
  const links = [
    { label: 'Country sheet', page: `/${lang}/c/${code}` },
    ...(c.stress ? [{ label: 'Stress signals', page: `/${lang}/stress?e=${code}` }] : []),
    { label: `Pair with ${nameEn(partner)}`, page: `/${lang}/c/${code}/with/${partner}` },
    ...(c.board ? [{ label: 'money-flow economy page', page: siteUrl('money-flow', 'economy', lang, { iso3: code }) }] : []),
    { label: 'trade-flow economy page', page: siteUrl('trade-flow', 'economy', lang, { iso3: code }) },
  ];
  const get = (label: string) => rows.find((r) => r.label.startsWith(label))?.value ?? null;
  const w = window12m(c.trade.now.t);
  const summary = (c.board ? `${c.en}, ${qid(meta.money.quarter)} (money-flow board, BIS and IMF): vulnerability score V ${n(get('Vulnerability'), 0)}, flow score F ${n(get('Flow score'), 1, true)}% a year. ` : `The ${c.en} is the hub of the dollar system and has no funding row on the board. `)
    + `Goods ${w.from} to ${w.to} (UN Comtrade via trade-flow, exports as partners record them): exports USD ${n(c.trade.now.x_bn, 1)} bn, imports USD ${n(c.trade.now.m_bn, 1)} bn.`
    + (c.stress ? ` Stress signals: ${c.stress.count ?? 0} of ${c.stress.scored} at threshold (${qid(c.stress.q)}).` : '');
  return envelope('economy', `/${lang}/c/${code}`, {
    period: { freq: 'Q', shown: meta.money.quarter, newest: meta.money.quarter, goods_window: w },
    sources: sources([...(c.board ? [{ src: 'bis.lbs' as const }, { src: 'imf.iip' as const }, { src: 'imf.irfcl' as const }] : []), { src: 'comtrade' as const, period: `12-month window, ${w.from} to ${w.to}` }], meta),
    summary, data: { covered: true, name: c[lang], headline, links },
    basis: { 'headline[].value': { measure: '@measure', period: { period: '@period' } } },
  }, meta);
}

// ---------------------------------------------------------------- search
interface Hit { id: string; kind: string; title: string; snippet: string; page: string; score: number }
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function scoreOf(q: string, exact: string[], text: string[]): number {
  const nq = norm(q);
  if (!nq) return 0;
  const ex = exact.map(norm);
  if (ex.includes(nq)) return 1;
  if (ex.some((x) => x.startsWith(nq) || x.split(' ').some((w) => w === nq))) return 0.8;
  if (ex.some((x) => x.includes(nq))) return 0.6;
  const words = nq.split(' ');
  const hay = norm(text.join(' '));
  if (words.every((w) => hay.includes(w))) return 0.4;
  return 0;
}

export function search(sp: URLSearchParams, langIn: Lang): { items: Hit[] } {
  const q = (sp.get('q') ?? '').trim().slice(0, 100);
  if (!q) throw badParam('q is required: an economy code or name (KOR, Korea), a pair (KOR-USA), a shock (covid) or a signal (import cover).');
  const limit = intParam(sp, 'limit', 1, 20, 10);
  const lang = langIn;
  const meta = readMeta();
  const hits: Hit[] = [];
  const codes = sheetCodes(meta);
  const names = allNames();
  // a pair: "KOR-USA", "Korea and Japan", "KOR USA"
  const two = q.split(/\s*(?:-|–|\/|>|,|&|\band\b|\bwith\b|\bvs\b|\s)\s*/i).filter(Boolean);
  const resolve = (s: string) => { const u = s.toUpperCase(); if (codes.includes(u)) return u; const nn = norm(s); return codes.find((c) => norm(names[c]?.en ?? '') === nn || norm(names[c]?.ko ?? '') === nn) ?? null; };
  if (two.length === 2) {
    const a = resolve(two[0]), b = resolve(two[1]);
    if (a && b && a !== b) hits.push({ id: `pair:${a}-${b}`, kind: 'pair', title: `${nameOf(a, lang)} · ${nameOf(b, lang)}`, snippet: `Goods, bank claims, portfolio holdings and direct investment between ${nameEn(a)} and ${nameEn(b)}, both ways.`, page: `/${lang}/c/${a}/with/${b}`, score: 1 });
  }
  for (const c of codes) {
    const nm = names[c] ?? { en: c, ko: c };
    const s = scoreOf(q, [c, nm.en, nm.ko], [nm.en, 'country sheet funding trade economy']);
    if (s > 0) hits.push({ id: `country:${c}`, kind: 'country', title: nameOf(c, lang), snippet: `${nm.en} (${c}): funding at ${qid(meta.money.quarter)} and goods trade in the 12 months to ${ym(meta.trade.shown)}, with lenders, partners, products, chokepoints and stress signals.`, page: `/${lang}/c/${c}`, score: s });
  }
  for (const r of readShocks().replays) {
    const s = scoreOf(q, [r.id, r.label.en, r.label.ko, r.title.en, r.title.ko, r.id.split('-')[0]], [r.label.en, r.title.en, 'shock replay']);
    if (s > 0) hits.push({ id: `shock:${r.id}`, kind: 'shock', title: r.label[lang], snippet: `Shock replay: ${r.title.en}, from ${ym(r.t0)}, through trade links month by month with funding flow scores by quarter.`, page: `/${lang}/shocks/${r.id}`, score: s });
  }
  const st = readStress();
  if (st) {
    const S = stressStrings('en');
    for (const r of st.rules) {
      const s = scoreOf(q, [r.id, r.en, r.ko, S.rules[r.id].short], [r.en, S.rules[r.id].formula, 'stress signal']);
      if (s > 0) hits.push({ id: `stress:${r.id}`, kind: 'stress', title: `${r.id.toUpperCase()} ${lang === 'ko' ? r.ko : S.rules[r.id].short}`, snippet: `Stress signal: ${S.rules[r.id].formula}.`, page: `/${lang}/stress?tab=method`, score: s });
    }
    const sb = scoreOf(q, ['stress', 'stress signals', 'stress board'], ['stress signals board early warning']);
    if (sb > 0) hits.push({ id: 'stress:board', kind: 'stress', title: lang === 'ko' ? stressStrings('ko').title : S.title, snippet: `The seven stress signals for the 36 board economies, ${qid(st.latest)}; no composite (rule G19).`, page: `/${lang}/stress?tab=board`, score: sb });
  }
  hits.sort((a, z) => z.score - a.score || a.id.localeCompare(z.id));
  return { items: hits.slice(0, limit) };
}

// ---------------------------------------------------------------- item
export function item(sp: URLSearchParams, lang: Lang): Envelope {
  const id = (sp.get('id') ?? '').trim();
  const m = /^([a-z]+):([A-Za-z0-9-]{1,40})$/.exec(id);
  if (!m) throw badParam(`id must be <kind>:<key>, such as country:KOR, pair:KOR-USA, shock:covid-2020, stress:KOR, stress:j1 or stress:board; got "${id.slice(0, 60)}".`);
  const [, kind, key] = m;
  const unknown = () => new SvcFail(404, 'unknown-item', 'Unknown item', `${id} is not an item global-network has. Kinds: ${ITEM_KINDS.join(', ')}; GET /svc/v1/search?q= finds ids.`);
  let env: Envelope, title: string, text: string;
  const codes = sheetCodes();
  if (kind === 'country') {
    const c = key.toUpperCase();
    if (!codes.includes(c)) throw unknown();
    env = buildCountry(c, lang); title = `${nameOf(c, lang)}: country sheet`; text = countryText(env);
  } else if (kind === 'pair') {
    const [a, b] = key.toUpperCase().split('-');
    if (!a || !b || a === b || !codes.includes(a) || !codes.includes(b)) throw unknown();
    env = buildPair(a, b, lang); title = `${nameOf(a, lang)} · ${nameOf(b, lang)}: pair`; text = pairText(env);
  } else if (kind === 'shock') {
    const d = readShock(key.toLowerCase());
    if (!d) throw unknown();
    env = buildShock(d, lang); title = `${d.label[lang]}: shock replay`; text = shockText(env);
  } else if (kind === 'stress') {
    const s = readStress();
    if (!s) throw unknown();
    const k = key.toLowerCase(), u = key.toUpperCase();
    if (/^j[1-7]$/.test(k)) { env = buildSignal(s, k as StressRuleId, lang); title = `${u}: stress signal`; }
    else if (k === 'board') { env = buildStressBoard(s, lang); title = 'Stress signals board'; }
    else if (s.econs.includes(u)) { env = buildStressEconomy(s, u, lang); title = `${nameOf(u, lang)}: stress signals`; }
    else throw unknown();
    text = stressText(env);
  } else throw unknown();
  if (text.length > MAX_TEXT) text = `${text.slice(0, MAX_TEXT - 40)}\n\n(cut at 20,000 characters)`;
  const { table: _table, ...rest } = env;
  void _table;
  return { ...rest, view: 'item', data: { id: `${kind}:${kind === 'shock' ? key.toLowerCase() : kind === 'stress' && /^j[1-7]$|^board$/i.test(key) ? key.toLowerCase() : key.toUpperCase()}`, title, text, metadata: { kind, page: env.page, release: env.release, built: env.built, period: env.period ?? null } } };
}
