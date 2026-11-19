import Link from 'next/link';
import { Cite } from '@/components/Cite';
import { Term } from '@/components/Term';
import { comtrade, qOne, w12 } from '@/lib/cites';
import { LANGS, t } from '@/lib/i18n';
import { rich } from '@/lib/rich';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EconomyTabs } from '@/components/SectionTabs';
import { Head, Panel, Source, Tag, Tile } from '@/components/ui';
import { readMeta, readPairHistory, readPairs } from '@/lib/data';
import { PairSeries } from '@/components/PairSeries';
import { amt, josa, month, num, quarter, ratio, unit, window12, year } from '@/lib/format';
import { pageMeta } from '@/lib/seo';
import { name } from '@/lib/names';
import { pair } from '@/lib/strings/pair';
import type { Lang, PairLink } from '@/lib/types';

export const dynamicParams = false;
export function generateStaticParams() {
  const m = readMeta();
  const codes = [...m.economies.map((e) => e.code), m.hub];
  return LANGS.flatMap((lang) => codes.flatMap((a) => codes.filter((b) => b !== a).map((b) => ({ lang, code: a, b }))));
}
export async function generateMetadata({ params }: { params: Promise<{ lang: string; code: string; b: string }> }): Promise<Metadata> {
  const { lang, code: a, b } = await params;
  const l = lang as Lang;
  const per = readMeta().periods;
  const na = name(a, l), nb = name(b, l);
  return pageMeta(l, `/c/${a}/with/${b}`, {
    title: `${pair(l).title(na, nb)} · ${pair(l).kicker}`,
    description: l === 'ko'
      ? `${josa(na, '과와')} ${nb} 사이의 상품 교역, 은행 대출·예금, 증권투자, 직접투자를 양방향으로 담았습니다. 경로마다 기준 시점이 다릅니다. 상품은 ${month(per.goods, l)}까지 12개월, 은행은 ${quarter(per.bank, l)}, 증권투자는 ${quarter(per.portfolio, l)}, 직접투자는 ${year(per.fdi)}년입니다. 2006년부터의 시계열과 금융 대 교역 비율도 담았습니다.`
      : `Goods, bank claims, portfolio holdings and direct investment between ${na} and ${nb}, both ways, each at its own period: goods in the 12 months to ${month(per.goods, l)}, banks at ${quarter(per.bank, l)}, portfolio at ${quarter(per.portfolio, l)}, direct investment ${year(per.fdi)}. The pair since 2006 and its finance-to-trade ratio.`,
  });
}

const sum = (...v: (number | null | undefined)[]) => { const k = v.filter((x): x is number => x != null); return k.length ? k.reduce((s, x) => s + x, 0) : null; };

