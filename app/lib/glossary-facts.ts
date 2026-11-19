// The numbers the glossary's examples quote, read from this build's data on the server (layout) so that a popover's
// "how to read it" always names a value the reader can find on the page. Nothing here is computed anew.
import { readBoard, readChains, readEarn, readMeta, readPulse, readStress, readValidation } from './data';
import type { Quadrant } from './types';

export interface Facts {
  year: number; y0: number; band: number; read: string;
  q0: string; q: string; shown: number; tradeBuilt: string; pulseDay: string; ticMonth: string;
  n: number; vintages: Record<string, string>;
  /** money-flow's method version, read from the release this build read (never a literal) */
  method: string;
  earn: Record<string, { gs: number | null; pi: number | null; pc: number | null; niip: number | null; xg: number | null; mg: number | null; xu: number | null; mu: number | null; fa: number | null; fl: number | null; fag: number | null; flg: number | null; q: Quadrant | null }>;
  panel: Record<string, { hm: number | null; x_share: number | null; a1: number | null; px: [string, number | null] | null; pt: number | null }>;
  board: Record<string, { v: number | null; f: number | null; a2: number | null; a3: number | null; res_net: number | null; ca: number | null; b1: number | null; b2: number | null }>;
  atRisk: string[]; top: [string, number, number, number];
  dollar: [string, number] | null; swap: [string, number] | null; custody: [string, number] | null; tic: [string, number] | null;
  worldMom: [number, number | null, number, number];
  choke: { chain: { en: string; ko: string }; stage: { en: string; ko: string }; eco: string; share: number; hhi: number; year: number } | null;
  aurocV: number | null;
  stress: { q: string; kor: Record<string, number | null>; thr: Record<string, number | null>; count: number | null; aurocCount: number | null; aurocV: number | null; admitted: number } | null;
}

const PICK = ['KOR', 'JPN', 'DEU', 'USA', 'CHN', 'NOR', 'GBR', 'MEX', 'TUR', 'ARG', 'SAU', 'BEL'];

export function glossaryFacts(): Facts {
  const meta = readMeta(), earn = readEarn(), board = readBoard(), pulse = readPulse(), chains = readChains(), val = readValidation();
  const k = earn.years.length - 1;
  const e: Facts['earn'] = {}, panel: Facts['panel'] = {}, b: Facts['board'] = {};
  for (const c of PICK) {
    const x = earn.econ[c];
    if (x) e[c] = { gs: x.gs[k], pi: x.pi[k], pc: x.pc[k], niip: x.niip[k], xg: x.xg[k], mg: x.mg[k], xu: x.xu[k], mu: x.mu[k], fa: x.fa[k], fl: x.fl[k], fag: x.fag[k], flg: x.flg[k], q: x.q[k] };
    const p = earn.panel[c];
    if (p) panel[c] = { hm: p.hm, x_share: p.x_share, a1: p.a1, px: p.prod?.x[0] ? [p.prod.x[0].ch, p.prod.x[0].xs] : null, pt: p.prod?.t ?? null };
    const s = board[c];
    if (s) { const i = s.q.length - 1; b[c] = { v: s.v[i], f: s.flow[i], a2: s.a2[i], a3: s.a3[i], res_net: s.res_net_raw?.[i] ?? null, ca: s.ca[i], b1: s.b1[i], b2: s.b2[i] }; }
  }
  const atRisk = meta.economies.map((m) => m.code).filter((c) => { const s = board[c]; const i = s.q.length - 1; return s.v[i] != null && s.flow[i] != null && (s.v[i] as number) >= 60 && (s.flow[i] as number) < 0; });
  const cp = chains.chains.map((ch) => ({ ch, cp: ch.chokepoint })).filter((x) => x.cp && x.cp.top_exporters.length).sort((a, b2) => (b2.cp!.hhi - a.cp!.hhi))[0];
  const pm = pulse.money;
  const tic = pm.tic.official[pm.tic.official.length - 1];
  return {
    year: earn.years[k], y0: earn.years[0], band: earn.band, read: earn.read,
    q0: meta.money.quarters[0], q: meta.money.quarter, shown: meta.trade.shown, tradeBuilt: meta.trade.built.slice(0, 10), pulseDay: meta.money.pulse_day, ticMonth: pm.tic.latest,
    n: meta.economies.length, vintages: meta.money.vintages, method: meta.surfaces.money.method,
    earn: e, panel, board: b, atRisk, top: meta.top_withdrawals[0],
    dollar: pm.dollar_index.latest ?? null, swap: pm.swap_lines.latest ?? null, custody: pm.custody_treasuries.latest ?? null, tic: tic ? [tic[0], tic[1]] : null,
    worldMom: pulse.world_mom[pulse.world_mom.length - 1] as [number, number | null, number, number],
    choke: cp ? { chain: { en: cp.ch.en, ko: cp.ch.ko }, stage: { en: cp.cp!.en, ko: cp.cp!.ko }, eco: cp.cp!.top_exporters[0][0], share: cp.cp!.top_exporters[0][1], hhi: cp.cp!.hhi, year: cp.ch.year } : null,
    aurocV: val.indicators.find((i) => i.id === 'v')?.auroc ?? null,
    stress: (() => {
      const st = readStress();
      if (!st) return null;
      const g = st.grid.KOR;
      let i = st.quarters.length - 1;
      while (i > 0 && g.cnt[i] == null) i--;
      return { q: st.quarters[i], kor: Object.fromEntries(st.rules.map((r) => [r.id, g[r.id][i] as number | null])), thr: Object.fromEntries(st.rules.map((r) => [r.id, r.threshold])),
        count: g.cnt[i] as number | null, aurocCount: st.validation.funding.count.auroc, aurocV: st.validation.funding.count.v, admitted: st.validation.funding.admitted.length };
    })(),
  };
}
