import Link from 'next/link';
import { readStress } from '@/lib/data';
import { stress as stressStrings } from '@/lib/strings/stress';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ShocksTabs } from '@/components/SectionTabs';
import { ShockReplay } from '@/components/ShockReplay';
import { Head, Panel, Tag } from '@/components/ui';
import { Cite } from '@/components/Cite';
import { Term } from '@/components/Term';
import { BOARD, comtrade, money, qRange, weeks } from '@/lib/cites';
import { rich } from '@/lib/rich';
import type { CiteItem } from '@/lib/sources';
import { readEarn, readMeta, readShock, readShocks } from '@/lib/data';
import { day, month, num, pct, quarter } from '@/lib/format';
import { LANGS, t } from '@/lib/i18n';
import { name } from '@/lib/names';
import { pageMeta } from '@/lib/seo';
import { siteUrl } from '@/lib/family';
import { earn } from '@/lib/strings/earn';
import { shock } from '@/lib/strings/shock';
import type { Lang, Quadrant } from '@/lib/types';

export const dynamicParams = false;
export function generateStaticParams() {
  return LANGS.flatMap((lang) => readShocks().replays.map((r) => ({ lang, id: r.id })));
}
export async function generateMetadata({ params }: { params: Promise<{ lang: string; id: string }> }): Promise<Metadata> {
  const { lang: raw, id } = await params;
  const lang = raw as Lang;
  const S = shock(lang);
  const d = readShock(id);
  if (!d) return pageMeta(lang, `/shocks/${id}`, { title: S.kicker, description: S.kicker });
  const lastM = Math.min(d.shown, d.months[d.months.length - 1]);
  const when = d.event.end ? `${day(d.event.start, lang)}–${day(d.event.end, lang)}` : (lang === 'ko' ? `${day(d.event.start, lang)}부터` : `from ${day(d.event.start, lang)}`);
  return pageMeta(lang, `/shocks/${id}`, {
    title: `${d.label[lang]} · ${S.kicker}`,
    description: lang === 'ko'
      ? `${d.event.title[lang]} (${when}) 결과를 나타냅니다. 진원지의 수출, 그 직접 수입국, 제3국 수출로 번지는 충격을 ${month(d.months[0], lang)}~${month(lastM, lang)}의 12개월 창으로 달마다 재생하고, 분기마다 자금흐름 점수를 입힙니다.`
      : `${d.event.title[lang]} (${when}): the shock month by month through trade links, from the origin's exports to its buyers and third markets, replayed over 12-month windows ${month(d.months[0], lang)}–${month(lastM, lang)} with funding flow scores by quarter.`,
  });
}

/** t + k months on YYYYMM numbers (month arithmetic, not list positions). */
const addMonths = (t: number, k: number) => { const n = Math.floor(t / 100) * 12 + (t % 100) - 1 + k; return Math.floor(n / 12) * 100 + (n % 12) + 1; };

