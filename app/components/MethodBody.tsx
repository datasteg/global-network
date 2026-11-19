import type { ReactNode } from 'react';
import { Term } from './Term';
import { Panel, Source } from '@/components/ui';
import { readChecks, readMeta, readValidation } from '@/lib/data';
import { siteUrl } from '@/lib/family';
import { day, month, num, quarter } from '@/lib/format';
import { t } from '@/lib/i18n';
import { method } from '@/lib/strings/method';
import type { Indicator, Lang } from '@/lib/types';

export function MethodBody({ lang, extra }: { lang: Lang; extra?: ReactNode }) {
  const L = t(lang);
  const M = method(lang);
  const meta = readMeta();
  // the money-flow method version comes from the release this build read, never a literal
  const mv = (x: string) => x.replaceAll('{method}', meta.surfaces.money.method);
  const valid = readValidation();
  const checks = readChecks();
  const v = valid.indicators.find((i) => i.id === 'v');
  const best = [...valid.indicators].filter((i) => i.auroc != null).sort((a, b) => (b.auroc ?? 0) - (a.auroc ?? 0))[0];
  const overlap = !!(best && v && best.lo != null && v.hi != null && best.lo <= v.hi);
  const yearOf = (y: number) => (lang === 'ko' ? `${y}년` : String(y));
  const vintages = Object.entries(meta.money.vintages).sort();
  /** "0.73 (0.61–0.83)": the point estimate with its bootstrap interval. */
  const iv = (i: Indicator) => (i.auroc == null ? '–' : `${num(i.auroc, lang, 2)}${i.lo != null && i.hi != null ? ` (${num(i.lo, lang, 2)}–${num(i.hi, lang, 2)})` : ''}`);
  const rules: [string, string][] = [...M.ruleList.filter(([id]) => id !== 'G18' && id !== 'G19'), [M.movedRules, M.movedRulesText], ...M.ruleList.filter(([id]) => id === 'G18' || id === 'G19')];

  return (
    <div className="gn-about-part" id="method">
      <div className="gn-prose"><h2 className="gn-about-h">{M.title}</h2><p>{M.lede}</p></div>

      {/* Every section is a panel, so all text starts at the same inset (it used to mix bare sections and boxes). */}
      <Panel id="what" title={M.what}>
        <div className="gn-prose">{M.whatBody.map((p, i) => (<p key={i}>{mv(p)}</p>))}</div>
      </Panel>

      <Panel id="rules" title={M.rules}>
        <div className="gn-prose"><p>{M.rulesLede}</p></div>
        <ol className="gn-rules" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {rules.map(([id, text]) => (
            <li className="gn-rule" key={id} id={id.toLowerCase().replace(/[^a-z0-9]+/g, '-')}><b>{id}</b><span>{mv(text)}{id === M.movedRules && <> <a href={siteUrl('money-flow', 'method', lang)}>money-flow {lang === 'ko' ? '방법론' : 'method'} →</a></>}</span></li>
          ))}
        </ol>
      </Panel>

      {extra}

      <Panel id="validation" title={M.valid} period={quarter(meta.money.quarter, lang)}>
        <p className="gn-small gn-muted gn-measure">{M.validLede(valid.episodes)}</p>
        <div className="gn-scroll">
          <table className="gn-table">
            <thead><tr><th>{M.cols.ind}</th><th>{M.cols.side}</th><th className="num"><Term id="auroc">{M.cols.auroc}</Term></th><th className="num">{M.cols.pos}</th><th className="num">{M.cols.neg}</th></tr></thead>
            <tbody>
              {valid.indicators.map((i) => (
                <tr key={i.id}>
                  <td>{i[lang]}</td>
                  <td><span className={`gn-tag gn-lane gn-lane--${i.side === 'both' ? 'money' : i.side}`}>{M.side[i.side]}</span></td>
                  <td className="num">{iv(i)}</td>
                  <td className="num">{num(i.pos, lang, 0)}</td>
                  <td className="num">{num(i.neg, lang, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="gn-prose">
          <p>{M.aurocMeaning}</p>
          <p className="gn-small gn-muted">{M.intervalNote(valid.interval.draws, valid.interval.level)}</p>
          {best && <p>{M.honest(best[lang], iv(best), best.pos, overlap)}</p>}
          {v && <p>{M.memoNote(num(v.auroc, lang, 3))}</p>}
        </div>
        <Source>{L.source}{M.source}</Source>
      </Panel>

      <Panel id="checks" title={M.checks} period={day(checks.built, lang)}>
        <p className="gn-small gn-muted gn-measure">{M.checksLede}</p>
        <div className="gn-scroll">
          <table className="gn-table gn-checks">
            <thead><tr><th>{M.checkCols.id}</th><th>{M.checkCols.what}</th><th>{M.checkCols.result}</th><th>{M.checkCols.figure}</th></tr></thead>
            <tbody>
              {checks.items.map((c) => (
                <tr key={c.id}>
                  <td className="gn-mono">{c.id}</td>
                  <td>{c[lang]}</td>
                  <td><span className={`gn-tag gn-tag--${c.status === 'pass' ? 'good' : 'warn'}`}>{c.status === 'pass' ? M.pass : M.warn}</span></td>
                  <td className="gn-small">{c.figure}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Source>{M.checkLog(checks.log)}</Source>
      </Panel>

      <Panel id="limits" title={M.limits}>
        <div className="gn-prose"><ul>{M.limitList.map((l, i) => (<li key={i}>{l}</li>))}</ul></div>
      </Panel>

      <Panel id="provenance" title={M.periods}>
        <div className="gn-prose"><p>{M.periodsLede}</p></div>
        <div className="gn-grid-2" style={{ alignItems: 'start' }}>
          <div className="gn-prov gn-lane gn-lane--money">
            <h3 className="gn-prov__h">{L.money} <span className="gn-period">{quarter(meta.money.quarter, lang)}</span></h3>
            <table className="gn-table">
              <tbody>
                <tr><td>{M.prov.release}</td><td className="num gn-mono">{meta.money.release}</td></tr>
                <tr><td>{M.prov.method}</td><td className="num gn-mono">{meta.money.method}</td></tr>
                <tr><td>{M.prov.surface}</td><td className="num gn-mono">{meta.surfaces.money.surface}</td></tr>
                <tr><td>{M.prov.quarter}</td><td className="num">{quarter(meta.money.quarter, lang)}</td></tr>
                <tr><td>{M.prov.bank}</td><td className="num">{quarter(meta.periods.bank, lang)}</td></tr>
                <tr><td>{M.prov.portfolio}</td><td className="num">{quarter(meta.periods.portfolio, lang)}</td></tr>
                <tr><td>{M.prov.fdi}</td><td className="num">{quarter(meta.periods.fdi, lang)}</td></tr>
              </tbody>
            </table>
            <p className="gn-kicker">{M.prov.vintages}</p>
            <table className="gn-table">
              <tbody>
                {vintages.map(([k, d]) => (<tr key={k}><td className="gn-mono">{k}</td><td className="num">{day(d, lang)}</td></tr>))}
              </tbody>
            </table>
          </div>
          <div className="gn-prov gn-lane gn-lane--trade">
            <h3 className="gn-prov__h">{L.trade} <span className="gn-period">{month(meta.trade.shown, lang)}</span></h3>
            <table className="gn-table">
              <tbody>
                <tr><td>{M.prov.tfBuilt}</td><td className="num">{day(meta.trade.built, lang)}</td></tr>
                <tr><td>{M.prov.surface}</td><td className="num gn-mono">{meta.surfaces.trade.surface}</td></tr>
                <tr><td>{M.prov.shown}</td><td className="num">{month(meta.trade.shown, lang)}</td></tr>
                <tr><td>{M.prov.completeA}</td><td className="num">{yearOf(meta.trade.complete.A)}</td></tr>
                <tr><td>{M.prov.completeM}</td><td className="num">{month(meta.trade.complete.M, lang)}</td></tr>
                <tr><td>{M.prov.lastA}</td><td className="num">{yearOf(meta.trade.last.A)}</td></tr>
                <tr><td>{M.prov.lastM}</td><td className="num">{month(meta.trade.last.M, lang)}</td></tr>
                <tr><td>{M.prov.built}</td><td className="num">{day(meta.built, lang)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>

    </div>
  );
}
