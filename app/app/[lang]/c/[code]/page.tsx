import Link from 'next/link';
import { stress as stressStrings } from '@/lib/strings/stress';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Bars, LineChart } from '@/components/charts';
import { EconomyTabs } from '@/components/SectionTabs';
import { Head, Panel, Source, Tag, Tile } from '@/components/ui';
import { Cite } from '@/components/Cite';
import { Term } from '@/components/Term';
import { BOARD, comtrade, money, qOne, qRange, w12 } from '@/lib/cites';
import { rich } from '@/lib/rich';
import { readBoard, readCountry, readLenders, readMeta } from '@/lib/data';
import { siteUrl } from '@/lib/family';
import { amt, month, num, pct, quarter, unit, window12 } from '@/lib/format';
import { hsName } from '@/lib/hs';
import { LANGS, t } from '@/lib/i18n';
import { name } from '@/lib/names';
import { datasetLd, pageMeta } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { country } from '@/lib/strings/country';
import type { Lang, Products } from '@/lib/types';

export const dynamicParams = false;
export function generateStaticParams() {
  const m = readMeta();
  return LANGS.flatMap((lang) => [...m.economies.map((e) => ({ lang, code: e.code })), { lang, code: m.hub }]);
}
export async function generateMetadata({ params }: { params: Promise<{ lang: string; code: string }> }): Promise<Metadata> {
  const { lang: raw, code } = await params;
  const lang = raw as Lang;
  const m = readMeta();
  const c = readCountry(code);
  const n = name(code, lang);
  const q = quarter(m.money.quarter, lang), w = month(c?.trade.now.t ?? m.trade.shown, lang);
  return pageMeta(lang, `/c/${code}`, {
    title: `${n} · ${country(lang).kicker}`,
    description: lang === 'ko'
      ? `${n}의 자금은 어디서 유입되고 상품은 어디로 수출되나요. 취약성 점수 V와 흐름 점수 F, 대출국은 ${q} 기준입니다. 12개월 수출과 교역 상대·품목·병목은 ${w}까지 반영합니다. 자료원은 BIS, IMF, UN Comtrade입니다.`
      : `${n}: where its funding comes from and where its goods go. Vulnerability score V, flow score F and lenders at ${q}; 12-month exports, partners, products and chokepoints to ${w}. BIS, IMF and UN Comtrade.`,
  });
}

const TOP = 5;

