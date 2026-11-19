'use client';
// The One economy tab: the headline (count at K, V beside it, composite, channel first), the seven signals in a table,
// the seven charts on one shared cursor, and the partners panel (who buys, who lends, the overlap).
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { Lang, StressEco, StressGrid, StressRule, StressRuleId } from '@/lib/types';
import { stress } from '@/lib/strings/stress';
import { rich } from '@/lib/rich';
import { GL, countAt, fires, fmtVal, readSel, replaceQuery, withParams } from './model';
import { SigChart, type Bands } from './SigChart';

const qLabel = (iso: string, lang: Lang) => { const y = iso.slice(0, 4), q = Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1; return lang === 'ko' ? `${y}년 ${q}분기` : `Q${q} ${y}`; };
const mLabel = (t: number | null, lang: Lang) => { if (!t) return '–'; const y = Math.floor(t / 100), m = t % 100; return lang === 'ko' ? `${y}년 ${m}월` : new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }); };
const n1 = (v: number | null | undefined, lang: Lang, d = 1) => (v == null ? '–' : v.toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }));

export function OneEconomy({ lang, rules, K, range, quarters, g, eco, names, bands, links, composite }: {
  lang: Lang; rules: StressRule[]; K: number; range: [number, number]; quarters: string[]; g: StressGrid; eco: StressEco | null;
  names: Record<string, string>; bands: Bands; links: { money: string; trade: string; sheet: string; pair: Record<string, string> }; composite: string | null;
}) {
  const S = stress(lang);
  const sp = useSearchParams();
  const sel = readSel(sp, rules, K, range);
  const lastIdx = (() => { for (let i = quarters.length - 1; i >= 0; i--) if (g.cnt[i] != null) return i; return quarters.length - 1; })();
  const yq = sp.get('y');
  const pinned = yq ? quarters.indexOf(yq) : -1;
  const [hover, setHover] = useState<number | null>(null);
  const idx = hover ?? (pinned >= 0 ? pinned : lastIdx);
  const at = countAt(rules, g, idx, sel);
  const v = g.v[idx] as number | null, comp = g.comp[idx] as number | null;
  const lag = g.lag[idx] as number | null, tm = g.tm[idx] as number | null;
  // channel first at the current thresholds: the fired signal with the highest rank, else the highest-ranked signal
  const chanOf = (r: StressRuleId) => (['j2', 'j3'].includes(r) ? 'funding' : ['j4', 'j6', 'j7'].includes(r) ? 'trade' : 'both') as 'funding' | 'trade' | 'both';
  const cand = at.fired.length ? at.fired : rules.filter((r) => !sel.off.has(r.id) && g[`${r.id}l`]?.[idx] != null).map((r) => r.id);
  const lead = cand.length ? cand.reduce((b, r) => (((g[`${r}l`]?.[idx] as number) ?? 0) > ((g[`${b}l`]?.[idx] as number) ?? 0) ? r : b)) : null;
  const pin = (i: number) => replaceQuery(withParams(sp, { y: i === lastIdx ? null : quarters[i] }));
  const ruleName = (r: StressRuleId) => `${r.toUpperCase()} ${S.rules[r].short}`;
  return (
    <div className="st-one">
      <section className="gn-panel st-headline" aria-label={S.head.count}>
        <div className="st-headline__count">
          <span className="gn-tile__label">{rich(`[[stress_count|${S.head.count}]]`)}</span>
          <span className={`st-big${at.n >= sel.k ? ' st-on' : ''}`}>{at.n}<small> / {at.scored}</small></span>
          <span className="gn-small">{at.n >= sel.k ? S.head.reached(sel.k) : S.head.notReached(sel.k)}</span>
        </div>
        <div className="st-headline__tiles">
          <div className="gn-tile"><span className="gn-tile__label">{rich(`[[v|${S.head.v}]]`)}</span><span className="gn-tile__value">{n1(v, lang, 0)}</span><span className="gn-tile__sub"><a href={links.money}>{S.open.money}</a></span></div>
          <div className="gn-tile"><span className="gn-tile__label">{rich(`[[g19|${S.head.comp}]]`)}</span><span className="gn-tile__value">{composite && comp != null ? n1(comp, lang, 0) : '–'}</span><span className="gn-tile__sub">{composite ? composite : S.head.compNone}</span></div>
          <div className="gn-tile"><span className="gn-tile__label">{rich(`[[channel_first|${S.head.channel}]]`)}</span><span className="gn-tile__value st-chan">{lead ? S.channel[chanOf(lead)] : '–'}</span><span className="gn-tile__sub">{lead ? S.head.lead(ruleName(lead)) : ''}</span></div>
          <div className="gn-tile"><span className="gn-tile__label">{pinned >= 0 && hover == null ? S.charts.pinned : S.bar.quarter}</span><span className="gn-tile__value">{qLabel(quarters[idx], lang)}</span>
            <span className="gn-tile__sub">{lag ? S.head.partial(mLabel(tm, lang)) : mLabel(tm, lang)}{pinned >= 0 && <> · <button type="button" className="st-link" onClick={() => replaceQuery(withParams(sp, { y: null }))}>{S.charts.unpin}</button></>}</span></div>
        </div>
      </section>

      <section className="gn-panel">
        <div className="gn-scroll">
          <table className="gn-table st-rtable">
            <thead><tr><th>{S.table.rule}</th><th className="num">{S.table.value}</th><th className="num">{S.table.thr}</th><th>{S.table.state}</th><th className="num">{S.table.rank}</th><th className="num st-m">{S.table.money}</th><th className="num st-t">{S.table.trade}</th></tr></thead>
            <tbody>
              {rules.map((r) => {
                const val = g[r.id][idx] as number | null;
                const f = sel.off.has(r.id) ? null : fires(r, g, idx, sel);
                const t = sel.thr[r.id];
                const sm = eco?.single[r.id].money[idx], st = eco?.single[r.id].trade[idx];
                return (
                  <tr key={r.id} className={f ? 'is-on' : sel.off.has(r.id) ? 'is-off' : ''}>
                    <td>{rich(`[[${GL[r.id]}|${ruleName(r.id)}]]`)} <span className="gn-small gn-muted">{r.unit[lang]}</span></td>
                    <td className="num">{fmtVal(r.id, val, lang)}</td>
                    <td className="num">{t == null ? '—' : `${r.dir === 'low' ? '≤' : '≥'} ${t}`}</td>
                    <td>{sel.off.has(r.id) ? S.bar.off : f == null ? <span className="gn-muted">{r.id === 'j1' && g.j1n?.[idx] ? S.table.notMeaningful : S.table.na}</span> : f ? <span className="st-on">● {S.table.fired}</span> : <span className="gn-muted">○ {S.table.quiet}</span>}</td>
                    <td className="num">{n1(g[`${r.id}l`]?.[idx] as number | null, lang, 0)}</td>
                    <td className="num st-m" title={r.single.money[lang]}>{n1(sm ?? null, lang, Math.abs(sm ?? 0) < 1 ? 2 : 1)}</td>
                    <td className="num st-t" title={r.single.trade[lang]}>{n1(st ?? null, lang, Math.abs(st ?? 0) < 1 ? 2 : 1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="gn-panel">
        <div className="gn-panel__head"><h2>{S.charts.title}</h2><span className="gn-period">{qLabel(quarters[0], lang)}–{qLabel(quarters[lastIdx], lang)}</span></div>
        <p className="gn-small gn-muted">{S.charts.lede}</p>
        <div className="st-charts">
          {rules.map((r) => (
            <SigChart key={r.id} id={r.id} title={S.rules[r.id].short} q={quarters} money={eco?.single[r.id].money ?? []} trade={eco?.single[r.id].trade ?? []}
              sig={g[r.id] as (number | null)[]} thr={sel.thr[r.id]} dir={r.dir} fired={quarters.map((_, i) => (sel.off.has(r.id) ? null : fires(r, g, i, sel)))}
              bands={bands} active={idx} onHover={setHover} onPin={pin} labels={{ money: r.single.money[lang], trade: r.single.trade[lang], sig: r.unit[lang] }} />
          ))}
        </div>
      </section>

      {eco?.partners && (
        <section className="gn-panel">
          <div className="gn-panel__head"><h2>{S.partnersPanel.title}</h2><span className="gn-period">{qLabel(eco.partners.q, lang)} · {mLabel(eco.partners.t, lang)}</span></div>
          <div className="st-pcols">
            <div className="gn-lane gn-lane--trade">
              <h3>{S.partnersPanel.dests}</h3>
              <table className="gn-table"><tbody>{eco.partners.dests.map((d) => (
                <tr key={d.p}><td><Link href={links.pair[d.p] ?? links.sheet}>{names[d.p] ?? d.p}</Link></td><td className="num">{n1(d.share, lang)}%</td><td className="num">{d.board ? `V ${n1(d.v, lang, 0)}` : '–'}</td></tr>
              ))}</tbody></table>
              {eco.partners.dests.some((d) => d.eco === false) && <p className="gn-small gn-muted">{S.table.nesNote}</p>}
            </div>
            <div className="gn-lane gn-lane--money">
              <h3>{S.partnersPanel.lenders} <span className="gn-period">{qLabel(eco.partners.lq, lang)}</span></h3>
              {eco.partners.lenders.length ? <table className="gn-table"><tbody>{eco.partners.lenders.map((d) => (
                <tr key={d.p}><td>{names[d.p] ?? d.p}</td><td className="num">{n1(d.share, lang)}%</td></tr>
              ))}</tbody></table> : <p className="gn-small gn-muted">{S.partnersPanel.none}</p>}
            </div>
            <div className="gn-lane">
              <h3>{rich(`[[dual_dep|${S.partnersPanel.overlap}]]`)}</h3>
              <table className="gn-table"><tbody>{eco.partners.overlap.map((d) => (
                <tr key={d.p}><td>{names[d.p] ?? d.p}</td><td className="num st-m">{n1(d.lend, lang)}%</td><td className="num st-t">{n1(d.dest, lang)}%</td><td className="num"><b>{n1(d.min, lang)}</b></td></tr>
              ))}</tbody></table>
            </div>
          </div>
        </section>
      )}
      <p className="gn-open gn-small"><a href={links.sheet}>{S.open.sheet}</a> <a href={links.money}>{S.open.money}</a> <a href={links.trade}>{S.open.trade}</a></p>
    </div>
  );
}
