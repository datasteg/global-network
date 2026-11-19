'use client';
// Scenario S1: a past quarter's withdrawal share applied to today's funding stock. Pure arithmetic on the replay kit.
import { Cite } from './Cite';
import { Term } from './Term';
import { comtrade, money, qOne, w12 } from '@/lib/cites';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bars } from '@/components/charts';
import { Panel, Source, Tile } from '@/components/ui';
import { amt, month, num, pct, quarter, unit } from '@/lib/format';
import { t } from '@/lib/i18n';
import { replayStrings } from '@/lib/strings/replay';
import type { Lang, Replay, ReplayEcon } from '@/lib/types';

function calc(e: ReplayEcon, share: number | null) {
  const w = share != null ? (share / 100) * e.stock : null; // signed USD bn; negative is withdrawal
  const out = w != null && w < 0 ? -w : null;
  return {
    w, out,
    // net reserves unfloored (registry net_reserves): when they are not positive the cover ratio is not meaningful
    after: e.net_reserves != null && w != null ? e.net_reserves + Math.min(0, w) : null,
    cover: e.net_reserves != null && e.net_reserves > 0 && out != null ? (100 * out) / e.net_reserves : null,
    months: e.imports_12m != null && e.imports_12m > 0 && out != null ? (out / e.imports_12m) * 12 : null,
  };
}

