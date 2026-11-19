'use client';
// The period selector: frequency (annual or quarterly), the current period with play and step, its speed, and jumps to the shock replays' start periods. Year ticks under the slider, quarter sub-ticks in quarterly mode.
import { earn } from '@/lib/strings/earn';
import type { Lang } from '@/lib/types';
import { Term } from '../Term';
import { periodLabel, type Frame, type Freq } from './model';

export function Period({ lang, f, k, onK, playing, onPlay, speed, onSpeed, freq, onFreq, canQ, presets, onPreset, reduced }: {
  lang: Lang; f: Frame; k: number; onK: (k: number) => void; playing: boolean; onPlay: () => void; speed: number; onSpeed: (v: number) => void;
  freq: Freq; onFreq: (f: Freq) => void; canQ: boolean;
  presets: { id: string; label: string; t: string | null }[]; onPreset: (t: string) => void; reduced: boolean;
}) {
  const S = earn(lang);
  const n = f.periods.length;
  const cur = f.periods[k];
  const step = (d: number) => onK(Math.max(0, Math.min(n - 1, k + d)));
  const ticks = f.periods.map((p, i) => {
    const q = p.length > 4;
    const major = !q || p.endsWith('Q1');
    const yr = Number(p.slice(0, 4));
    return { i, major, label: major && yr % 5 === 0 ? String(yr) : null };
  });
  return (
    <div className="gn-earn__period">
      <div className="gn-earn__controls">
        <span className="gn-seg" role="group" aria-label={S.freqLabel}>
          <button type="button" aria-pressed={freq === 'a'} onClick={() => onFreq('a')}>{S.freqs.a}</button>
          <button type="button" aria-pressed={freq === 'q'} disabled={!canQ} onClick={() => onFreq('q')}>{S.freqs.q}</button>
        </span>
        <span className="gn-earn__year" aria-live="polite">{periodLabel(cur, lang)}</span>
        {!reduced && <button type="button" className="gn-btn gn-btn--sm gn-btn--primary" onClick={onPlay} aria-pressed={playing}>{playing ? S.pause : S.play}</button>}
        <label className="gn-earn__opt">{S.speed}
          <select className="gn-select" value={speed} onChange={(e) => onSpeed(Number(e.target.value))}>
            {[0.5, 1, 2, 4].map((v) => (<option key={v} value={v}>{v}×</option>))}
          </select>
        </label>
      </div>
      <div className="gn-earn__scrub">
        <button type="button" className="gn-btn gn-btn--sm" onClick={() => step(-1)} disabled={k === 0} aria-label={S.prev}>‹</button>
        <span className="gn-earn__track">
          <input className="gn-earn__slider" type="range" min={0} max={n - 1} step={1} value={k} aria-label={S.year}
            aria-valuetext={periodLabel(cur, lang)} onChange={(e) => onK(Number(e.target.value))} />
          <span className="gn-earn__ticks" aria-hidden="true">
            {ticks.map((t) => (<span key={t.i} className={t.major ? 'is-major' : ''} style={{ left: `${(100 * t.i) / Math.max(1, n - 1)}%` }}>{t.label && <b>{t.label}</b>}</span>))}
          </span>
        </span>
        <button type="button" className="gn-btn gn-btn--sm" onClick={() => step(1)} disabled={k === n - 1} aria-label={S.next}>›</button>
      </div>
      <div className="gn-earn__controls gn-earn__controls--sub">
        {presets.length > 0 && (<span className="gn-earn__opt">{S.presets}
          {presets.map((p) => (<button key={p.id} type="button" className="gn-btn gn-btn--sm" disabled={!p.t} onClick={() => p.t && onPreset(p.t)}>{p.label}</button>))}
        </span>)}
        {freq === 'q' && <span className="gn-small gn-muted"><Term id="rolling4q">{lang === 'ko' ? '4분기 누적' : '4-quarter sums'}</Term></span>}
      </div>
    </div>
  );
}