export default async function ShockPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang: raw, id } = await params;
  const lang = raw as Lang;
  const L = t(lang);
  const S = shock(lang);
  const E = earn(lang);
  const d = readShock(id);
  if (!d) notFound();
  const meta = readMeta();
  const ids = new Set([...d.nodes.map((n) => n.id), ...d.summary.map((r) => r.eco)]);
  const names = Object.fromEntries([...ids].map((c) => [c, name(c, lang)]));
  const lastM = Math.min(d.shown, d.months[d.months.length - 1]);
  const lastQ = d.quarters.filter((q) => Object.values(d.finance).some((f) => f[q]?.f != null)).pop() ?? d.quarters[0];
  const quads: Quadrant[] = ['trade', 'both', 'finance', 'neither'];
  const fmtM = (m: number | null) => (m == null ? '–' : month(m, lang));
  const replayCites: CiteItem[] = [
    comtrade(lang === 'ko' ? `12개월·3개월 창, ${fmtM(d.months[0])}~${fmtM(lastM)}, 월간` : `12- and 3-month windows, ${fmtM(d.months[0])} to ${fmtM(lastM)}, monthly`),
    ...money(['bis.lbs', 'bis.dss', 'imf.irfcl'], qRange(meta, lang, d.quarters[0], lastQ)),
    { src: 'fred', series: ['DTWEXBGS', 'SWPT'], period: weeks(meta, lang) },
    { src: 'tf.events' },
  ];

  return (
    <div className="gn-wrap gn-page">
      <ShocksTabs lang={lang} current={id} />
      <Head kicker={`${S.kicker} · ${day(d.event.start, lang)} · ${fmtM(d.months[0])}–${fmtM(d.months[d.months.length - 1])}`}
        title={d.event.title[lang]} lede={d.event.dek?.[lang]}
        right={d.event.ongoing ? <Tag kind="warn">{S.ongoing}</Tag> : undefined} />
      <p className="gn-notice gn-notice--info gn-measure">{rich(S.observed)}{d.note ? ` ${d.note[lang]}` : ''}</p>
      {/* the event itself (timeline, products, sources) is trade-flow's page; this replay reads its windows (context link) */}
      <p className="gn-open"><a className="gn-btn gn-btn--sm" href={siteUrl('trade-flow', 'event', lang, { event: d.id })}>{lang === 'ko' ? `trade-flow에서 이 사건 보기` : `This event in trade-flow`} →</a> <span className="gn-small gn-muted">{lang === 'ko' ? '사건의 연표, 품목, 출처는 거기 있습니다.' : 'The event’s timeline, products and sources are there.'}</span></p>

      <ShockReplay lang={lang} data={d} names={names} />
      <Cite items={replayCites}>
        {S.sources.trade(day(meta.trade.built, lang), fmtM(lastM))} {S.sources.fin(meta.money.release, meta.money.method, quarter(lastQ, lang))} {S.sources.waves(fmtM(d.base), d.rule.n2, pct(100 * d.rule.min_share, lang, 0), d.rule.n3, d.rule.per)}
      </Cite>

      <Panel id="summary" title={S.summaryH} period={`${fmtM(d.t0)}–${fmtM(Math.min(lastM, addMonths(d.t0, 12)))} · ${quarter(lastQ, lang)}`}>
        <p className="gn-small gn-muted gn-measure">{rich(S.summaryLede(d.summary_year))}</p>
        <div className="gn-scroll">
          <table className="gn-table gn-shock-sum">
            <thead><tr><th>{S.cols.eco}</th><th><Term id="waves">{S.cols.wave}</Term></th><th>{S.cols.quad}</th><th className="num">{S.cols.x}</th><th>{S.cols.xt}</th><th className="num"><Term id="f">{S.cols.f0}</Term></th><th className="num">{S.cols.f1}</th><th className="num">{S.cols.fd}</th></tr></thead>
            <tbody>
              {d.summary.map((r) => (
                <tr key={r.eco}>
                  <td><Link href={`/${lang}/c/${r.eco}`}>{names[r.eco] ?? r.eco}</Link></td>
                  <td>{r.wave ? `${r.wave} · ${S.waves[r.wave]}` : ''}</td>
                  <td>{r.quad ? E.quad[r.quad] : '–'}</td>
                  <td className={`num${r.x != null && r.x < -20 ? ' bad' : ''}`}>{pct(r.x, lang, 1, true)}</td>
                  <td>{fmtM(r.xt)}</td>
                  <td className="num">{num(r.f0, lang, 1, true)}</td>
                  <td className="num">{num(r.f1, lang, 1, true)}</td>
                  <td className={`num${r.fd != null && r.fd < -10 ? ' bad' : ''}`}>{num(r.fd, lang, 1, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="gn-small gn-muted">{S.excluded}</p>
        <h3>{S.mediansH}</h3>
        <div className="gn-scroll">
          <table className="gn-table gn-shock-sum">
            <thead><tr><th>{S.medCols.quad}</th><th className="num">{S.medCols.n}</th><th className="num">{S.medCols.x}</th><th className="num">{S.medCols.fd}</th></tr></thead>
            <tbody>
              {quads.map((qd) => (
                <tr key={qd}><td>{E.quad[qd]}</td><td className="num">{num(d.medians[qd].n, lang, 0)}</td><td className="num">{pct(d.medians[qd].x, lang, 1, true)}</td><td className="num">{num(d.medians[qd].fd, lang, 1, true)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="gn-small gn-muted">{S.mediansNote}</p>
        {(() => {
          const tt = readStress()?.validation.trade.find((x) => x.id === id);
          if (!tt) return null;
          const SS = stressStrings(lang);
          return (
            <div id="signals" className="st-saw">
              <h3>{SS.saw.title}</h3>
              <p className="gn-small gn-muted">{rich(SS.saw.lede(quarter(tt.q, lang)))}</p>
              <p className="gn-small"><b>{SS.shocks.rho(num(tt.rho, lang, 2, true), num(tt.p, lang, 3), tt.n)}</b></p>
              <div className="gn-scroll"><table className="gn-table">
                <thead><tr><th>{SS.shocks.tcols.eco}</th><th className="num"><Term id="stress_count">{SS.shocks.tcols.count}</Term></th><th className="num">{SS.shocks.tcols.fall}</th></tr></thead>
                <tbody>{tt.rows.slice(0, 10).map((r) => (<tr key={r.eco}><td><Link href={`/${lang}/stress?e=${r.eco}&y=${tt.q}`}>{names[r.eco] ?? r.eco}</Link></td><td className={`num${r.count >= 3 ? ' bad' : ''}`}>{r.count}</td><td className="num">{pct(r.x, lang, 1, true)}</td></tr>))}</tbody>
              </table></div>
              <p className="gn-small"><Link href={`/${lang}/stress?tab=shocks&set=trade`}>{SS.saw.open}</Link></p>
            </div>
          );
        })()}
        <Cite items={[...replayCites.slice(0, 3), { src: 'wdi', series: ['BN.GSR.GNFS.CD', 'BN.GSR.FCTY.CD', 'NY.GDP.MKTP.CD'], period: lang === 'ko' ? `${d.summary_year}년, 연간` : `${d.summary_year}, annual` }]}>{S.sources.trade(day(meta.trade.built, lang), fmtM(lastM))} {S.sources.fin(meta.money.release, meta.money.method, quarter(lastQ, lang))}</Cite>
      </Panel>
    </div>
  );
}
