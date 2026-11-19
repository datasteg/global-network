'use client';
// The filter panel: economies (searchable, chips), region, advanced or emerging, borrowers, top N by exports, GDP or
// external assets, a range on the active size measure, fade or hide, and "lock axes". A summary line with removable
// chips sits above it; on a phone the panel folds away under that line.
import { useState } from 'react';
import { bn, num } from '@/lib/format';
import { earn } from '@/lib/strings/earn';
import type { Lang } from '@/lib/types';
import { Term } from '../Term';
import { SIZE_KEY, filterActive, type Frame, type Region, type TopMetric, type ViewState } from './model';

const REGIONS: Region[] = ['apac', 'europe', 'euro', 'americas', 'mea'];

export function Filters({ lang, s, upd, codes, names, f, k, shown, locked, onLock }: {
  lang: Lang; s: ViewState; upd: (p: Partial<ViewState>) => void; codes: string[]; names: Record<string, string>; f: Frame; k: number;
  shown: number; locked: boolean; onLock: (on: boolean) => void;
}) {
  const S = earn(lang), F = S.flt;
  const [q, setQ] = useState('');
  const sorted = [...codes].sort((a, b) => (names[a] ?? a).localeCompare(names[b] ?? b, lang));
  const add = (text: string) => {
    const c = sorted.find((x) => (names[x] ?? x).toLowerCase() === text.trim().toLowerCase() || x === text.trim().toUpperCase());
    if (c && !s.countries.includes(c)) upd({ countries: [...s.countries, c] });
    setQ('');
  };
  const toggleRegion = (r: Region) => upd({ regions: s.regions.includes(r) ? s.regions.filter((x) => x !== r) : [...s.regions, r] });
  const sizeKey = SIZE_KEY[s.size];
  const vals = codes.map((c) => f.series(c, sizeKey)[k]).filter((v): v is number => v != null).sort((a, b) => a - b);
  const fmtSize = (v: number) => (s.size === 'pc' ? `$${num(v, lang, 0)}` : bn(v, lang));
  const lo = s.sizeRange ? vals.findIndex((v) => v >= s.sizeRange![0]) : 0;
  const hiI = s.sizeRange ? vals.length - 1 - [...vals].reverse().findIndex((v) => v <= s.sizeRange![1]) : vals.length - 1;
  const setRange = (a: number, b: number) => upd({ sizeRange: a <= 0 && b >= vals.length - 1 ? null : [vals[Math.max(0, a)], vals[Math.min(vals.length - 1, b)]] });

  const chips: { key: string; label: string; clear: () => void }[] = [
    ...s.countries.map((c) => ({ key: `c${c}`, label: names[c] ?? c, clear: () => upd({ countries: s.countries.filter((x) => x !== c) }) })),
    ...s.regions.map((r) => ({ key: `r${r}`, label: F.regions[r], clear: () => upd({ regions: s.regions.filter((x) => x !== r) }) })),
    ...(s.group ? [{ key: 'g', label: s.group === 'adv' ? F.adv : F.eme, clear: () => upd({ group: null }) }] : []),
    ...(s.borrower ? [{ key: 'b', label: s.borrower === 'yes' ? F.borrower : F.other, clear: () => upd({ borrower: null }) }] : []),
    ...(s.top ? [{ key: 't', label: F.topLabel(s.top.n, F.topMetrics[s.top.m]), clear: () => upd({ top: null }) }] : []),
    ...(s.sizeRange ? [{ key: 's', label: `${S.sizes[s.size]} ${fmtSize(s.sizeRange[0])}–${fmtSize(s.sizeRange[1])}`, clear: () => upd({ sizeRange: null }) }] : []),
  ];
  const active = filterActive(s);

  return (
    <details className="gn-earn__filters" open={undefined}>
      <summary>
        <span className="gn-earn__fsum">{F.title} · <b>{F.shown(shown, codes.length)}</b></span>
        {chips.map((c) => (<span key={c.key} className="gn-chip">{c.label}<button type="button" onClick={(e) => { e.preventDefault(); c.clear(); }} aria-label={`${F.remove}: ${c.label}`}>×</button></span>))}
        {active && <button type="button" className="gn-btn gn-btn--sm" onClick={(e) => { e.preventDefault(); upd({ countries: [], regions: [], group: null, borrower: null, top: null, sizeRange: null }); }}>{F.reset}</button>}
      </summary>
      <div className="gn-earn__fbody">
        <fieldset>
          <legend>{F.country}</legend>
          <span className="gn-earn__frow">
            <input className="gn-input" list="gn-earn-econs" value={q} placeholder={F.search} aria-label={F.search}
              onChange={(e) => { const v = e.target.value; setQ(v); if (sorted.some((x) => (names[x] ?? x) === v)) add(v); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(q); } }} />
            <datalist id="gn-earn-econs">{sorted.map((c) => (<option key={c} value={names[c] ?? c} />))}</datalist>
            <button type="button" className="gn-btn gn-btn--sm" onClick={() => upd({ countries: sorted })}>{F.all}</button>
            <button type="button" className="gn-btn gn-btn--sm" onClick={() => upd({ countries: [] })}>{F.clear}</button>
          </span>
        </fieldset>
        <fieldset>
          <legend><Term id="region">{F.region}</Term></legend>
          <span className="gn-earn__frow">{REGIONS.map((r) => (<button key={r} type="button" className={`gn-chip gn-chip--toggle${r === 'euro' ? ' gn-chip--sub' : ''}`} aria-pressed={s.regions.includes(r)} onClick={() => toggleRegion(r)}>{F.regions[r]}</button>))}</span>
        </fieldset>
        <fieldset>
          <legend><Term id="adv_eme">{F.group}</Term></legend>
          <span className="gn-earn__frow">
            <span className="gn-seg" role="group" aria-label={F.group}>
              <button type="button" aria-pressed={s.group === 'adv'} onClick={() => upd({ group: s.group === 'adv' ? null : 'adv' })}>{F.adv}</button>
              <button type="button" aria-pressed={s.group === 'eme'} onClick={() => upd({ group: s.group === 'eme' ? null : 'eme' })}>{F.eme}</button>
            </span>
            <span className="gn-seg" role="group" aria-label={F.borrower}>
              <button type="button" aria-pressed={s.borrower === 'yes'} onClick={() => upd({ borrower: s.borrower === 'yes' ? null : 'yes' })}>{F.borrower}</button>
              <button type="button" aria-pressed={s.borrower === 'no'} onClick={() => upd({ borrower: s.borrower === 'no' ? null : 'no' })}>{F.other}</button>
            </span>
          </span>
        </fieldset>
        <fieldset>
          <legend><Term id="topn">{F.top}</Term></legend>
          <span className="gn-earn__frow">
            <select className="gn-select" aria-label={F.top} value={s.top ? `${s.top.m}${s.top.n}` : ''}
              onChange={(e) => { const m = e.target.value.match(/^(exports|gdp|assets)(\d+)$/); upd({ top: m ? { m: m[1] as TopMetric, n: Number(m[2]) } : null }); }}>
              <option value="">{F.topNone}</option>
              {(['exports', 'gdp', 'assets'] as TopMetric[]).flatMap((m) => [10, 20].map((n) => (<option key={`${m}${n}`} value={`${m}${n}`}>{F.topLabel(n, F.topMetrics[m])}</option>)))}
            </select>
          </span>
        </fieldset>
        {vals.length > 1 && (
          <fieldset>
            <legend>{F.range(S.sizes[s.size])}</legend>
            <span className="gn-earn__frow gn-earn__range">
              <input type="range" min={0} max={vals.length - 1} value={Math.max(0, lo)} aria-label={`${F.range(S.sizes[s.size])} min`} onChange={(e) => setRange(Math.min(Number(e.target.value), hiI), hiI)} />
              <input type="range" min={0} max={vals.length - 1} value={Math.max(0, hiI)} aria-label={`${F.range(S.sizes[s.size])} max`} onChange={(e) => setRange(Math.max(0, lo), Math.max(Number(e.target.value), lo))} />
              <span className="gn-small">{fmtSize(vals[Math.max(0, lo)])} – {fmtSize(vals[Math.max(0, hiI)])}</span>
            </span>
          </fieldset>
        )}
        <fieldset>
          <legend>{F.mode}</legend>
          <span className="gn-earn__frow">
            <span className="gn-seg" role="group" aria-label={F.mode}>
              <button type="button" aria-pressed={!s.hide} onClick={() => upd({ hide: false })}>{F.fade}</button>
              <button type="button" aria-pressed={s.hide} onClick={() => upd({ hide: true })}>{F.hide}</button>
            </span>
            <label className="gn-earn__opt"><input type="checkbox" checked={locked} onChange={(e) => onLock(e.target.checked)} /> {F.lock}</label>
          </span>
        </fieldset>
      </div>
    </details>
  );
}