export default async function PairPage({ params }: { params: Promise<{ lang: string; code: string; b: string }> }) {
  const { lang: raw, code: a, b } = await params;
  const lang = raw as Lang;
  const L = t(lang);
  const P = pair(lang);
  const meta = readMeta();
  const codes = [...meta.economies.map((e) => e.code), meta.hub];
  if (a === b || !codes.includes(a) || !codes.includes(b)) notFound();
  const pairs = readPairs();
  const hist = readPairHistory(a, b);
  const ab: PairLink = pairs[`${a}>${b}`] ?? {};
  const ba: PairLink = pairs[`${b}>${a}`] ?? {};
  const na = name(a, lang), nb = name(b, lang);
  const per = meta.periods;
  const U = unit(lang);

  // finance-to-trade ratio: the headline is the last point of the history lane below, so the positions and
  // the goods window are the lane's (goods in the 12 months to that quarter end), never goods to the shown month
  const ri = hist ? hist.ratio.v.reduce<number>((acc, v, i) => (v != null ? i : acc), -1) : -1;
  const f2t = hist && ri >= 0 ? hist.ratio.v[ri] : null;
  const fin = hist && ri >= 0 ? hist.ratio.fin?.[ri] ?? null : null;
  const goods = hist && ri >= 0 ? hist.ratio.goods?.[ri] ?? null : null;
  const ratioQ = hist && ri >= 0 ? hist.ratio.q[ri] : null;
  const fwdH = hist ? hist.a === a : true;
  const rTa = hist && ri >= 0 ? (fwdH ? hist.ratio.t_ab : hist.ratio.t_ba)?.[ri] ?? null : null;
  const rTb = hist && ri >= 0 ? (fwdH ? hist.ratio.t_ba : hist.ratio.t_ab)?.[ri] ?? null : null;

  const Goods = ({ x, from, to }: { x: PairLink; from: string; to: string }) => {
    const g = x.goods;
    return (
      <Panel tone="trade" title={<>{P.goods} <span className="gn-muted" style={{ fontWeight: 400, fontSize: 15 }}>{P.dir(from, to)}</span></>} period={window12(g?.per ?? per.goods, lang)}>
        <p className="gn-small gn-muted">{P.goodsSub(from, to)}</p>
        {g ? (
          <div className="gn-tiles">
            <Tile big label={P.tiles.exports} value={amt(g.usd, lang)} unit={U}
              sub={<>{g.est ? <Tag kind="neutral">{L.est[g.est]}</Tag> : <Tag kind="neutral">{L.est[0]}</Tag>}{g.dv ? <> <Tag kind="warn">≠ {rich(L.divergence)}</Tag></> : null}</>} />
            <Tile label={<Term id="mirror">{P.tiles.mr}</Term>} value={num(g.mr, lang, 2)} sub={P.tiles.mrSub} />
          </div>
        ) : (
          <div className="gn-tiles"><Tile big label={P.tiles.exports} value="–" sub={P.missingGoods} /></div>
        )}
        <Cite items={[comtrade(w12(g?.per ?? per.goods, lang))]}>{P.sources.goods(window12(g?.per ?? per.goods, lang))}</Cite>
      </Panel>
    );
  };
  const Bank = ({ x, from, to }: { x: PairLink; from: string; to: string }) => {
    const k = x.bank;
    return (
      <Panel tone="money" title={<><Term id="reporter">{P.bank}</Term> <span className="gn-muted" style={{ fontWeight: 400, fontSize: 15 }}>{P.dir(from, to)}</span></>} period={quarter(k?.per ?? per.bank, lang)}>
        <p className="gn-small gn-muted">{P.bankSub(from, to)}</p>
        <div className="gn-tiles">
          <Tile big label={P.tiles.position} value={amt(k?.pos, lang)} unit={k?.pos != null ? U : undefined} sub={k ? undefined : P.missing} />
          <Tile label={P.tiles.flow} value={amt(k?.flow, lang, true)} unit={k?.flow != null ? U : undefined} sub={k ? `${P.tiles.flowSub}${k.kind && k.kind !== 'published' ? ` · ${k.kind}` : ''}` : undefined} subClass={k?.flow != null && k.flow < 0 ? 'down' : undefined} />
        </div>
        <Cite items={[{ src: 'bis.lbs', period: qOne(k?.per ?? per.bank, lang) }]}>{P.sources.bank(quarter(k?.per ?? per.bank, lang))}</Cite>
      </Panel>
    );
  };
  const Portfolio = ({ x, from, to }: { x: PairLink; from: string; to: string }) => {
    const p = x.portfolio;
    const total = p?.portfolio ?? sum(p?.portfolio_equity, p?.portfolio_debt);
    return (
      <Panel tone="money" title={<><Term id="portfolio">{P.portfolio}</Term> <span className="gn-muted" style={{ fontWeight: 400, fontSize: 15 }}>{P.dir(from, to)}</span></>} period={quarter(p?.per ?? per.portfolio, lang)}>
        <p className="gn-small gn-muted">{P.portfolioSub(from, to)}</p>
        <div className="gn-tiles">
          <Tile big label={P.tiles.total} value={amt(total, lang)} unit={total != null ? U : undefined} sub={p ? undefined : P.missing} />
          <Tile label={P.tiles.equity} value={amt(p?.portfolio_equity, lang)} unit={p?.portfolio_equity != null ? U : undefined} />
          <Tile label={P.tiles.debt} value={amt(p?.portfolio_debt, lang)} unit={p?.portfolio_debt != null ? U : undefined} />
        </div>
        <Cite items={[{ src: 'imf.pip', period: lang === 'ko' ? `${quarter(p?.per ?? per.portfolio, lang)}, 반기` : `${quarter(p?.per ?? per.portfolio, lang)}, half-yearly` }]}>{P.sources.portfolio(quarter(p?.per ?? per.portfolio, lang))}</Cite>
      </Panel>
    );
  };
  const Fdi = ({ x, from, to }: { x: PairLink; from: string; to: string }) => {
    const d = x.fdi;
    return (
      <Panel tone="money" title={<><Term id="fdi">{P.fdi}</Term> <span className="gn-muted" style={{ fontWeight: 400, fontSize: 15 }}>{P.dir(from, to)}</span></>} period={year(d?.per ?? per.fdi)}>
        <p className="gn-small gn-muted">{P.fdiSub(from, to)}</p>
        <div className="gn-tiles">
          <Tile big label={P.tiles.position} value={amt(d?.pos, lang)} unit={d?.pos != null ? U : undefined} sub={d ? undefined : P.missing} />
          <Tile label={P.tiles.report} value={<span className="gn-small">{d ? (P.rep[d.rep] ?? d.rep) : '–'}</span>} />
        </div>
        <Cite items={[{ src: 'imf.dip', period: lang === 'ko' ? `${year(d?.per ?? per.fdi)}년, 연간` : `${year(d?.per ?? per.fdi)}, annual` }]}>{P.sources.fdi(year(d?.per ?? per.fdi))}</Cite>
      </Panel>
    );
  };

  return (
    <div className="gn-wrap gn-page">
      <EconomyTabs lang={lang} code={a} partner={b} current="compare" />
      <Head kicker={`${P.kicker} · ${quarter(per.bank, lang)} · ${window12(per.goods, lang)}`}
        title={<span className="gn-sheet-head"><Link href={`/${lang}/c/${a}`}>{na}</Link> <span className="gn-muted">·</span> <Link href={`/${lang}/c/${b}`}>{nb}</Link> <span className="gn-mono gn-muted" style={{ fontSize: 16 }}>{a} {b}</span></span>}
        lede={P.lede(na, nb)}
        right={<Link className="gn-btn gn-btn--sm" href={`/${lang}/c/${b}/with/${a}`}>{P.reverse}</Link>} />

      <div className="gn-grid-2 gn-pair-pick">
        <div>
          <p className="gn-kicker">{P.swapA}</p>
          <div className="gn-pick">{codes.filter((c) => c !== b).map((c) => (<Link key={c} href={`/${lang}/c/${c}/with/${b}`} aria-current={c === a ? 'page' : undefined}>{name(c, lang)}</Link>))}</div>
        </div>
        <div>
          <p className="gn-kicker">{P.swapB}</p>
          <div className="gn-pick">{codes.filter((c) => c !== a).map((c) => (<Link key={c} href={`/${lang}/c/${a}/with/${c}`} aria-current={c === b ? 'page' : undefined}>{name(c, lang)}</Link>))}</div>
        </div>
      </div>

      <Panel title={P.ratio} period={ratioQ ? quarter(ratioQ, lang) : P.ratioSub}>
        <div className="gn-tiles">
          <Tile big label={P.ratio} value={ratio(f2t, lang)} sub={P.ratioSub} />
          <Tile label={P.fin} value={amt(fin, lang)} unit={fin != null ? U : undefined} />
          <Tile label={P.goodsBoth} value={amt(goods, lang)} unit={goods != null ? U : undefined} sub={goods == null ? P.missingGoods : rTa && rTb ? P.ratioGoods(month(rTa, lang), month(rTb, lang)) : undefined} />
        </div>
        <p className="gn-small gn-muted">{rich(P.ratioLede)}</p>
        <Source>{P.sources.ratio}</Source>
      </Panel>

      {/* the pair through time, every channel at its own period (data/pairs/<A>-<B>.json.br) */}
      {hist && (
        <Panel title={P.series.title} period={lang === 'ko' ? `2006년~${month(hist.shown, lang)}` : `2006–${month(hist.shown, lang)}`}>
          <p className="gn-small gn-muted">{P.series.lede}</p>
          <PairSeries lang={lang} h={hist} a={a} b={b} na={na} nb={nb} />
          <Cite items={[
            comtrade(lang === 'ko' ? `12개월 창, 2006년 2월~${month(hist.shown, lang)}, 월간` : `12-month windows, Feb 2006 to ${month(hist.shown, lang)}, monthly`),
            { src: 'bis.lbs', period: lang === 'ko' ? `${quarter(hist.bank.q[0], lang)}~${quarter(hist.per.bank, lang)}, 분기` : `${quarter(hist.bank.q[0], lang)} to ${quarter(hist.per.bank, lang)}, quarterly` },
            { src: 'imf.pip', period: lang === 'ko' ? `${quarter(hist.portfolio.p[0], lang)}~${quarter(hist.per.portfolio, lang)}, 반기` : `${quarter(hist.portfolio.p[0], lang)} to ${quarter(hist.per.portfolio, lang)}, half-yearly` },
            { src: 'imf.dip', period: lang === 'ko' ? `${year(hist.fdi.y[0])}~${year(hist.per.fdi)}년, 연간` : `${year(hist.fdi.y[0])}–${year(hist.per.fdi)}, annual` },
          ]}>{P.series.ratioNote(year(hist.fdi.y[0]))} {L.calc}.</Cite>
        </Panel>
      )}

      <div className="gn-grid-2" style={{ alignItems: 'start' }}>
        <Goods x={ab} from={na} to={nb} /><Goods x={ba} from={nb} to={na} />
        <Bank x={ab} from={na} to={nb} /><Bank x={ba} from={nb} to={na} />
        <Portfolio x={ab} from={na} to={nb} /><Portfolio x={ba} from={nb} to={na} />
        <Fdi x={ab} from={na} to={nb} /><Fdi x={ba} from={nb} to={na} />
      </div>
    </div>
  );
}
