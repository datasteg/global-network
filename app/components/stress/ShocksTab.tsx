'use client';
// Past shocks, funding set: the count in the quarters before each money-flow episode, recomputed at the thresholds and K
// set in the toolbar. The fiscal and trade sets are fixed at the default thresholds and drawn by the page.
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { Lang, StressGrid, StressRule } from '@/lib/types';
import { stress } from '@/lib/strings/stress';
import { countAt, readSel, withParams } from './model';

export interface EpisodeRows { id: string; label: string; q: string; pre: string[]; rows: { eco: string; name: string; g: StressGrid | null }[] }

export function FundingShocks({ lang, rules, K, range, pre, episodes }: { lang: Lang; rules: StressRule[]; K: number; range: [number, number]; pre: number; episodes: EpisodeRows[] }) {
  const S = stress(lang);
  const sp = useSearchParams();
  const sel = readSel(sp, rules, K, range);
  const qL = (iso: string) => { const y = iso.slice(0, 4), q = Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1; return lang === 'ko' ? `${y}년 ${q}분기` : `Q${q} ${y}`; };
  let hits = 0, n = 0;
  const blocks = episodes.map((ep) => {
    const rows = ep.rows.map((r) => {
      const cs = ep.pre.map((_, i) => (r.g && r.g.cnt[i] != null ? countAt(rules, r.g, i, sel) : null));
      const got = cs.filter((c): c is NonNullable<typeof c> => !!c);
      const max = got.length ? Math.max(...got.map((c) => c.n)) : null;
      if (max != null) { n++; if (max >= sel.k) hits++; }
      return { ...r, cs, max };
    });
    return { ep, rows };
  });
  return (
    <section className="gn-panel">
      <p className="gn-small gn-muted">{S.shocks.fundingLede(pre, sel.k)}</p>
      <p><b>{S.shocks.sum(hits, n, sel.k)}</b></p>
      <div className="st-eps">
        {blocks.map(({ ep, rows }) => (
          <div key={ep.id} className="st-ep">
            <h3>{ep.label} <span className="gn-period">{qL(ep.q)}</span></h3>
            <div className="gn-scroll"><table className="gn-table">
              <thead><tr><th>{S.shocks.cols.eco}</th>{ep.pre.map((q, i) => (<th key={q} className="num gn-small" title={qL(q)}>t−{ep.pre.length - i}</th>))}<th>{S.shocks.cols.res}</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.eco}>
                  <td><Link href={`/${lang}/stress${withParams(sp, { tab: null, set: null, e: r.eco === 'KOR' ? null : r.eco, y: ep.pre[ep.pre.length - 1] })}`}>{r.name}</Link></td>
                  {r.cs.map((c, i) => (<td key={i} className={`num${c && c.n >= sel.k ? ' st-on' : ''}`} title={c ? c.fired.map((x) => x.toUpperCase()).join(' ') : ''}>{c ? c.n : '–'}</td>))}
                  <td>{r.max == null ? <span className="gn-muted">{S.shocks.none}</span> : r.max >= sel.k ? <span className="st-on">● {S.shocks.hit}</span> : <span className="gn-muted">○ {S.shocks.miss}</span>}</td>
                </tr>
              ))}</tbody>
            </table></div>
            <p className="gn-small gn-muted">t−{ep.pre.length} = {qL(ep.pre[0])} … t−1 = {qL(ep.pre[ep.pre.length - 1])}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
