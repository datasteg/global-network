import type { Metadata } from 'next';
import { Term } from '@/components/Term';
import { MethodBody } from '@/components/MethodBody';
import { SourcesBody } from '@/components/SourcesBody';
import { Head, Panel } from '@/components/ui';
import { Cite } from '@/components/Cite';
import { comtrade, money, qRange, weeks } from '@/lib/cites';
import { plain, rich } from '@/lib/rich';
import { pageMeta } from '@/lib/seo';
import { readEarn, readMeta } from '@/lib/data';
import { day, month, pct, quarter } from '@/lib/format';
import { name } from '@/lib/names';
import { earn as earnStrings } from '@/lib/strings/earn';
import { about } from '@/lib/strings/about';
import type { Lang } from '@/lib/types';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang = raw as Lang;
  const A = about(lang);
  const m = readMeta();
  return pageMeta(lang, '/about', { title: `${A.kicker} · ${A.title}`, description: `${plain(A.lede)} ${lang === 'ko' ? `money-flow 릴리스 ${m.money.release}(방법론 ${m.money.method}), trade-flow ${day(m.trade.built, lang)} 빌드.` : `money-flow release ${m.money.release} (method ${m.money.method}), trade-flow built ${day(m.trade.built, lang)}.`}` });
}

export default async function AboutPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang = raw as Lang;
  const A = about(lang);
  const meta = readMeta();
  const ed = readEarn();
  const E = earnStrings(lang);
  const last = ed.years[ed.years.length - 1];
  const toc: [string, string][] = [['what', A.toc.what], ['rules', A.toc.rules], ['earn', A.toc.earn], ['replay', A.toc.replay], ['chokepoint', A.toc.chokepoint],
    ['validation', A.toc.validation], ['checks', A.toc.checks], ['limits', A.toc.limits], ['provenance', A.toc.provenance], ['parents', A.toc.parents], ['datasets', A.toc.datasets], ['cite', A.toc.cite]];
  return (
    <div className="gn-wrap gn-page">
      <Head kicker={`${A.kicker} · ${quarter(meta.money.quarter, lang)} · ${month(meta.trade.shown, lang)}`} title={A.title} lede={A.lede} />
      {/* contents in a sticky column on the left, the sections in one column of panels on the right */}
      <div className="gn-about">
      <nav className="gn-toc" aria-label={A.contents}>
        <p className="gn-kicker">{A.contents}</p>
        <ol>{toc.map(([id, label]) => (<li key={id}><a href={`#${id}`}>{label}</a></li>))}</ol>
      </nav>
      <div className="gn-about__body">
      <MethodBody lang={lang} extra={<>
        <Panel id="earn" title={A.earnTitle} period={lang === 'ko' ? `${ed.years[0]}~${last}년` : `${ed.years[0]}–${last}`}>
          <div className="gn-prose">{A.earnBody.map((p, i) => (<p key={i}>{rich(p)}</p>))}</div>
          <h3>{A.checksTitle}</h3>
          <p className="gn-small gn-muted gn-measure">{A.checksLede}</p>
          <div className="gn-scroll">
            <table className="gn-table">
              <thead><tr><th>{A.checkCols.eco}</th><th>{A.checkCols.exp}</th><th className="num"><Term id="gs">{A.checkCols.trade}</Term></th><th className="num"><Term id="pi">{A.checkCols.pi}</Term></th><th>{A.checkCols.quad}</th><th>{A.checkCols.ok}</th></tr></thead>
              <tbody>
                {ed.checks.map((c) => (
                  <tr key={c.eco}>
                    <td>{name(c.eco, lang)}</td>
                    <td>{A.checkWords[c.eco] ?? c.en}</td>
                    <td className="num">{pct(c.gs ?? null, lang, 1, true)}</td>
                    <td className="num">{pct(c.pi ?? null, lang, 1, true)}</td>
                    <td>{c.quad ? E.quad[c.quad] : c.note ? A.notInSet : '–'}</td>
                    <td><span className={`gn-tag gn-tag--${c.ok ? 'good' : 'warn'}`}>{c.ok ? A.ok : A.flag}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Cite items={[{ src: 'wdi', series: ['BN.GSR.GNFS.CD', 'BN.GSR.FCTY.CD', 'BX.GSR.GNFS.CD', 'BM.GSR.GNFS.CD', 'NY.GDP.MKTP.CD', 'NY.GDP.PCAP.CD'], period: lang === 'ko' ? `${ed.years[0]}~${last}년, 연간` : `${ed.years[0]}–${last}, annual` }, { src: 'imf.iip', series: ['IIP total assets / liabilities'], period: qRange(meta, lang) }, { src: 'bis.tc', period: qRange(meta, lang) }]}>{A.earnSource(day(ed.read, lang), meta.money.release)} {lang === 'ko' ? `${last}년 값` : `The table shows ${last}.`}</Cite>
        </Panel>
        <Panel id="replay" title={A.replayTitle} tone="trade">
          <div className="gn-prose">{A.replayBody.map((p, i) => (<p key={i}>{rich(p)}</p>))}</div>
          <Cite items={[comtrade(lang === 'ko' ? '12개월·3개월 창, 월간' : '12- and 3-month windows, monthly'), ...money(['bis.lbs', 'bis.dss', 'imf.irfcl'], qRange(meta, lang)), { src: 'fred', series: ['DTWEXBGS', 'SWPT'], period: weeks(meta, lang) }, { src: 'tf.events' }]}>config/shocks.yaml, scripts/shocks.py; trade-flow docs/DATA.md; money-flow method {meta.money.method}.</Cite>
        </Panel>
        <Panel id="chokepoint" title={A.chokeTitle} tone="trade">
          <div className="gn-prose">{A.chokeBody.map((p, i) => (<p key={i}>{rich(p)}</p>))}</div>
          <Cite items={[comtrade(lang === 'ko' ? `연간, 마지막 완결 연도 ${meta.trade.complete.A}년` : `annual, last complete year ${meta.trade.complete.A}`), { src: 'doj.hmg' }]}>{A.chokeSource}</Cite>
        </Panel>
      </>} />
      <SourcesBody lang={lang} />
      </div>
      </div>
    </div>
  );
}
