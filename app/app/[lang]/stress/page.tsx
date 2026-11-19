// Stress signals: /[lang]/stress with five tabs in the URL (?tab=). The data is
// scripts/stress.py's (data/stress.json.br and data/stress/<ISO3>.json.br); the browser only re-applies thresholds, K
// and on/off. The server slices what each tab draws, so a page never ships the whole grid.
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Head, Panel, Tag } from '@/components/ui';
import { Cite } from '@/components/Cite';
import { StressBar } from '@/components/stress/Bar';
import { OneEconomy } from '@/components/stress/One';
import { BoardTab, type BoardRow } from '@/components/stress/BoardTab';
import { FundingShocks, type EpisodeRows } from '@/components/stress/ShocksTab';
import { GL, TABS, withParams, type Tab } from '@/components/stress/model';
import { BOARD, comtrade, money, qRange, w12 } from '@/lib/cites';
import { readMeta, readStress, readStressEco } from '@/lib/data';
import { siteUrl } from '@/lib/family';
import { month, num, pct, quarter } from '@/lib/format';
import { t } from '@/lib/i18n';
import { allNames, name } from '@/lib/names';
import { rich } from '@/lib/rich';
import { pageMeta } from '@/lib/seo';
import { stress as strings } from '@/lib/strings/stress';
import type { Lang, Stress, StressGrid, StressRuleId } from '@/lib/types';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang = raw as Lang;
  const S = strings(lang);
  const s = readStress();
  const q = s ? quarter(s.latest, lang) : '';
  return pageMeta(lang, '/stress', {
    title: S.title,
    description: lang === 'ko'
      ? `36개 경제의 스트레스 신호 일곱 개입니다. 신호마다 자금 수치와 교역 수치를 결합했습니다(수입 지급 여력, 수출 대비 자금 수요, 이중 충격, 상대국 스트레스, 이중 의존, 달러 경로, 원자재와 완충력). 과거 위기 사례로 검증한 결과와 함께 ${q}까지 싣습니다.`
      : `Seven stress signals for 36 economies, each a funding quantity set against a trade quantity (import cover, financing need over exports, double hit, partner stress, dual dependence, dollar channel, commodities against buffers), with their test against past stress; quarters to ${q}.`,
  });
}

const sliceGrid = (g: StressGrid, idx: number[]): StressGrid => Object.fromEntries(Object.entries(g).map(([k, v]) => [k, idx.map((i) => (i >= 0 ? v[i] ?? null : null))]));
const REGION: Record<string, { en: string; ko: string }> = { Asia: { en: 'Asia', ko: '아시아' }, Europe: { en: 'Europe', ko: '유럽' }, Americas: { en: 'Americas', ko: '아메리카' }, Africa: { en: 'Africa', ko: '아프리카' }, Oceania: { en: 'Oceania', ko: '오세아니아' } };

