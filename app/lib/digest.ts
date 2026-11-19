// The digest at this build as data and as plain sentences, built from meta, pulse, board and changes. The digest page renders
// the data; the RSS feed (app/feed/route.ts) carries the sentences. Both are regenerated at every build of the data.
import { plain } from './rich';
import { readBoard, readChanges, readMeta, readPulse } from './data';
import { bn, day, josa, month, num, pct, quarter, tn } from './format';
import { name } from './names';
import { digest as D } from './strings/digest';
import type { Change, Lang } from './types';

export interface Watch { code: string; v: number | null; f: number | null }
export interface Digest {
  lang: Lang; built: string; q: string; shown: number; pulseDay: string;
  title: string; dated: string; headline: string; pulse: string[]; world: string;
  changes: Change[]; atRisk: Watch[]; topV: Watch[]; periods: string; regen: string;
}

function last<T>(a: (T | null)[]): T | null { for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return a[i]; return null; }

export function buildDigest(lang: Lang): Digest {
  const S = D(lang);
  const meta = readMeta();
  const pulse = readPulse();
  const board = readBoard();
  const changes = readChanges();
  const q = meta.money.quarter;
  const shown = meta.trade.shown;
  const top = meta.top_withdrawals[0];
  const pm = pulse.money;
  const wm = pulse.world_mom[pulse.world_mom.length - 1];
  const w12 = pulse.world_w12[pulse.world_w12.length - 1];
  const pulseLines: string[] = [];
  if (pm.dollar_index.latest) pulseLines.push(S.pulse.dollar(num(pm.dollar_index.latest[1], lang, 1), pct(pm.dollar_index.chg, lang, 1, true), day(pm.dollar_index.latest[0], lang)));
  if (pm.swap_lines.latest) pulseLines.push(S.pulse.swap(bn(pm.swap_lines.latest[1], lang), bn(pm.swap_lines.chg, lang, true), day(pm.swap_lines.latest[0], lang)));
  if (pm.custody_treasuries.latest) pulseLines.push(S.pulse.custody(bn(pm.custody_treasuries.latest[1], lang), bn(pm.custody_treasuries.chg, lang, true), day(pm.custody_treasuries.latest[0], lang)));
  const ticLast = pm.tic.official[pm.tic.official.length - 1];
  if (ticLast) pulseLines.push(S.pulse.tic(bn(ticLast[1], lang, true), month(Number(ticLast[0].slice(0, 7).replace('-', '')), lang)));

  const rows: Watch[] = meta.economies.map((e) => ({ code: e.code, v: last(board[e.code].v), f: last(board[e.code].flow) }));
  const atRisk = rows.filter((r) => r.v != null && r.f != null && r.v >= 60 && r.f < 0).sort((a, z) => (z.v ?? 0) - (a.v ?? 0));
  const topV = [...rows].sort((a, z) => (z.v ?? -1) - (a.v ?? -1)).slice(0, 5);
  // joint items first (the two feeds in one economy or chain), then the parents' own, divergences left to the changes page
  const items = changes.items.filter((c) => c.kind !== 'divergence').sort((a, z) => (a.side === 'both' ? 0 : 1) - (z.side === 'both' ? 0 : 1));

  return {
    lang, built: meta.built, q, shown, pulseDay: meta.money.pulse_day,
    title: S.title(quarter(q, lang), month(shown, lang)),
    dated: S.dated(day(meta.built, lang)),
    headline: S.headline(meta.n_out, meta.economies.length, quarter(q, lang), name(top[0], lang), bn(Math.abs(top[1]), lang)),
    pulse: pulseLines,
    world: S.world(month(wm[0], lang), tn(w12[1] * 1000, lang), pct(wm[1], lang, 1, true), pct(100 * wm[2], lang, 0)),
    changes: items, atRisk, topV,
    periods: S.periods(quarter(q, lang), month(shown, lang), day(meta.money.pulse_day, lang), meta.money.release, meta.surfaces.money.method),
    regen: S.regen,
  };
}

