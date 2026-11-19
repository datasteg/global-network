import { Panel, Source } from '@/components/ui';
import { readEarn, readMeta } from '@/lib/data';
import { siteUrl } from '@/lib/family';
import { SOURCES, VIA, srcUrl, type SrcId } from '@/lib/sources';
import { day, month } from '@/lib/format';
import { t } from '@/lib/i18n';
import { sources } from '@/lib/strings/sources';
import type { Lang } from '@/lib/types';

/** The datasets a page can cite, in the order of the two lanes; each row links the publisher and the parent's method page. */
const ROWS: SrcId[] = ['bis.lbs', 'bis.cbs', 'bis.dss', 'bis.tc', 'imf.irfcl', 'imf.iip', 'imf.bop', 'imf.pip', 'imf.dip', 'fred', 'tic', 'wdi', 'imf.qnea', 'bis.xru', 'mf.episodes', 'comtrade', 'kcs', 'tf.events'];

export function SourcesBody({ lang }: { lang: Lang }) {
  const L = t(lang);
  const S = sources(lang);
  const meta = readMeta();
  const url = `https://global-network.datasteg.com/${lang}/about`;
  const reads = { vintages: meta.money.vintages, wdi: readEarn().read, trade: meta.trade.built.slice(0, 10) };
  const sm = meta.surfaces.money, st = meta.surfaces.trade;
  const yearOf = (y: number | null | undefined) => (y == null ? '–' : lang === 'ko' ? `${y}년` : String(y));

  return (
    <div className="gn-about-part" id="sources">
      <div className="gn-prose"><h2 className="gn-about-h">{S.title}</h2><p>{S.lede}</p></div>

      <Panel id="parents" title={S.parents} period={day(meta.built, lang)}>
        <div className="gn-grid-2" style={{ alignItems: 'start' }}>
          <div className="gn-prov gn-lane gn-lane--money">
            <h3 className="gn-prov__h">{S.money.name} <span className="gn-period gn-mono">{sm.release}</span></h3>
            <table className="gn-table">
              <tbody>
                <tr><td>{S.money.release}</td><td className="num gn-mono">{sm.release}</td></tr>
                <tr><td>{S.money.method}</td><td className="num gn-mono">{sm.method}</td></tr>
                <tr><td>{S.money.surface}</td><td className="num gn-mono">{sm.surface}</td></tr>
                {sm.built && <tr><td>{S.money.built}</td><td className="num">{day(sm.built, lang)}</td></tr>}
              </tbody>
            </table>
            {sm.files && <p className="gn-small"><span className="gn-kicker">{S.money.files}</span><br /><span className="gn-mono">{sm.files.join(' · ')}</span></p>}
            <p className="gn-kicker">{S.money.reads}</p>
            <ul className="gn-small" style={{ paddingLeft: 18, margin: 0 }}>{S.money.readsList.map((x, i) => (<li key={i}>{x}</li>))}</ul>
            <p className="gn-small"><a href={siteUrl('money-flow', 'method', lang)}>{S.money.links.method} →</a> · <a href={siteUrl('money-flow', 'sources', lang)}>{S.money.links.sources} →</a> · <a href={siteUrl('money-flow', 'world', lang)}>{S.money.links.world} →</a></p>
          </div>
          <div className="gn-prov gn-lane gn-lane--trade">
            <h3 className="gn-prov__h">{S.trade.name} <span className="gn-period">{day(st.built, lang)}</span></h3>
            <table className="gn-table">
              <tbody>
                <tr><td>{S.trade.built}</td><td className="num">{day(st.built, lang)}</td></tr>
                <tr><td>{S.trade.shown}</td><td className="num">{month(st.shown, lang)}</td></tr>
                <tr><td>{S.trade.surface}</td><td className="num gn-mono">{st.surface}</td></tr>
                <tr><td>{S.trade.complete}</td><td className="num">{yearOf(st.complete_a ?? meta.trade.complete.A)}</td></tr>
              </tbody>
            </table>
            {st.files && <p className="gn-small"><span className="gn-kicker">{S.trade.files}</span><br /><span className="gn-mono">{st.files.join(' · ')}</span></p>}
            <p className="gn-kicker">{S.trade.reads}</p>
            <ul className="gn-small" style={{ paddingLeft: 18, margin: 0 }}>{S.trade.readsList.map((x, i) => (<li key={i}>{x}</li>))}</ul>
            <p className="gn-small"><a href={siteUrl('trade-flow', 'method', lang)}>{S.trade.links.method} →</a> · <a href={siteUrl('trade-flow', 'events', lang)}>{S.trade.links.events} →</a></p>
          </div>
        </div>
        <p className="gn-notice gn-notice--info">{S.g18}</p>
      </Panel>

      <Panel id="datasets" title={S.datasets}>
        <p className="gn-small gn-muted gn-measure">{S.datasetsLede}</p>
        <div className="gn-scroll">
          <table className="gn-table">
            <thead><tr><th>{S.dsCols.dataset}</th><th>{S.dsCols.publisher}</th><th>{S.dsCols.licence}</th><th>{S.dsCols.via}</th><th>{S.dsCols.read}</th></tr></thead>
            <tbody>
              {ROWS.map((id) => {
                const d = SOURCES[id];
                const read = id === 'wdi' ? reads.wdi : d.vintage ? reads.vintages[d.vintage] : d.via === 'trade' ? reads.trade : undefined;
                return (
                  <tr key={id}>
                    <td><a href={srcUrl(d.url, lang)} rel="noopener">{d.name[lang]}</a></td>
                    <td>{d.publisher[lang]}</td>
                    <td>{d.licence[lang]}</td>
                    <td>{d.via ? <a href={VIA[d.via].url(lang)} rel="noopener">{VIA[d.via].name} {lang === 'ko' ? '방법론' : 'method'}</a> : '–'}</td>
                    <td className="num">{read ? day(read, lang) : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel id="cite" title={S.cite} period={day(meta.built, lang)}>
        <div className="gn-prose">
          <p>{S.citeLede}</p>
          <p><code>{S.citeForm}</code></p>
          <p><code>{S.citeExample(day(meta.built, lang), url)}</code></p>
          <p>{S.citeUpstream}</p>
        </div>
        <Source>{L.source}{S.source}</Source>
      </Panel>
    </div>
  );
}