export default async function StressPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<SP> }) {
  const { lang: raw } = await params;
  const sp = await searchParams;
  const lang = raw as Lang;
  const L = t(lang);
  const S = strings(lang);
  const s = readStress();
  if (!s) notFound();
  const meta = readMeta();
  const tabRaw = one(sp.tab);
  const tab: Tab = (TABS as readonly string[]).includes(tabRaw ?? '') ? (tabRaw as Tab) : 'one';
  const eRaw = (one(sp.e) ?? 'KOR').toUpperCase();
  const e = s.econs.includes(eRaw) ? eRaw : 'KOR';
  const names = allNames();
  const nm = (c: string) => names[c]?.[lang] ?? c;
  const econs = s.econs.map((c) => ({ code: c, name: name(c, lang) })).sort((a, z) => (a.code === 'KOR' ? -1 : z.code === 'KOR' ? 1 : a.name.localeCompare(z.name)));
  const Q = s.quarters;
  const lastQ = Q[Q.length - 1];
  const fd = s.validation.funding;
  const kicker = `${S.kicker} · ${quarter(lastQ, lang)} · ${month(meta.trade.shown, lang)}`;
  const cites = [...money(BOARD, qRange(meta, lang, Q[0], lastQ)), { src: 'fred' as const, series: ['DTWEXBGS'] }, comtrade(w12(meta.trade.shown, lang))];
  const bar = <StressBar lang={lang} rules={s.rules} K={s.K} range={s.K_range} tab={tab} e={e} econs={econs} />;

  let body: React.ReactNode = null;
  if (tab === 'one') {
    const eco = readStressEco(e);
    const g = s.grid[e];
    const bands = {
      funding: s.bands.funding.filter((b) => b.eco.includes(e)).map((b) => b.q),
      fiscal: s.bands.fiscal.filter((b) => b.eco === e).map((b) => [b.start, b.end] as [string, string]),
      events: s.bands.events.filter((b) => b.eco.includes(e)).map((b) => ({ start: b.start, label: b[lang] })),
    };
    const pnames = Object.fromEntries([...(eco?.partners?.dests ?? []), ...(eco?.partners?.lenders ?? []), ...(eco?.partners?.overlap ?? [])].map((d) => [d.p, nm(d.p)]));
    body = (
      <Suspense>
        <OneEconomy lang={lang} rules={s.rules} K={s.K} range={s.K_range} quarters={Q} g={g} eco={eco} names={pnames} bands={bands} composite={fd.composite}
          links={{ money: siteUrl('money-flow', 'economy', lang, { iso3: e }), trade: siteUrl('trade-flow', 'economy', lang, { iso3: e }), sheet: `/${lang}/c/${e}`, pair: Object.fromEntries((eco?.partners?.dests ?? []).map((d) => [d.p, s.econs.includes(d.p) || d.p === meta.hub ? `/${lang}/c/${e}/with/${d.p}` : siteUrl('trade-flow', 'flow', lang, { a: e, b: d.p })])) }} />
      </Suspense>
    );
  } else if (tab === 'board') {
    const bqRaw = one(sp.bq);
    const bq = bqRaw && Q.includes(bqRaw) ? Q.indexOf(bqRaw) : Q.length - 1;
    const trailIdx = Array.from({ length: 20 }, (_, i) => bq - 19 + i);
    const rows: BoardRow[] = meta.economies.map((m) => ({
      code: m.code, name: m[lang], adv: !!m.advanced, euro: !!m.euro_from && m.euro_from <= Q[bq], region: m.region,
      g: sliceGrid(s.grid[m.code], [bq]), trail: trailIdx.map((i) => (i >= 0 ? (s.grid[m.code].cnt[i] as number | null) : null)),
    }));
    const regions = [...new Set(meta.economies.map((m) => m.region))].sort().map((r) => ({ id: r, label: REGION[r]?.[lang] ?? r }));
    body = <Suspense><BoardTab lang={lang} rules={s.rules} K={s.K} range={s.K_range} quarters={Q} bq={bq} rows={rows} regions={regions} /></Suspense>;
  } else if (tab === 'partners') {
    body = <Partners s={s} lang={lang} sp={sp} nm={nm} />;
  } else if (tab === 'shocks') {
    body = <Shocks s={s} lang={lang} sp={sp} nm={nm} />;
  } else {
    body = <Method s={s} lang={lang} nm={nm} />;
  }

  return (
    <div className="gn-wrap gn-wrap--fluid gn-page st-page">
      <Head kicker={kicker} title={S.title} lede={rich(S.lede)} />
      <p className="gn-notice gn-notice--info st-notice">{fd.composite ? S.compositeOn(fd.composite, fd.admitted.length) : S.noComposite}</p>
      <Suspense>{bar}</Suspense>
      {body}
      <Cite items={cites}>{S.sourceOne(quarter(lastQ, lang), month(meta.trade.shown, lang))}</Cite>
      {void L}
    </div>
  );
}