/** One change item as a plain sentence (the ChangeLine component is the rendered form). */
export function changeText(c: Change, lang: Lang): string {
  const ko = lang === 'ko';
  const eco = c.eco ? name(c.eco, lang) : '';
  const when = c.q ? quarter(c.q, lang) : c.t ? month(c.t, lang) : '';
  const n0 = (v: number | null | undefined, d = 0, s = false) => num(v, lang, d, s);
  let text: string;
  switch (c.kind) {
    case 'at_risk_in': text = ko ? `${eco}가 위험 사분면에 들어왔습니다. V는 ${n0(c.v![0])}에서 ${n0(c.v![1])}로, F는 ${n0(c.flow![0], 1, true)}에서 ${n0(c.flow![1], 1, true)}로 변했습니다.` : `${eco} entered the at-risk quadrant: V ${n0(c.v![0])} to ${n0(c.v![1])}, F ${n0(c.flow![0], 1, true)} to ${n0(c.flow![1], 1, true)}.`; break;
    case 'at_risk_out': text = ko ? `${eco}가 위험 사분면을 벗어났습니다. V ${n0(c.v![1])}, F ${n0(c.flow![1], 1, true)}.` : `${eco} left the at-risk quadrant: V ${n0(c.v![1])}, F ${n0(c.flow![1], 1, true)}.`; break;
    case 'flow_sign': text = ko ? `${eco}의 자금이 ${c.flow![1] < 0 ? '유출로' : '유입으로'} 돌아섰습니다. F ${n0(c.flow![0], 1, true)}에서 ${n0(c.flow![1], 1, true)}.` : `${eco}: funding turned ${c.flow![1] < 0 ? 'to withdrawal' : 'to inflow'}, F ${n0(c.flow![0], 1, true)} to ${n0(c.flow![1], 1, true)}.`; break;
    case 'a2_100': text = ko ? (c.a2![1] >= 100 ? `외국 은행이 ${eco}에 대해 보유한 단기 청구권이 순외환보유액보다 커졌습니다. A2 ${n0(c.a2![0])}에서 ${n0(c.a2![1])}.` : `외국 은행이 ${eco}에 대해 보유한 단기 청구권이 순외환보유액보다 작아졌습니다. A2 ${n0(c.a2![0])}에서 ${n0(c.a2![1])}.`) : `${eco}: short-term bank claims ${c.a2![1] >= 100 ? 'rose above' : 'fell below'} net reserves, A2 ${n0(c.a2![0])} to ${n0(c.a2![1])}.`; break;
    case 'v_jump': text = ko ? `${eco}의 V가 ${n0(c.v![0])}에서 ${josa(n0(c.v![1]), '으로')} 움직였습니다.` : `${eco}: V moved from ${n0(c.v![0])} to ${n0(c.v![1])}.`; break;
    case 'export_sign': text = ko ? `${eco}의 12개월 수출이 1년 전보다 ${c.mom![1] < 0 ? '줄기' : '늘기'} 시작했습니다. ${pct(c.mom![0], lang, 1, true)}에서 ${pct(c.mom![1], lang, 1, true)}.` : `${eco}: 12-month exports turned ${c.mom![1] < 0 ? 'down' : 'up'} on a year earlier, ${pct(c.mom![0], lang, 1, true)} to ${pct(c.mom![1], lang, 1, true)}.`; break;
    case 'divergence': text = ko ? `${eco}에서 ${josa(name(c.partner!, lang), '으로')} 가는 흐름의 두 보고가 평소보다 ${c.dir === 2 ? '높게' : '낮게'} 엇갈렸습니다.` : `${eco} to ${name(c.partner!, lang)}: the two reports of the flow diverge, ${c.dir === 2 ? 'above' : 'below'} their usual ratio.`; break;
    case 'funding_exports': text = ko ? `${eco}에서 자금이 유출로 돌아선 분기에 12개월 수출도 감소하기 시작했습니다. F는 ${n0(c.flow![0], 1, true)}에서 ${n0(c.flow![1], 1, true)}로, 수출은 ${pct(c.mom![0], lang, 1, true)}에서 ${pct(c.mom![1], lang, 1, true)}로 바뀌었습니다.` : `${eco}: funding turned to withdrawal while 12-month exports turned down, F ${n0(c.flow![0], 1, true)} to ${n0(c.flow![1], 1, true)}, exports ${pct(c.mom![0], lang, 1, true)} to ${pct(c.mom![1], lang, 1, true)}.`; break;
    case 'chokepoint_lender': { const cn = c.chain_name ? c.chain_name[lang] : c.chain; const to = (c.to_name ? c.to_name[lang] : c.to) ?? (ko ? '없음' : 'none');
      text = ko ? `${cn} 공급망의 병목이 ${to}로 옮겨 간 해(${c.year}년)에 그 단계 상위 수출국 ${eco}에서 자금이 유출됐습니다. F ${n0(c.flow![0], 1, true)}에서 ${n0(c.flow![1], 1, true)}.` : `${cn} chain: the chokepoint moved to ${to} (${c.year}) while funding left ${eco}, a top exporter of the stage, F ${n0(c.flow![0], 1, true)} to ${n0(c.flow![1], 1, true)}.`; break; }
    case 'chokepoint': { const cn = c.chain_name ? c.chain_name[lang] : c.chain; const f = (c.from_name ? c.from_name[lang] : c.from) ?? (ko ? '없음' : 'none'); const to = (c.to_name ? c.to_name[lang] : c.to) ?? (ko ? '없음' : 'none');
      text = ko ? `${cn} 공급망의 병목 단계가 ${f}에서 ${to}로 옮겨 갔습니다(${c.year}년).` : `${cn} chain: the chokepoint stage moved from ${f} to ${to} (${c.year}).`; break; }
    default: text = `${eco} ${c.kind}`;
  }
  return when ? `${when}. ${text}` : text;
}

/** The whole digest as plain sentences, for the feed. */
export function digestText(lang: Lang): string {
  const S = D(lang);
  const d = buildDigest(lang);
  const w = (r: Watch) => `${name(r.code, lang)} (${S.vf(num(r.v, lang, 0), num(r.f, lang, 1, true))})`;
  const parts = [
    d.dated, d.headline, ...d.pulse, d.world,
    d.changes.length ? S.changesLede(d.changes.length) : S.noChanges,
    ...d.changes.map((c) => changeText(c, lang)),
    d.atRisk.length ? `${S.atRisk}: ${d.atRisk.map(w).join(', ')}.` : S.noneAtRisk,
    `${S.topV}: ${d.topV.map(w).join(', ')}.`,
    d.periods, d.regen,
  ];
  return plain(parts.join(' '));
}
