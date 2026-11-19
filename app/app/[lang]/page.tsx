import Link from 'next/link';
import type { Metadata } from 'next';
import { Panel, Tag, Tile } from '@/components/ui';
import { Cite } from '@/components/Cite';
import { Term } from '@/components/Term';
import { rich } from '@/lib/rich';
import type { CiteItem } from '@/lib/sources';
import { readBoard, readChanges, readCountry, readEarn, readMeta, readPulse, readShocks } from '@/lib/data';
import { shock as shockStrings } from '@/lib/strings/shock';
import { amt, day, month, num, pct, quarter, tn, unit } from '@/lib/format';
import { t } from '@/lib/i18n';
import { name } from '@/lib/names';
import { siteUrl } from '@/lib/family';
import { home } from '@/lib/strings/home';
import type { Lang } from '@/lib/types';
import { ChangeLine } from '@/components/ChangeLine';
import { EarnHero } from '@/components/EarnChart';
import { earn as earnStrings } from '@/lib/strings/earn';
import { buildDigest } from '@/lib/digest';
import { pageMeta } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang = raw as Lang;
  const m = readMeta();
  const q = quarter(m.money.quarter, lang), w = month(m.trade.shown, lang);
  // the lens, unit and view parameters are not part of the canonical URL: one page, many views
  return pageMeta(lang, '', {
    title: `${earnStrings(lang).title} · ${t(lang).siteName}`, absolute: true,
    description: lang === 'ko'
      ? `경제가 무엇으로 소득을 올리는지, 누가 누구에게 자금을 공급하고 누구와 교역하는지 한 화면에 나타냅니다. BIS, IMF, UN Comtrade 통계를 경제 단위로 이었습니다. 자금은 ${q}, 교역은 ${w}까지 기준입니다.`
      : `How economies earn, who funds whom against who trades with whom, on one screen: BIS, IMF and UN Comtrade statistics joined on the economy. Funding as of ${q}, trade to ${w}.`,
  });
}

