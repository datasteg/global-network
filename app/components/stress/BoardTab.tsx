'use client';
// The Board tab: 36 rows at one quarter (bq), the count at the current thresholds, V and F (money lane), the seven
// signals as a heatmap (joint lane), channel first, the partial flag. Sort, filter by group or region, follow one.
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Lang, StressGrid, StressRule, StressRuleId } from '@/lib/types';
import { stress } from '@/lib/strings/stress';
import { rich } from '@/lib/rich';
import { Sparkline } from '@/components/charts';
import { GL, countAt, fires, fmtVal, heat, readSel, replaceQuery, withParams } from './model';

export interface BoardRow { code: string; name: string; adv: boolean; euro: boolean; region: string; g: StressGrid; trail: (number | null)[] }

export function BoardTab({ lang, rules, K, range, quarters, bq, rows, regions }: { lang: Lang; rules: StressRule[]; K: number; range: [number, number]; quarters: string[]; bq: number; rows: BoardRow[]; regions: { id: string; label: string }[] }) {
  const S = stress(lang);
  const sp = useSearchParams();
  const router = useRouter();
  const sel = readSel(sp, rules, K, range);
  const sort = sp.get('sort') ?? 'count';
  const bg = sp.get('bg') ?? '', br = sp.get('br') ?? '', bf = sp.get('bf') ?? '';
  const desc = !sort.startsWith('+');
  const key = sort.replace(/^[+-]/, '');
  // the board's rows hold one quarter (index 0 = bq)
  const data = rows.map((r) => {
    const at = countAt(rules, r.g, 0, sel);
    return { ...r, at, v: r.g.v[0] as number | null, f: r.g.f[0] as number | null };
  }).filter((r) => (bg === 'adv' ? r.adv : bg === 'em' ? !r.adv : bg === 'euro' ? r.euro : true) && (!br || r.region === br));
  const val = (r: (typeof data)[number]): number => {
    if (key === 'count') return r.at.n * 1000 + (r.v ?? 0);
    if (key === 'v') return r.v ?? -1e9;
    if (key === 'f') return r.f == null ? -1e9 : -r.f;
    if (key === 'eco') return 0;
    const rule = rules.find((x) => x.id === key);
    const l = r.g[`${key}l`]?.[0] as number | null;
    return l == null ? -1e9 : rule ? l : 0;
  };
  data.sort((a, z) => (a.code === bf ? -1 : z.code === bf ? 1 : key === 'eco' ? a.name.localeCompare(z.name) * (desc ? -1 : 1) : (val(z) - val(a)) * (desc ? 1 : -1)));
  const setSort = (k: string) => replaceQuery(withParams(sp, { sort: k === key ? (desc ? `+${k}` : null) : k === 'count' ? null : k }));
  const th = (k: string, label: React.ReactNode, cls = 'num') => (
    <th className={cls} aria-sort={key === k ? (desc ? 'descending' : 'ascending') : undefined}><button type="button" className="st-sort" onClick={() => setSort(k)}>{label}{key === k ? (desc ? ' ↓' : ' ↑') : ''}</button></th>
  );
  const qL = (iso: string) => { const y = iso.slice(0, 4), q = Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1; return lang === 'ko' ? `${y}년 ${q}분기` : `Q${q} ${y}`; };
  const href = (code: string) => `/${lang}/stress${withParams(sp, { tab: null, e: code === 'KOR' ? null : code, sort: null, bg: null, br: null, bf: null, bq: null })}`;
  return (
    <section className="gn-panel">
      <div className="gn-panel__head"><h2>{S.board.title(qL(quarters[bq]))}</h2>
        <label className="st-ctl"><span className="gn-small gn-muted">{S.bar.quarter}</span>
          <select className="gn-input st-select" value={quarters[bq]} onChange={(ev) => router.push(`/${lang}/stress${withParams(sp, { bq: ev.target.value === quarters[quarters.length - 1] ? null : ev.target.value })}`, { scroll: false })}>
            {[...quarters].reverse().map((q) => (<option key={q} value={q}>{qL(q)}</option>))}
          </select>
        </label>
      </div>
      <p className="gn-small gn-muted">{S.board.lede}</p>
      <div className="st-filters">
        <div className="gn-seg" role="group">
          {(['', 'adv', 'em', 'euro'] as const).map((k) => (<button key={k} type="button" aria-pressed={bg === k} onClick={() => replaceQuery(withParams(sp, { bg: k || null }))}>{k ? S.board.groups[k] : S.board.all}</button>))}
        </div>
        <select className="gn-input st-select" value={br} onChange={(ev) => replaceQuery(withParams(sp, { br: ev.target.value || null }))} aria-label={S.board.regions}>
          <option value="">{S.board.regions}: {S.board.all}</option>
          {regions.map((r) => (<option key={r.id} value={r.id}>{r.label}</option>))}
        </select>
        <select className="gn-input st-select" value={bf} onChange={(ev) => replaceQuery(withParams(sp, { bf: ev.target.value || null }))} aria-label={S.board.follow}>
          <option value="">{S.board.follow}: –</option>
          {[...rows].sort((a, z) => a.name.localeCompare(z.name)).map((r) => (<option key={r.code} value={r.code}>{r.name}</option>))}
        </select>
      </div>
      <div className="gn-scroll st-boardwrap">
        <table className="gn-table st-board">
          <thead>
            <tr className="st-lanes"><th /><th /><th colSpan={2} className="st-lane--m">{S.board.lanes.money}</th><th colSpan={7} className="st-lane--j">{S.board.lanes.joint}</th><th colSpan={2} /></tr>
            <tr>
              {th('eco', S.board.cols.eco, '')}
              {th('count', rich(`[[stress_count|${S.board.cols.count}]]`))}
              {th('v', rich(`[[v|${S.board.cols.v}]]`))}
              {th('f', rich(`[[f|${S.board.cols.f}]]`))}
              {rules.map((r) => th(r.id, <span title={S.rules[r.id].short}>{r.id.toUpperCase()}</span>))}
              <th>{rich(`[[channel_first|${S.board.cols.ch}]]`)}</th><th>{S.board.cols.trail}</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && <tr><td colSpan={13} className="gn-muted">{S.board.noRow}</td></tr>}
            {data.map((r) => {
              const lead = r.at.fired.length ? r.at.fired.reduce((b, x) => (((r.g[`${x}l`]?.[0] as number) ?? 0) > ((r.g[`${b}l`]?.[0] as number) ?? 0) ? x : b)) : (r.g.lead[0] as StressRuleId | null);
              const ch = lead ? (['j2', 'j3'].includes(lead) ? 'funding' : ['j4', 'j6', 'j7'].includes(lead) ? 'trade' : 'both') : null;
              return (
                <tr key={r.code} className={r.code === bf ? 'is-follow' : ''}>
                  <td><Link href={href(r.code)}>{r.name}</Link>{r.g.lag[0] ? <span className="gn-small gn-muted" title={S.board.partial}> ◐</span> : null}</td>
                  <td className={`num st-cnt${r.at.n >= sel.k ? ' st-on' : ''}`}>{r.at.n}<span className="gn-muted gn-small">/{r.at.scored}</span></td>
                  <td className={`num${r.v != null && r.v >= 60 ? ' bad' : ''}`}>{r.v == null ? '–' : Math.round(r.v)}</td>
                  <td className={`num${r.f != null && r.f < 0 ? ' bad' : ''}`}>{r.f == null ? '–' : r.f.toFixed(1)}</td>
                  {rules.map((ru) => {
                    const f = sel.off.has(ru.id) ? null : fires(ru, r.g, 0, sel);
                    return <td key={ru.id} className={`num st-cell ${heat(r.g[`${ru.id}l`]?.[0] as number | null)}${f ? ' is-on' : ''}${sel.off.has(ru.id) ? ' is-off' : ''}`} title={`${ru.id.toUpperCase()} ${S.rules[ru.id].short}`}>{fmtVal(ru.id, r.g[ru.id][0] as number | null, lang)}</td>;
                  })}
                  <td className="gn-small">{ch ? S.channelShort[ch] : '–'}{lead ? <span className="gn-muted"> · {lead.toUpperCase()}</span> : null}</td>
                  <td className="st-trail"><Sparkline pts={r.trail} tone="ctx" w={80} h={20} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="gn-small gn-muted">{rules.map((r) => <span key={r.id} className="st-legend">{rich(`[[${GL[r.id]}|${r.id.toUpperCase()} ${S.rules[r.id].short}]]`)}</span>)}</p>
    </section>
  );
}