/** The five largest HS chapters of one side with the other side's value of the same chapter as "net", and "other". */
function ProdTable({ lang, p, side }: { lang: Lang; p: Products; side: 'x' | 'm' }) {
  const C = country(lang), L = t(lang);
  const rows = p[side].slice(0, TOP);
  const total = side === 'x' ? p.x_bn : p.m_bn;
  const sum = rows.reduce((a, r) => a + r[side], 0);
  return (
    <div className="gn-scroll">
      <table className="gn-table gn-prodtable">
        <caption>{side === 'x' ? C.prodX : C.prodM} · {amt(total, lang)} {unit(lang)}</caption>
        <thead><tr><th>{C.prodCols.name}</th><th className="num">{C.prodCols.usd}</th><th className="num">{C.prodCols.share}</th><th className="num">{C.prodCols.yoy}</th><th className="num">{C.prodCols.net}</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const e = side === 'x' ? r.xe : r.me, y = side === 'x' ? r.xy : r.my, net = r.x - r.m;
            return (
              <tr key={r.ch}>
                <td><span className="gn-mono gn-muted">{r.ch}</span> {hsName(r.ch, lang)}{e ? <sup className="gn-earn__est" title={L.est[e]}>*</sup> : null}</td>
                <td className="num">{amt(r[side], lang)}</td>
                <td className="num">{pct(side === 'x' ? r.xs : r.ms, lang, 1)}</td>
                <td className="num">{pct(y, lang, 0, true)}</td>
                <td className="num">{amt(net, lang, true)}</td>
              </tr>
            );
          })}
          {total != null && total - sum > 0 && (
            <tr className="gn-earn__other"><td>{C.other}</td><td className="num">{amt(total - sum, lang)}</td><td className="num">{pct((100 * (total - sum)) / total, lang, 1)}</td><td /><td /></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const lastOf = <T,>(a: (T | null)[] | undefined): T | null => { if (!a) return null; for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return a[i]; return null; };

export default async function CountryPage({ params }: { params: Promise<{ lang: string; code: string }> }) {
  const { lang: raw, code } = await params;
  const lang = raw as Lang;
  const L = t(lang);
  const C = country(lang);
  const meta = readMeta();
  const c = readCountry(code);
  if (!c) notFound();
  const board = readBoard();
  const lenders = readLenders();
  const b = c.board;
  const k = b ? b.q.length - 1 : -1;
  const q = meta.money.quarter;
  const tr = c.trade;
  const kt = tr.t.indexOf(tr.now.t);
  const ranks = meta.economies.map((e) => ({ e: e.code, v: lastOf(board[e.code].v) ?? -1 })).sort((a, z) => z.v - a.v);
  const rank = ranks.findIndex((r) => r.e === code) + 1;
  const fmtBn = (v: number | null | undefined, signed = false) => (v == null ? '–' : lang === 'ko' ? `${num(v * 10, lang, 0, signed)}억 달러` : `${num(v, lang, Math.abs(v) >= 100 ? 0 : 1, signed)} bn`);
  const bands = c.episodes.map((id) => ({ from: meta.episodes[id].q, to: meta.episodes[id].q }));
  const tradeBands = c.events.map((id) => meta.events.find((e) => e.id === id)!).filter(Boolean).map((e) => ({ from: Number(e.start.slice(0, 7).replace('-', '')), to: Number((e.end ?? e.start).slice(0, 7).replace('-', '')) }));
  const lenderRows = Object.entries(lenders.debtors[code] ?? {}).sort((a, z) => z[1] - a[1]).slice(0, TOP);
  // lender shares divide by the all-reporter total (BIS:5A) of the same quarter as the positions
  const lenderTotal = lenders.total?.[code] ?? null;
  const partner = code === 'KOR' ? 'USA' : 'KOR';
  const isBoard = (p: string) => meta.economies.some((e) => e.code === p) || p === meta.hub;
  const partnerRow = (d: (typeof tr.dests)[number], href: string) => ({
    label: <><Link href={href}>{name(d.p, lang)}</Link>{d.est ? <> <Tag kind="neutral">{L.est[d.est]}</Tag></> : null}{d.dv ? <> <Tag kind="warn">≠</Tag></> : null}</>,
    value: d.usd, text: `${amt(d.usd, lang)} · ${pct(d.share, lang, 0)} · ${pct(d.yoy, lang, 0, true)}`,
  });

  const dataset = datasetLd(lang, {
    name: `${c[lang]} · ${C.kicker} · global-network`, path: `/c/${code}`, modified: meta.built.slice(0, 10),
    description: lang === 'ko'
      ? `${c[lang]}의 자금(BIS 은행통계, IMF IIP·IRFCL, money-flow 신호판 ${quarter(q, lang)})과 교역(UN Comtrade 12개월 창, ${month(tr.now.t, lang)}까지)을 경제 단위로 이은 표입니다. 숫자마다 제 기준 시점을 씁니다.`
      : `${c[lang]}: funding (BIS banking statistics, IMF IIP and IRFCL, money-flow's board at ${quarter(q, lang)}) joined with trade (UN Comtrade 12-month windows to ${month(tr.now.t, lang)}) on the economy, each figure at its own period.`,
    keywords: [c.en, 'external funding', 'goods trade', 'BIS', 'IMF', 'UN Comtrade', 'money-flow', 'trade-flow'],
    temporalCoverage: `${(b?.q[0] ?? '2005').slice(0, 4)}/${String(tr.now.t).slice(0, 4)}`,
    isBasedOn: [siteUrl('money-flow', 'economy', lang, { iso3: code }), siteUrl('trade-flow', 'economy', lang, { iso3: code })],
  });
  return (
    <div className="gn-wrap gn-page">
      <JsonLd data={dataset} />
      <EconomyTabs lang={lang} code={code} partner={partner} current="sheet" />
      <Head kicker={`${C.kicker} · ${quarter(q, lang)} · ${window12(tr.now.t, lang)}`} title={<span className="gn-sheet-head">{c[lang]} <span className="gn-mono gn-muted" style={{ fontSize: 16 }}>{code}</span></span>}
        lede={C.lede(c[lang])}
        right={<div className="gn-pick" aria-label={L.nav.countries}>{[...meta.economies.map((e) => e.code), meta.hub].map((e) => (<Link key={e} href={`/${lang}/c/${e}`} aria-current={e === code ? 'page' : undefined}>{name(e, lang)}</Link>))}</div>} />

      {c.stress && (() => {
        const st = c.stress!; const SS = stressStrings(lang);
        return (
          <section className="gn-strip st-strip" aria-label={SS.strip.title}>
            <p className="gn-kicker">{SS.strip.title} · {quarter(st.q, lang)}</p>
            <div className="st-strip__row">
              <span className={`st-strip__n${(st.count ?? 0) >= st.K ? ' st-on' : ''}`}>{st.count ?? '–'}<small>/{st.scored}</small></span>
              <span>{rich(`[[stress_count|${SS.strip.line(st.count ?? 0, st.scored, st.K)}]]`)}</span>
              <span className="gn-small">{SS.strip.fired}: {st.fired.length ? st.fired.map((x) => x.toUpperCase()).join(' · ') : SS.strip.none}</span>
              {st.ch && <span className="gn-small">{rich(`[[channel_first|${SS.head.channel}]]`)}: <b>{SS.channel[st.ch]}</b>{st.lead ? ` (${st.lead.toUpperCase()})` : ''}</span>}
              <Link className="gn-small" href={`/${lang}/stress?e=${code}`}>{SS.strip.open}</Link>
            </div>
          </section>
        );
      })()}
      <div className="gn-sheet">
        {/* ---------------- funding lane (anchor #funding: money-flow's World rows land here) ---------------- */}
        <Panel id="funding" tone="money" title={C.funding} period={b ? quarter(q, lang) : undefined}>
          {!b && <p className="gn-notice gn-notice--info">{code === meta.hub ? rich(C.hubNote) : C.noMoney}</p>}
          {b && (<>
            <div className="gn-tiles">
              <Tile big label={<Term id="v">{C.tiles.v}</Term>} value={num(b.v[k], lang, 0)} sub={C.tiles.vSub(rank, meta.economies.length)} subClass={(b.v[k] ?? 0) >= 60 ? 'down' : undefined} />
              <Tile big label={<Term id="f">{C.tiles.f}</Term>} value={num(b.flow[k], lang, 1, true)} sub={C.tiles.fSub} subClass={(b.flow[k] ?? 0) < 0 ? 'down' : 'up'} />
              <Tile label={<Term id="a2">{C.tiles.a2}</Term>} value={<>{pct(b.a2[k], lang, 0)}{b.a2_scored[k] === 0 ? '°' : ''}</>} sub={b.a2_basis[k] === 'gross' ? C.tiles.a2Gross : b.a2_floored[k] ? C.tiles.a2Floored : C.tiles.a2Net} subClass={(b.a2[k] ?? 0) >= 100 ? 'down' : undefined} />
              <Tile label={<Term id="niip">{C.tiles.niip}</Term>} value={pct(b.niip[k], lang, 0, true)} />
            </div>
            <figure className="gn-figure">
              <LineChart t={b.q} series={b.v} tone="money" h={170} zero bands={bands} fmt={(v) => String(v)} />
              <LineChart t={b.q} series={b.flow} tone="money" h={120} zero bands={bands} fmt={(v) => String(v)} unit={C.flowChart} />
              <figcaption>{rich(C.trailNote)}</figcaption>
            </figure>
            {lenderRows.length > 0 && (
              <div>
                <p className="gn-kicker"><Term id="reporter">{C.lenders}</Term></p>
                <Bars tone="money" rows={lenderRows.map(([e, v]) => ({ label: name(e, lang), value: v, text: `${amt(v, lang)}${lenderTotal ? ` · ${pct((100 * v) / lenderTotal, lang, 0)}` : ''}` }))} />
                <Cite items={[{ src: 'bis.lbs', period: qOne(lenders.q, lang) }]}>{rich(C.lendersNote(quarter(lenders.q, lang)))}</Cite>
              </div>
            )}
            <p className="gn-open"><a className="gn-btn gn-btn--sm gn-btn--primary" href={siteUrl('money-flow', 'economy', lang, { iso3: code })}>{C.openMoney(c[lang])} →</a> <span className="gn-small gn-muted">{C.openMoneyNote}</span></p>
            <Cite items={money(BOARD, qRange(meta, lang))}>{C.sources.funding(quarter(q, lang), meta.surfaces.money.method)}{b.a2_scored[k] === 0 ? ` ° ${L.notScored}.` : ''}</Cite>
          </>)}
        </Panel>

        {/* ---------------- trade lane (anchor #trade: trade-flow's chain pages land here) ---------------- */}
        <Panel id="trade" tone="trade" title={C.trade} period={window12(tr.now.t, lang)}>
          <div className="gn-tiles">
            <Tile big label={<Term id="window12">{C.tiles.x}</Term>} value={amt(tr.now.x_bn, lang)} unit={unit(lang)} sub={`${C.tiles.momx} ${pct(tr.mom_x[kt], lang, 1, true)}`} subClass={(tr.mom_x[kt] ?? 0) < 0 ? 'down' : 'up'} />
            <Tile big label={<Term id="window12">{C.tiles.m}</Term>} value={amt(tr.now.m_bn, lang)} unit={unit(lang)} sub={`${C.tiles.momm} ${pct(tr.mom_m[kt], lang, 1, true)}`} subClass={(tr.mom_m[kt] ?? 0) < 0 ? 'down' : 'up'} />
            <Tile label={<Term id="hhi">{C.tiles.hm}</Term>} value={num(tr.now.hm, lang, 2)} sub={C.tiles.hmSub} />
          </div>
          <figure className="gn-figure">
            <LineChart t={tr.t} series={tr.x} ctx={tr.m} tone="trade" h={190} zero bands={tradeBands} fmt={(v) => (lang === 'ko' ? num(v * 10, lang, 0) : String(v))} />
            <figcaption>{rich(C.seriesNote)}</figcaption>
          </figure>
          <div className="gn-partners">
            <div>
              <p className="gn-kicker">{C.dests}</p>
              <Bars tone="trade" rows={tr.dests.slice(0, TOP).map((d) => partnerRow(d, isBoard(d.p) ? `/${lang}/c/${code}/with/${d.p}` : siteUrl('trade-flow', 'flow', lang, { a: code, b: d.p })))} />
            </div>
            <div>
              <p className="gn-kicker">{C.sups}</p>
              <Bars tone="trade" rows={tr.sups.slice(0, TOP).map((d) => partnerRow(d, isBoard(d.p) ? `/${lang}/c/${d.p}/with/${code}` : siteUrl('trade-flow', 'flow', lang, { a: d.p, b: code })))} />
            </div>
          </div>
          <Source>{unit(lang)} · {C.share} · {C.yoy}. {rich(L.estNote)} ≠ {rich(L.divergence)}.</Source>
          {[...tr.dests.slice(0, TOP), ...tr.sups.slice(0, TOP)].some((d) => d.eco === false) && <p className="gn-small gn-muted">{C.nesNote}</p>}
          {tr.products && (tr.products.x.length > 0 || tr.products.m.length > 0) && (
            <div>
              <p className="gn-kicker"><Term id="hs2">{C.products}</Term> · {window12(tr.products.t, lang)}</p>
              <div className="gn-prodtables">
                <ProdTable lang={lang} p={tr.products} side="x" />
                <ProdTable lang={lang} p={tr.products} side="m" />
              </div>
              <Source>{rich(C.prodNote)}</Source>
            </div>
          )}
          {c.chokepoints.length > 0 && (
            <div>
              <p className="gn-kicker"><Term id="chokepoint">{C.chokepoints}</Term> · {meta.trade.complete.A}</p>
              <div className="gn-scroll">
                <table className="gn-table">
                  <thead><tr><th>{C.chokeCols.chain}</th><th>{C.chokeCols.stage}</th><th className="num"><Term id="hhi">{C.chokeCols.hhi}</Term></th><th>{C.chokeCols.top}</th><th className="num">{C.chokeCols.m}</th><th>{C.chokeCols.ts}</th></tr></thead>
                  <tbody>
                    {[...c.chokepoints].sort((a, z) => (z.m ?? 0) - (a.m ?? 0)).map((r) => (
                      <tr key={r.chain}><td><a href={siteUrl('trade-flow', 'chain_focus', lang, { chain: r.chain, iso3: code })}>{lang === 'ko' ? r.ko : r.en}</a></td><td>{lang === 'ko' ? r.stage_ko : r.stage}</td><td className="num">{num(r.hhi, lang, 2)}</td><td>{r.top.map(([e, s]) => `${name(e, lang)} ${num(s, lang, 0)}%`).join(' · ')}</td><td className="num">{pct(r.m, lang, 1)}</td><td>{r.ts ? `${name(r.ts, lang)} ${pct(r.tss, lang, 0)}` : '–'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Source>{rich(C.chokeNote)}</Source>
            </div>
          )}
          <p className="gn-open"><a className="gn-btn gn-btn--sm gn-btn--primary" href={siteUrl('trade-flow', 'economy', lang, { iso3: code })}>{C.openTrade(c[lang])} →</a> <span className="gn-small gn-muted">{C.openTradeNote}</span></p>
          <Cite items={[comtrade(w12(tr.now.t, lang)), { src: 'comtrade', series: [lang === 'ko' ? 'HS 2단위 품목' : 'HS 2-digit chapters'], period: lang === 'ko' ? `${w12(tr.products.t, lang)}와 1년 전 창` : `${w12(tr.products.t, lang)} and the window a year earlier` }, ...(code === 'KOR' ? [{ src: 'kcs' as const, period: lang === 'ko' ? '2000~2012년과 최근 달, 월간' : '2000–2012 and the latest months, monthly' }] : []), { src: 'comtrade', period: lang === 'ko' ? `공급망 단계, ${meta.trade.complete.A}년` : `chain stages, ${meta.trade.complete.A}` }]}>{C.sources.trade(window12(tr.now.t, lang))}</Cite>
        </Panel>
      </div>

      <div className="gn-grid-2" style={{ alignItems: 'start' }}>
        <Panel tone="money" title={C.replay}>
          <p className="gn-small gn-muted">{rich(C.replayNote)}</p>
          {c.replay && (() => { const worst = [...c.replay.rows].filter((r) => r.share != null).sort((a, z) => (a.share ?? 0) - (z.share ?? 0))[0]; return worst ? (
            <div className="gn-tiles">
              <Tile label={quarter(worst.q, lang)} value={pct(worst.share, lang, 1, true)} sub={lang === 'ko' ? '잔액 대비 분기 유출' : 'of the stock, in one quarter'} subClass={(worst.share ?? 0) < 0 ? 'down' : undefined} />
              <Tile label={lang === 'ko' ? '오늘 잔액 기준' : 'On today’s stock'} value={fmtBn((worst.share ?? 0) / 100 * c.replay.stock, true)} sub={`${lang === 'ko' ? '잔액' : 'stock'} ${fmtBn(c.replay.stock)}`} />
              <Tile label={lang === 'ko' ? '순보유액 대비' : 'Against net reserves'} value={pct(c.replay.net_reserves != null && c.replay.net_reserves > 0 ? (100 * Math.abs((worst.share ?? 0) / 100 * c.replay.stock)) / c.replay.net_reserves : null, lang, 0)} sub={c.replay.net_reserves != null && c.replay.net_reserves <= 0 ? C.notMeaningful : undefined} />
            </div>) : <p className="gn-muted gn-small">{L.none}</p>; })()}
          {!c.replay && <p className="gn-muted gn-small">{L.none}</p>}
          <p><Link className="gn-btn gn-btn--sm" href={`/${lang}/shocks/scenarios/replay?e=${code}`}>{C.open}</Link></p>
        </Panel>
        <Panel title={C.pair}>
          <p className="gn-small gn-muted">{C.pairNote}</p>
          <div className="gn-pick">{[partner, 'CHN', 'JPN', 'DEU', 'GBR'].filter((p) => p !== code).slice(0, 4).map((p) => (<Link key={p} href={`/${lang}/c/${code}/with/${p}`}>{name(code, lang)} · {name(p, lang)}</Link>))}</div>
        </Panel>
      </div>
    </div>
  );
}
