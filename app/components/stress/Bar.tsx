'use client';
// The stress page's sticky toolbar: the five tabs, the economy (One economy tab), K, the thresholds and switches, reset
// and copy link. State is the URL (model.ts).
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { Lang, StressRule } from '@/lib/types';
import { stress } from '@/lib/strings/stress';
import { RULE_IDS, TABS, isChanged, readSel, replaceQuery, withParams, type Tab } from './model';

export function StressBar({ lang, rules, K, range, tab, e, econs }: { lang: Lang; rules: StressRule[]; K: number; range: [number, number]; tab: Tab; e: string; econs: { code: string; name: string }[] }) {
  const S = stress(lang);
  const sp = useSearchParams();
  const router = useRouter();
  const sel = readSel(sp, rules, K, range);
  const [copied, setCopied] = useState(false);
  const base = `/${lang}/stress`;
  const ks = Array.from({ length: range[1] - range[0] + 1 }, (_, i) => range[0] + i);
  const setK = (k: number) => replaceQuery(withParams(sp, { k: k === K ? null : k }));
  const setThr = (r: StressRule, v: number) => replaceQuery(withParams(sp, { [r.id]: v === r.threshold ? null : v }));
  const toggle = (r: StressRule) => {
    const off = new Set(sel.off);
    if (off.has(r.id)) off.delete(r.id); else off.add(r.id);
    replaceQuery(withParams(sp, { off: [...off].sort().join(',') || null }));
  };
  const reset = () => replaceQuery(withParams(sp, Object.fromEntries([['k', null], ['off', null], ...RULE_IDS.map((r) => [r, null])])));
  const copy = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };
  const changed = isChanged(sel, rules, K);
  return (
    <div className="st-bar" role="toolbar" aria-label={S.kicker}>
      <nav className="st-tabs" aria-label={S.kicker}>
        {TABS.map((t) => (
          <Link key={t} href={`${base}${withParams(sp, { tab: t === 'one' ? null : t })}`} aria-current={t === tab ? 'page' : undefined} scroll={false}>{S.tabs[t]}</Link>
        ))}
      </nav>
      <div className="st-bar__ctl">
        {tab === 'one' && (
          <label className="st-ctl">
            <span className="gn-small gn-muted">{S.bar.economy}</span>
            <select className="gn-input st-select" value={e} onChange={(ev) => router.push(`${base}${withParams(sp, { e: ev.target.value === 'KOR' ? null : ev.target.value, y: null })}`, { scroll: false })}>
              {econs.map((c) => (<option key={c.code} value={c.code}>{c.name}</option>))}
            </select>
          </label>
        )}
        <div className="st-ctl" role="group" aria-label={S.bar.k}>
          <span className="gn-small gn-muted">{S.bar.k}</span>
          <div className="gn-seg st-kseg">
            {ks.map((k) => (<button key={k} type="button" aria-pressed={k === sel.k} onClick={() => setK(k)}>{k}</button>))}
          </div>
        </div>
        <details className="st-rules">
          <summary className="gn-btn gn-btn--sm">{S.bar.rules}{changed && <span className="st-dot" aria-hidden="true" />}</summary>
          <div className="st-rules__pop">
            {rules.map((r) => {
              const on = !sel.off.has(r.id);
              const t = sel.thr[r.id];
              return (
                <div key={r.id} className={`st-rule${on ? '' : ' is-off'}`}>
                  <div className="st-rule__head">
                    <label className="st-switch"><input type="checkbox" checked={on} onChange={() => toggle(r)} aria-label={`${r.id.toUpperCase()} ${on ? S.bar.on : S.bar.off}`} /><span /></label>
                    <span><b>{r.id.toUpperCase()}</b> {S.rules[r.id].short}</span>
                    <span className="gn-mono gn-small">{t == null ? S.method.thrFrom.definition : `${r.dir === 'low' ? '≤' : '≥'} ${t}`}</span>
                  </div>
                  {r.slider && t != null && (
                    <div className="st-rule__row">
                      <input className="gn-range" type="range" min={r.slider[0]} max={r.slider[1]} step={r.slider[2]} value={t} disabled={!on}
                        onChange={(ev) => setThr(r, Number(ev.target.value))} aria-label={`${r.id.toUpperCase()} ${S.table.thr}`} />
                      <button type="button" className="gn-btn gn-btn--sm st-def" disabled={t === r.threshold} onClick={() => setThr(r, r.threshold as number)}>{S.bar.defaultT} {r.threshold}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </details>
        <button type="button" className="gn-btn gn-btn--sm" onClick={reset} disabled={!changed}>{S.bar.reset}</button>
        <button type="button" className="gn-btn gn-btn--sm" onClick={copy} aria-live="polite">{copied ? S.bar.copied : S.bar.copy}</button>
      </div>
    </div>
  );
}