// ---------------------------------------------------------------- Partners (server)
function Partners({ s, lang, sp, nm }: { s: Stress; lang: Lang; sp: SP; nm: (c: string) => string }) {
  const S = strings(lang);
  const mode = one(sp.mode) === 'f' ? 'f' : 'v';
  const top = Math.min(36, Math.max(5, Number(one(sp.top)) || 15));
  const qi = s.quarters.indexOf(s.partners.q);
  const rowsAll = s.econs.map((e) => ({ e, j4: s.grid[e].j4[qi] as number | null, cov: s.grid[e].cov[qi] as number | null }))
    .filter((r) => r.cov != null).sort((a, z) => (z.j4 ?? -1) - (a.j4 ?? -1));
  const rows = rowsAll.slice(0, top);
  const byE: Record<string, typeof s.partners.net> = {};
  for (const x of s.partners.net) (byE[x.e] ??= []).push(x);
  // columns: the partners that contribute most across the shown rows
  const colScore: Record<string, number> = {};
  for (const r of rows) for (const x of byE[r.e] ?? []) colScore[x.p] = (colScore[x.p] ?? 0) + x.w * (mode === 'v' ? x.v : Math.max(0, -(x.f ?? 0)));
  const cols = Object.entries(colScore).sort((a, z) => z[1] - a[1]).slice(0, 12).map(([p]) => p);
  const cell = (e: string, p: string) => {
    const x = (byE[e] ?? []).find((y) => y.p === p);
    if (!x) return null;
    const cov = s.grid[e].cov[qi] as number | null;
    const w = cov ? x.w / cov : null; // weight among covered partners
    return w == null ? null : mode === 'v' ? w * x.v : w * (x.f ?? 0);
  };
  const max = Math.max(1e-9, ...rows.flatMap((r) => cols.map((p) => Math.abs(cell(r.e, p) ?? 0))));
  const href = (set: Record<string, string | null>) => `/${lang}/stress${withParams(new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (v == null ? [] : [[k, String(Array.isArray(v) ? v[0] : v)]]))), set)}`;
  return (
    <>
      <Panel tone="trade" title={S.partners.title} period={quarter(s.partners.q, lang)}>
        <p className="gn-small gn-muted">{rich(S.partners.lede(quarter(s.partners.q, lang)))}</p>
        <div className="st-filters">
          <div className="gn-seg" role="group">
            <Link href={href({ mode: null })} aria-current={mode === 'v' ? 'page' : undefined} className="gn-btn gn-btn--sm" scroll={false}>{S.partners.modeV}</Link>
            <Link href={href({ mode: 'f' })} aria-current={mode === 'f' ? 'page' : undefined} className="gn-btn gn-btn--sm" scroll={false}>{S.partners.modeF}</Link>
          </div>
          <span className="gn-small gn-muted">{S.partners.top}</span>
          {[10, 15, 36].map((n) => (<Link key={n} className="gn-btn gn-btn--sm" aria-current={top === n ? 'page' : undefined} href={href({ top: n === 15 ? null : String(n) })} scroll={false}>{n}</Link>))}
        </div>
        <div className="gn-scroll">
          <table className="gn-table st-matrix">
            <thead><tr><th>{S.board.cols.eco}</th><th className="num">{mode === 'v' ? 'J4' : 'F̄'}</th><th className="num">{S.partners.cov}</th>{cols.map((p) => (<th key={p} className="num gn-small">{nm(p)}</th>))}</tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.e}>
                <td><Link href={`/${lang}/stress?e=${r.e}`}>{nm(r.e)}</Link></td>
                <td className="num"><b>{mode === 'v' ? num(r.j4, lang, 1) : num(cols.reduce((a, p) => a + (cell(r.e, p) ?? 0), 0), lang, 1, true)}</b></td>
                <td className={`num${(r.cov ?? 0) < 50 ? ' gn-muted' : ''}`}>{pct(r.cov, lang, 0)}</td>
                {cols.map((p) => { const v = cell(r.e, p); const a = v == null ? 0 : Math.abs(v) / max; return <td key={p} className="num st-mcell" style={{ background: v == null ? undefined : `color-mix(in srgb, ${mode === 'f' && v < 0 ? 'var(--bad)' : 'var(--trade)'} ${Math.round(8 + a * 60)}%, transparent)` }}>{v == null ? '' : num(v, lang, 1)}</td>; })}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Panel>
      <Panel title={rich(`[[dual_dep|${S.partners.pairs}]]`)} period={quarter(s.partners.q, lang)}>
        <p className="gn-small gn-muted">{S.partners.pairsLede}</p>
        <div className="gn-scroll">
          <table className="gn-table">
            <thead><tr><th>{S.partners.pcols.eco}</th><th>{S.partners.pcols.p}</th><th className="num st-m">{S.partners.pcols.lend}</th><th className="num st-t">{S.partners.pcols.dest}</th><th className="num">{S.partners.pcols.min}</th><th /></tr></thead>
            <tbody>{s.partners.pairs.slice(0, 25).map((x) => (
              <tr key={`${x.e}${x.p}`}>
                <td><Link href={`/${lang}/stress?e=${x.e}`}>{nm(x.e)}</Link></td><td>{nm(x.p)}</td>
                <td className="num st-m">{pct(x.lend, lang, 1)}</td><td className="num st-t">{pct(x.dest, lang, 1)}</td><td className="num"><b>{pct(x.min, lang, 1)}</b></td>
                <td className="gn-small">{s.econs.includes(x.p) || x.p === 'USA' ? <Link href={`/${lang}/c/${x.e}/with/${x.p}`}>{S.open.pair}</Link> : null}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------- Past shocks (server shell, funding part client)
function Shocks({ s, lang, sp, nm }: { s: Stress; lang: Lang; sp: SP; nm: (c: string) => string }) {
  const S = strings(lang);
  const set = (['funding', 'fiscal', 'trade'] as const).includes(one(sp.set) as 'funding') ? (one(sp.set) as 'funding' | 'fiscal' | 'trade') : 'funding';
  const fd = s.validation.funding;
  const pre = fd.set.pre;
  const href = (v: string | null) => `/${lang}/stress${withParams(new URLSearchParams(Object.entries(sp).flatMap(([k, x]) => (x == null ? [] : [[k, String(Array.isArray(x) ? x[0] : x)]]))), { set: v })}`;
  const Q = s.quarters;
  const qs = (q: string, k: number) => { const i = Q.indexOf(q); return i - k >= 0 && i >= 0 ? Q[i - k] : null; };
  const eps: EpisodeRows[] = s.bands.funding.map((ep) => {
    const preQ = Array.from({ length: pre }, (_, k) => qs(ep.q, pre - k)).filter((x): x is string => !!x);
    return { id: ep.id, label: ep[lang], q: ep.q, pre: preQ, rows: ep.eco.filter((c) => s.econs.includes(c)).map((c) => ({ eco: c, name: nm(c), g: sliceGrid(s.grid[c], preQ.map((q) => Q.indexOf(q))) })) };
  });
  const f3 = (v: number | null | undefined) => num(v ?? null, lang, 3);
  const fi = s.validation.fiscal;
  return (
    <>
      <nav className="st-filters" aria-label={S.shocks.title}>
        <div className="gn-seg" role="group">
          {(['funding', 'fiscal', 'trade'] as const).map((k) => (<Link key={k} className="gn-btn gn-btn--sm" href={href(k === 'funding' ? null : k)} aria-current={set === k ? 'page' : undefined} scroll={false}>{S.shocks.sets[k]}</Link>))}
        </div>
      </nav>
      {set === 'funding' && (
        <>
          <Suspense><FundingShocks lang={lang} rules={s.rules} K={s.K} range={s.K_range} pre={pre} episodes={eps} /></Suspense>
          <Validation s={s} lang={lang} />
        </>
      )}
      {set === 'fiscal' && (
        <Panel tone="money" title={S.shocks.sets.fiscal}>
          <p className="gn-small gn-muted">{S.shocks.fiscalLede(fi.K, fi.pre_years[0], fi.pre_years[1])}</p>
          <p><b>{S.shocks.fiscalSum(fi.hits, fi.with_data, pct(fi.false_rate, lang, 1), f3(fi.auroc))}</b></p>
          <p className="gn-small">{S.shocks.mfFiscal(f3(fi.money_flow.auroc), pct(fi.money_flow.hit_rate, lang, 1), pct(fi.money_flow.false_rate, lang, 1))} <a href={siteUrl('money-flow', 'sovereign', lang, { iso3: 'GRC' }).replace('?e=GRC', '')}>money-flow →</a></p>
          <div className="gn-scroll"><table className="gn-table">
            <thead><tr><th>{S.shocks.cols.eco}</th><th>{lang === 'ko' ? '시작' : 'Start'}</th><th className="num">{S.shocks.cols.max}</th><th>{S.shocks.cols.res}</th></tr></thead>
            <tbody>{fi.spells.map((r, i) => (
              <tr key={i}><td><Link href={`/${lang}/stress?e=${r.eco}`}>{nm(r.eco)}</Link></td><td>{r.start}</td><td className="num">{r.data ? r.max : '–'}</td>
                <td>{!r.data ? <span className="gn-muted">{S.shocks.none}</span> : r.hit ? <span className="st-on">● {S.shocks.hit}</span> : <span className="gn-muted">○ {S.shocks.miss}</span>}</td></tr>
            ))}</tbody>
          </table></div>
        </Panel>
      )}
      {set === 'trade' && (
        <Panel tone="trade" title={S.shocks.sets.trade}>
          <p className="gn-small gn-muted">{S.shocks.tradeLede}</p>
          <div className="st-eps">
            {s.validation.trade.map((tt) => (
              <div key={tt.id} className="st-ep">
                <h3><Link href={`/${lang}/shocks/${tt.id}`}>{tt.label[lang]}</Link> <span className="gn-period">{quarter(tt.q, lang)}</span></h3>
                <p className="gn-small"><b>{S.shocks.rho(num(tt.rho, lang, 2, true), num(tt.p, lang, 3), tt.n)}</b></p>
                <table className="gn-table">
                  <thead><tr><th>{S.shocks.tcols.eco}</th><th className="num">{S.shocks.tcols.count}</th><th className="num">{S.shocks.tcols.fall}</th><th className="num">{S.shocks.tcols.when}</th></tr></thead>
                  <tbody>{tt.rows.slice(0, 12).map((r) => (
                    <tr key={r.eco}><td>{nm(r.eco)}</td><td className={`num${r.count >= s.K ? ' st-on' : ''}`}>{r.count}</td><td className="num">{pct(r.x, lang, 1, true)}</td><td className="num gn-small">{r.xt ? month(r.xt, lang) : '–'}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </>
  );
}

function Validation({ s, lang }: { s: Stress; lang: Lang }) {
  const S = strings(lang);
  const fd = s.validation.funding;
  const f3 = (v: number | null | undefined) => num(v ?? null, lang, 3);
  const iv = (a: number | null | undefined, lo: number | null | undefined, hi: number | null | undefined, signed = false) => `${num(a ?? null, lang, 3, signed)} (${num(lo ?? null, lang, 3, signed)}–${num(hi ?? null, lang, 3, signed)})`;
  const c = fd.count;
  return (
    <>
      <Panel title={S.valid.title}>
        <p className="gn-small gn-muted">{rich(S.valid.lede(fd.set.episodes, fd.set.pre, quarter(fd.set.train_to, lang)))}</p>
        <div className="gn-scroll">
          <table className="gn-table st-valid">
            <thead><tr><th>{S.valid.cols.rule}</th><th className="num">{rich(`[[auroc|${S.valid.cols.auroc}]]`)}</th><th className="num st-m">{S.valid.cols.money}</th><th className="num st-t">{S.valid.cols.trade}</th><th className="num">{S.valid.cols.inc}</th><th>{S.valid.cols.adm}</th><th className="num">{S.valid.cols.thr}</th><th className="num">{S.valid.cols.hit}</th><th className="num">{S.valid.cols.ho}</th></tr></thead>
            <tbody>
              {s.rules.map((r) => {
                const x = fd.rules[r.id];
                return (
                  <tr key={r.id}>
                    <td>{rich(`[[${GL[r.id]}|${r.id.toUpperCase()} ${S.rules[r.id].short}]]`)}<br /><span className="gn-small gn-muted">{x.common.pos} / {x.common.neg}</span></td>
                    <td className="num">{iv(x.common.j, x.common.j_lo, x.common.j_hi)}</td>
                    <td className="num st-m">{f3(x.common.money)}</td><td className="num st-t">{f3(x.common.trade)}</td>
                    <td className={`num${x.inc_lo != null && x.inc_lo > 0 ? ' st-good' : ''}`}>{iv(x.inc, x.inc_lo, x.inc_hi, true)}</td>
                    <td>{x.admitted ? <Tag kind="good">{S.valid.yes}</Tag> : <Tag>{S.valid.no}</Tag>}</td>
                    <td className="num">{x.threshold == null ? '—' : `${r.dir === 'low' ? '≤' : '≥'} ${x.threshold}`}<br /><span className="gn-small gn-muted">{S.method.thrFrom[r.threshold_from]}</span></td>
                    <td className="num">{pct(x.tpr, lang, 0)} / {pct(x.fpr, lang, 0)}</td>
                    <td className="num">{pct(x.holdout.fpr, lang, 0)}</td>
                  </tr>
                );
              })}
              <tr className="st-sumrow"><td><b>{S.valid.count}</b></td><td className="num">{iv(c.auroc, c.lo, c.hi)}</td><td colSpan={2} className="num gn-small">{S.valid.v}: {iv(c.v, c.v_lo, c.v_hi)}</td><td className="num">{iv(c.diff, c.diff_lo, c.diff_hi, true)}</td><td /><td className="num">K = {c.K}</td><td className="num">{pct(c.tpr, lang, 0)} / {pct(c.fpr, lang, 0)}</td><td className="num">{pct(c.holdout.fpr, lang, 0)}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="gn-small">{S.valid.countLine(f3(c.auroc), f3(c.lo), f3(c.hi), f3(c.v), num(c.diff, lang, 3, true), num(c.diff_lo, lang, 3, true), num(c.diff_hi, lang, 3, true))}{c.loo ? ` ${S.valid.loo(f3(c.loo.min), c.loo.min_drop, f3(c.loo.max), c.loo.max_drop)}` : ''}</p>
        <h3>{S.valid.designs}</h3>
        <ul className="gn-list">{fd.designs.map((d) => (<li key={d.id}><b>{d.id}</b> {d[lang]}{d.skipped ? <span className="gn-muted"> · {lang === 'ko' ? '채택 신호 없음, 시험 안 함' : 'not tested: no admitted signal'}</span> : <> · {iv(d.auroc, d.lo, d.hi)} vs V {f3(d.v)} · {d.pass ? S.valid.pass : S.valid.fail}</>}</li>))}</ul>
        <p className="gn-small gn-muted">{S.valid.designNote}</p>
      </Panel>
      <Panel title={S.valid.expect}>
        <ul className="gn-list">{s.expectations.map((x) => (<li key={x.id}><span className="when">{x.id}</span><span>{x[lang]} · {x.pass ? <Tag kind="good">{S.valid.pass}</Tag> : <Tag kind="bad">{S.valid.fail}</Tag>} <span className="gn-small gn-muted gn-mono">{expGot(x.got)}</span></span></li>))}</ul>
      </Panel>
    </>
  );
}

function expGot(g: unknown): string {
  if (!g || typeof g !== 'object') return '';
  const o = g as Record<string, unknown>;
  if ('count' in o) return `count ${o.count ?? '–'}${Array.isArray(o.fired) && o.fired.length ? ` (${(o.fired as string[]).map((x) => x.toUpperCase()).join(' ')})` : ''}`;
  if ('max' in o) return `max ${o.max ?? '–'}`;
  return Object.entries(o).map(([k, v]) => (Array.isArray(v) ? `${k}: ${v.length ? v.map((q) => String(q).slice(0, 7)).join(' ') : '–'}` : v && typeof v === 'object' ? `${k}: J4 ${(v as { j4: unknown[] }).j4?.join('→')}, V ${(v as { v: unknown[] }).v?.join('→')}` : `${k}: ${v}`)).join('; ');
}

// ---------------------------------------------------------------- Method and sources (server)
function Method({ s, lang, nm }: { s: Stress; lang: Lang; nm: (c: string) => string }) {
  const S = strings(lang);
  const fd = s.validation.funding;
  const cov = s.econs.map((e) => ({ e, n: Object.fromEntries(s.rules.map((r) => [r.id, (s.grid[e][r.id] as (number | null)[]).filter((v) => v != null).length])) as Record<StressRuleId, number>, first: Object.fromEntries(s.rules.map((r) => [r.id, s.quarters[(s.grid[e][r.id] as (number | null)[]).findIndex((v) => v != null)] ?? null])) as Record<StressRuleId, string | null> }));
  return (
    <>
      <Panel title={S.method.title}>
        <div className="st-mrules">
          {s.rules.map((r) => {
            const x = fd.rules[r.id];
            return (
              <article key={r.id} className="st-mrule">
                <h3>{rich(`[[${GL[r.id]}|${r.id.toUpperCase()} · ${r[lang]}]]`)}</h3>
                <p className="gn-mono gn-small st-formula">{S.rules[r.id].formula}</p>
                <p className="gn-small">{S.rules[r.id].why}</p>
                <dl className="st-dl gn-small">
                  <dt className="st-m">{S.table.money}</dt><dd>{r.money[lang]} <span className="gn-muted gn-mono">{r.money.src}</span></dd>
                  <dt className="st-t">{S.table.trade}</dt><dd>{r.trade[lang]} <span className="gn-muted gn-mono">{r.trade.src}</span></dd>
                  <dt>{S.table.thr}</dt><dd>{r.threshold == null ? S.method.thrFrom.definition : `${r.dir === 'low' ? '≤' : '≥'} ${r.threshold} ${r.unit[lang]}`} · {S.method.thrFrom[r.threshold_from]}</dd>
                  <dt>{S.singleNote}</dt><dd>{r.single.money[lang]} · {r.single.trade[lang]}</dd>
                </dl>
                {x.candidates && (
                  <div className="gn-scroll"><table className="gn-table st-cand"><caption className="gn-small gn-muted">{S.valid.cand}</caption>
                    <thead><tr><th className="num">{S.valid.candCols.t}</th><th className="num">{S.valid.candCols.tpr}</th><th className="num">{S.valid.candCols.fpr}</th><th className="num">{S.valid.candCols.j}</th></tr></thead>
                    <tbody>{x.candidates.rows.map((c, i) => (<tr key={i} className={i === x.candidates!.chosen ? 'is-on' : ''}><td className="num">{c.t}{c.label ? <span className="gn-muted"> ({c.label})</span> : null}</td><td className="num">{pct(c.tpr, lang, 0)}</td><td className="num">{pct(c.fpr, lang, 0)}</td><td className="num">{num(c.j, lang, 1, true)}</td></tr>))}</tbody>
                  </table></div>
                )}
              </article>
            );
          })}
        </div>
      </Panel>
      <Panel title={S.method.rulesTitle}>
        <ul className="gn-list"><li>{S.method.g6}</li><li>{S.method.g7}</li><li>{S.method.g19}</li></ul>
        <p className="gn-small">{S.method.pit}</p>
        <p className="gn-notice gn-notice--info">{S.method.deviation}</p>
      </Panel>
      <Panel title={S.method.coverage}>
        <p className="gn-small gn-muted">{S.method.covLede}</p>
        <div className="gn-scroll"><table className="gn-table st-cov">
          <thead><tr><th>{S.board.cols.eco}</th>{s.rules.map((r) => (<th key={r.id} className="num">{r.id.toUpperCase()}</th>))}</tr></thead>
          <tbody>{cov.map((c) => (<tr key={c.e}><td>{nm(c.e)}</td>{s.rules.map((r) => (<td key={r.id} className={`num${c.n[r.id] ? '' : ' gn-muted'}`}>{c.n[r.id]}{c.first[r.id] ? <span className="gn-small gn-muted"> {c.first[r.id]!.slice(0, 4)}</span> : null}</td>))}</tr>))}</tbody>
        </table></div>
      </Panel>
      <Panel title={S.method.refs}>
        <ul className="gn-list gn-small">
          <li>Glick, R. and A. K. Rose (1999), “Contagion and trade: why are currency crises regional?”, Journal of International Money and Finance.</li>
          <li>Kaminsky, G. L. and C. M. Reinhart (2000), “On crises, contagion, and confusion”, Journal of International Economics.</li>
          <li>Bruno, V. and H. S. Shin, “Dollar and exports”, BIS Working Paper 819.</li>
          <li>IMF, “Assessing Reserve Adequacy” (2011, 2016): listed as a reference, not drawn (it would repeat A2).</li>
          <li>money-flow, vulnerability method memos (V, F, A1, A2, the episode set; method {readMeta().surfaces.money.method} in this build). <a href={siteUrl('money-flow', 'method', lang)}>money-flow →</a></li>
        </ul>
        <p className="gn-small gn-muted">{S.method.memo}</p>
        <p className="gn-small gn-muted">{S.method.srcLine}</p>
      </Panel>
    </>
  );
}