function last<T>(a: (T | null)[]): T | null { for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return a[i]; return null; }

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang = raw as Lang;
  const L = t(lang);
  const H = home(lang);
  const meta = readMeta();
  const board = readBoard();
  const pulse = readPulse();
  const changes = readChanges();
  const earnData = readEarn();
  const replays = readShocks().replays;
  const earnCodes = [...meta.economies.map((e) => e.code), meta.hub];
  // names for the chart and its panel: the board economies and the hub, plus the creditors the funding lens names
  const creditors = [...new Set(Object.values(earnData.fund ?? {}).flatMap((f) => (f.who ?? []).map(([c]) => c)))];
  const earnNames = Object.fromEntries([...earnCodes, ...creditors].map((c) => [c, name(c, lang)]));
  const y0 = earnData.years[0], y1 = earnData.years[earnData.years.length - 1];
  const q = meta.money.quarter;
  const top = meta.top_withdrawals[0];
  const wm = pulse.world_mom[pulse.world_mom.length - 1];
  const w12 = pulse.world_w12[pulse.world_w12.length - 1];
  const fmtBn = (v: number | null | undefined) => (v == null ? '–' : lang === 'ko' ? `${num(v * 10, lang, 0, true)}억 달러` : `${num(v, lang, 1, true)} bn`);

  // economies to watch: the top five of the stress signals board (count at the default thresholds, then V), with F and
  // the economy's own 12-month export change (country files; the count is the stress build's)
  const watch = meta.economies.map((e) => {
    const b = board[e.code];
    const c = readCountry(e.code);
    const k = c ? c.trade.t.indexOf(c.trade.now.t) : -1;
    return { code: e.code, n: c?.stress?.count ?? null, v: last(b.v), f: last(b.flow), mom: c && k >= 0 ? c.trade.mom_x[k] : null, t: c?.trade.now.t ?? null };
  }).sort((a, z) => ((z.n ?? -1) - (a.n ?? -1)) || ((z.v ?? -1) - (a.v ?? -1))).slice(0, 5);

  const pm = pulse.money;
  const dollar = pm.dollar_index, swap = pm.swap_lines, cust = pm.custody_treasuries, tic = pm.tic;
  const ticM = Number(tic.latest.slice(0, 7).replace('-', ''));
  const wk = lang === 'ko' ? `53주, ${day(meta.money.pulse_day, lang)}까지` : `53 weeks to ${day(meta.money.pulse_day, lang)}`;
  const pulseCites: CiteItem[] = [{ src: 'fred', series: ['DTWEXBGS', 'SWPT', 'WMTSECL1'], period: wk }, { src: 'tic', series: ['slt_table1'], period: lang === 'ko' ? `${month(ticM, lang)}까지, 월간` : `to ${month(ticM, lang)}, monthly` }];
  const qs = lang === 'ko' ? `${quarter(q, lang)}, 분기` : `${quarter(q, lang)}, quarterly`;
  const watchCites: CiteItem[] = [{ src: 'bis.lbs', period: qs }, { src: 'bis.cbs', period: qs }, { src: 'bis.dss', period: qs }, { src: 'imf.irfcl', period: qs }, { src: 'comtrade', period: lang === 'ko' ? `12개월 창, ${month(meta.trade.shown, lang)}까지` : `12-month windows to ${month(meta.trade.shown, lang)}` }];
  const ranked = [...changes.items].sort((a, z) => (a.side === 'both' ? 0 : 1) - (z.side === 'both' ? 0 : 1)).slice(0, 5);

  return (
    <div className="gn-wrap gn-wrap--fluid gn-page">
      <EarnHero lang={lang} kicker={`${H.kicker} · ${lang === 'ko' ? `${y0}~${y1}년` : `${y0}–${y1}`}`} data={earnData} names={earnNames} codes={earnCodes} shown={meta.trade.shown} presets={replays.map((r) => ({ id: r.id, label: r.label, t0: r.t0 }))} />

      <nav className="gn-shock-links" aria-label={shockStrings(lang).kicker}>
        <span className="gn-kicker">{shockStrings(lang).kicker}</span>
        {replays.map((r) => (<Link key={r.id} className="gn-btn gn-btn--sm" href={`/${lang}/shocks/${r.id}`}>{r.label[lang]}{r.ongoing ? ' ·' : ''}{r.ongoing && <span className="gn-muted">&nbsp;{shockStrings(lang).ongoing}</span>}</Link>))}
      </nav>

      <p className="gn-lede gn-measure" style={{ marginTop: 'var(--space-5)' }}>{rich(H.headline(meta.n_out, meta.economies.length, quarter(q, lang), name(top[0], lang), fmtBn(top[1]), month(meta.trade.shown, lang), tn(w12[1] * 1000, lang), pct(wm[1], lang, 1, true)))}</p>

      {/* This build: the four weekly tiles as money-flow publishes them (R20: one pulse, never recomputed here) */}
      <section className="gn-strip gn-lane gn-lane--money" aria-label={H.strip.title}>
        <p className="gn-kicker">{H.strip.title} · {day(meta.money.pulse_day, lang)}</p>
        <div className="gn-pulse gn-pulse--strip">
          <Tile label={<Term id="dollar_index">{H.strip.tiles.dollar}</Term>} value={dollar.latest ? num(dollar.latest[1], lang, 1) : '–'} sub={dollar.chg != null ? `${pct(dollar.chg, lang, 1, true)} · ${H.strip.tiles.dollarSub}` : undefined} subClass={dollar.chg != null && dollar.chg > 0 ? 'down' : 'up'} />
          <Tile label={<Term id="swap_lines">{H.strip.tiles.swap}</Term>} value={swap.latest ? amt(swap.latest[1], lang) : '–'} unit={unit(lang)} sub={swap.chg != null ? `${fmtBn(swap.chg)} · ${H.strip.tiles.dollarSub}` : undefined} />
          <Tile label={<Term id="custody">{H.strip.tiles.custody}</Term>} value={cust.latest ? amt(cust.latest[1], lang) : '–'} unit={unit(lang)} sub={cust.chg != null ? `${fmtBn(cust.chg)} · ${H.strip.tiles.dollarSub}` : undefined} subClass={cust.chg != null && cust.chg < 0 ? 'down' : 'up'} />
          <Tile label={<Term id="tic">{H.strip.tiles.tic}</Term>} value={amt(tic.official[tic.official.length - 1][1], lang, true)} unit={unit(lang)} sub={`${month(ticM, lang)} · ${H.strip.tiles.ticSub}`} />
        </div>
        <Cite items={pulseCites}>{H.strip.line(day(meta.money.pulse_day, lang), meta.money.release)} <a href={siteUrl('money-flow', 'world', lang)}>{H.strip.open} →</a></Cite>
      </section>

      {/* three panels side by side on a wide screen, the same height; stacked on a phone */}
      <div className="gn-home-panels">
        <Panel tone="money" title={H.watch.title} period={quarter(q, lang)}>
          <p className="gn-small gn-muted">{rich(H.watch.lede)}</p>
          <div className="gn-scroll">
            <table className="gn-table gn-watch">
              <thead><tr><th>{H.watch.cols.eco}</th><th className="num"><Term id="stress_count">{H.watch.cols.n}</Term></th><th className="num"><Term id="v">{H.watch.cols.v}</Term></th><th className="num"><Term id="f">{H.watch.cols.f}</Term></th><th className="num"><Term id="mom">{H.watch.cols.mom}</Term></th><th>{H.watch.cols.open}</th></tr></thead>
              <tbody>
                {watch.map((r) => {
                  const risk = r.v != null && r.f != null && r.v >= 60 && r.f < 0;
                  return (
                    <tr key={r.code}>
                      <td><Link href={`/${lang}/c/${r.code}#funding`}>{name(r.code, lang)}</Link>{risk && <> <Tag kind="bad"><Term id="at_risk">{H.watch.atRisk}</Term></Tag></>}</td>
                      <td className={`num${r.n != null && r.n >= 3 ? ' bad' : ''}`}><Link href={`/${lang}/stress?e=${r.code}`}>{r.n ?? '–'}</Link></td>
                      <td className={`num${r.v != null && r.v >= 60 ? ' bad' : ''}`}>{num(r.v, lang, 0)}</td>
                      <td className={`num${r.f != null && r.f < 0 ? ' bad' : ''}`}>{num(r.f, lang, 1, true)}</td>
                      <td className={`num${r.mom != null && r.mom < 0 ? ' bad' : ''}`}>{pct(r.mom, lang, 1, true)}</td>
                      <td><a href={siteUrl('money-flow', 'world_follow', lang, { iso3: r.code })}>{H.watch.inMoney}</a></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p><Link className="gn-btn gn-btn--sm" href={`/${lang}/stress?tab=board`}>{H.watch.board} →</Link></p>
          <Cite items={watchCites}>{L.calc}.</Cite>
        </Panel>
        <Panel tone="money" title={H.digest} period={quarter(q, lang)}>
          <p>{rich(buildDigest(lang).headline)}</p>
          <p><Link className="gn-btn gn-btn--sm" href={`/${lang}/digest`}>{H.digestOpen}</Link></p>
        </Panel>
        <Panel title={H.changes} period={`${quarter(q, lang)} · ${month(meta.trade.shown, lang)}`}>
          <p className="gn-small gn-muted">{H.changesLede}</p>
          {ranked.length ? <ul className="gn-list">{ranked.map((c, i) => (<li key={i}><ChangeLine c={c} lang={lang} /></li>))}</ul> : <p className="gn-small gn-muted">{L.none}</p>}
          <p><Link className="gn-btn gn-btn--sm" href={`/${lang}/changes`}>{H.allChanges}</Link></p>
        </Panel>
      </div>

      <p className="gn-small gn-muted">{H.more} <Link href={`/${lang}/shocks`}>{L.nav.shocks}</Link> · <Link href={`/${lang}/about`}>{L.nav.about}</Link> · <Link href={`/${lang}/c/KOR`}>{H.sheet} · {H.korea}</Link></p>
    </div>
  );
}