export function ReplayTool({ lang, data, names, q, shown }: { lang: Lang; data: Replay; names: Record<string, string>; q: string; shown: number }) {
  const L = t(lang);
  const R = replayStrings(lang);
  const U = unit(lang);
  const sp = useSearchParams();
  const codes = Object.keys(data.econ).sort((a, b) => (names[a] ?? a).localeCompare(names[b] ?? b, lang));
  // the view's state lives in the URL (?e=KOR&q=2008-12-31&mode=past|custom&cut=-10), so a view can be cited and linked
  const want = sp.get('e')?.toUpperCase();
  const wantQ = data.quarters.findIndex((x) => x.q === sp.get('q'));
  const wantCut = Number(sp.get('cut'));
  const [eco, setEco] = useState(want && data.econ[want] ? want : data.econ.KOR ? 'KOR' : codes[0]);
  const [qi, setQi] = useState(wantQ >= 0 ? wantQ : 0);
  const [mode, setMode] = useState<'past' | 'custom'>(sp.get('mode') === 'custom' ? 'custom' : 'past');
  const [custom, setCustom] = useState(Number.isFinite(wantCut) && sp.get('cut') ? Math.max(-40, Math.min(10, wantCut)) : -10);
  useEffect(() => {
    const u = new URLSearchParams({ e: eco, q: data.quarters[qi]?.q ?? '', mode });
    if (mode === 'custom') u.set('cut', String(custom));
    try { window.history.replaceState(null, '', `?${u.toString()}`); } catch { /* ignore */ }
  }, [eco, qi, mode, custom, data.quarters]);

  const e = data.econ[eco];
  const row = e.rows[qi];
  const rq = data.quarters[qi];
  const share = mode === 'custom' ? custom : row?.share ?? null;
  const r = calc(e, share);
  const wb = mode === 'past' && row?.share_bank != null ? (row.share_bank / 100) * e.stock : null;
  const wd = mode === 'past' && row?.share_bond != null ? (row.share_bond / 100) * e.stock : null;
  const pickEco = (c: string) => setEco(c);

  const all = codes.map((c) => { const ec = data.econ[c]; const s = mode === 'custom' ? custom : ec.rows[qi]?.share ?? null; return { c, s, ...calc(ec, s) }; })
    .sort((a, b) => (b.cover ?? -1) - (a.cover ?? -1));
  const qLabel = (k: number) => `${quarter(data.quarters[k].q, lang)} · ${data.quarters[k][lang]}`;

  return (
    <>
      <Panel tone="money" title={names[eco] ?? eco} period={quarter(q, lang)}>
        <div className="gn-controls">
          <label className="gn-field"><span className="gn-label">{R.controls.economy}</span>
            <select className="gn-select" value={eco} onChange={(ev) => pickEco(ev.target.value)}>{codes.map((c) => (<option key={c} value={c}>{names[c] ?? c}</option>))}</select></label>
          <label className="gn-field"><span className="gn-label">{R.controls.quarter}</span>
            <select className="gn-select" value={qi} onChange={(ev) => setQi(Number(ev.target.value))}>{data.quarters.map((x, k) => (<option key={k} value={k}>{qLabel(k)}</option>))}</select></label>
          <div className="gn-field"><span className="gn-label">{R.controls.mode}</span>
            <div className="gn-seg" role="group">
              <button type="button" aria-pressed={mode === 'past'} onClick={() => setMode('past')}>{R.controls.past}</button>
              <button type="button" aria-pressed={mode === 'custom'} onClick={() => setMode('custom')}>{R.controls.custom}</button>
            </div></div>
          {mode === 'custom' && (
            <label className="gn-field gn-range-field"><span className="gn-label">{R.controls.customLabel} · <b>{pct(custom, lang, 1, true)}</b> <span className="gn-muted">({R.controls.customHint})</span></span>
              <input className="gn-range" type="range" min={-40} max={10} step={0.5} value={custom} onChange={(ev) => setCustom(Number(ev.target.value))} /></label>
          )}
        </div>

        <div className="gn-tiles">
          <Tile label={R.tiles.stock} value={amt(e.stock, lang)} unit={U} sub={`${R.tiles.stockSub}: ${amt(e.loans, lang)} + ${amt(e.ids, lang)}`} />
          <Tile label={<Term id="net_reserves">{R.tiles.resNet}</Term>} value={amt(e.net_reserves, lang)} unit={e.net_reserves != null ? U : undefined} sub={e.net_reserves != null ? R.tiles.resSub : R.noRes} subClass={(e.net_reserves ?? 0) < 0 ? 'down' : undefined} />
          <Tile label={<Term id="window12">{R.tiles.imports}</Term>} value={amt(e.imports_12m, lang)} unit={e.imports_12m != null ? U : undefined} sub={`${month(e.imports_window_to ?? shown, lang)}${e.imports_partial ? ` · ${R.partial}` : ''}`} />
        </div>

        <p className="gn-kicker">{R.result} · {mode === 'past' ? qLabel(qi) : R.controls.custom}</p>
        {share == null ? <p className="gn-notice">{R.noShare}</p> : (
          <div className="gn-tiles">
            <Tile big label={<Term id="first_round">{R.tiles.share}</Term>} value={pct(share, lang, 1, true)} sub={R.tiles.shareSub} subClass={share < 0 ? 'down' : 'up'} />
            <Tile big label={<Term id="withdrawal">{r.w != null && r.w < 0 ? R.tiles.withdrawal : R.tiles.inflow}</Term>} value={amt(r.w != null ? Math.abs(r.w) : null, lang)} unit={U}
              sub={wb != null && wd != null ? `${R.tiles.bank} ${amt(wb, lang, true)} · ${R.tiles.bond} ${amt(wd, lang, true)}` : undefined} />
            <Tile label={R.tiles.after} value={amt(r.after, lang)} unit={r.after != null ? U : undefined} sub={e.net_reserves == null ? R.noRes : undefined} subClass={r.after != null && r.after < 0 ? 'down' : undefined} />
            <Tile label={R.tiles.cover} value={pct(r.cover, lang, 0)} sub={e.net_reserves != null && e.net_reserves <= 0 ? R.notMeaningful : undefined} subClass={(r.cover ?? 0) >= 100 ? 'down' : undefined} />
            <Tile label={R.tiles.months} value={num(r.months, lang, 1)} sub={R.tiles.monthsSub} />
          </div>
        )}

        <div>
          <p className="gn-kicker">{R.quartersH}</p>
          <Bars tone="money" rows={e.rows.map((x, k) => ({ label: qLabel(k), value: x.share, text: x.share == null ? '–' : `${pct(x.share, lang, 1, true)} · ${amt((x.share / 100) * e.stock, lang, true)}` }))} />
        </div>
        <p className="gn-small"><Link href={`/${lang}/c/${eco}`}>{names[eco] ?? eco} · {lang === 'ko' ? '국가 시트' : 'country sheet'} →</Link></p>
        <Cite items={[...money(['bis.lbs', 'bis.dss', 'imf.irfcl'], qOne(q, lang)), comtrade(w12(e.imports_window_to ?? shown, lang))]}>{U}. {L.calc}.</Cite>
      </Panel>

      <Panel tone="money" title={R.allH} period={mode === 'past' ? qLabel(qi) : `${R.controls.custom} ${pct(custom, lang, 1, true)}`}>
        <p className="gn-small gn-muted">{R.allLede}</p>
        <div className="gn-scroll">
          <table className="gn-table">
            <thead><tr><th>{R.cols.eco}</th><th className="num">{R.cols.share}</th><th className="num">{R.cols.withdrawal}</th><th className="num">{R.cols.cover}</th><th className="num">{R.cols.months}</th></tr></thead>
            <tbody>
              {all.map((x) => (
                <tr key={x.c} style={x.c === eco ? { fontWeight: 600 } : undefined}>
                  <td><button type="button" className="gn-linkbtn" onClick={() => pickEco(x.c)}>{names[x.c] ?? x.c}</button></td>
                  <td className="num">{pct(x.s, lang, 1, true)}</td>
                  <td className="num">{x.out != null ? amt(x.out, lang) : '–'}</td>
                  <td className={`num${(x.cover ?? 0) >= 100 ? ' bad' : ''}`}>{pct(x.cover, lang, 0)}</td>
                  <td className="num">{num(x.months, lang, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Source>{U}. {L.calc}.</Source>
      </Panel>
    </>
  );
}
