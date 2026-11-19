'use client';
// One signal through time: its two single-side inputs on their own axes (money sea blue, left; trade tangerine, right),
// and below them the signal with its threshold and the quarters it fired. Shared cursor: hover or pin a quarter.
import type { StressRuleId } from '@/lib/types';

const W = 380, H = 214, ML = 40, MR = 40, T0 = 8, T1 = 104, B0 = 122, B1 = 188;

function ext(v: (number | null)[], extra: (number | null)[] = []): [number, number] | null {
  const a = [...v, ...extra].filter((x): x is number => x != null && Number.isFinite(x));
  if (!a.length) return null;
  let lo = Math.min(...a), hi = Math.max(...a);
  if (lo === hi) { lo -= 1; hi += 1; }
  const d = (hi - lo) * 0.08;
  return [lo - d, hi + d];
}
function ticks(lo: number, hi: number, n = 3): number[] {
  const raw = (hi - lo) / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => (hi - lo) / s <= n + 1) ?? mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(8));
  return out;
}
const short = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1)}k` : Math.abs(v) < 1 && v !== 0 ? v.toFixed(2) : String(+v.toFixed(1)));

export interface Bands { funding: string[]; fiscal: [string, string][]; events: { start: string; label: string }[] }

export function SigChart({ id, title, q, money, trade, sig, thr, dir, fired, bands, active, onHover, onPin, labels }: {
  id: StressRuleId; title: string; q: string[]; money: (number | null)[]; trade: (number | null)[]; sig: (number | null)[]; thr: number | null; dir: 'low' | 'high';
  fired: (boolean | null)[]; bands: Bands; active: number; onHover: (i: number | null) => void; onPin: (i: number) => void; labels: { money: string; trade: string; sig: string };
}) {
  const n = q.length;
  const x = (i: number) => ML + (n > 1 ? (i / (n - 1)) * (W - ML - MR) : 0);
  const em = ext(money), et = ext(trade), es = ext(sig, thr != null ? [thr] : []);
  const ym = (v: number) => (em ? T0 + (1 - (v - em[0]) / (em[1] - em[0])) * (T1 - T0) : 0);
  const yt = (v: number) => (et ? T0 + (1 - (v - et[0]) / (et[1] - et[0])) * (T1 - T0) : 0);
  const ys = (v: number) => (es ? B0 + (1 - (v - es[0]) / (es[1] - es[0])) * (B1 - B0) : 0);
  const path = (s: (number | null)[], y: (v: number) => number) => {
    let d = '', pen = false;
    s.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `; pen = true; });
    return d.trim();
  };
  const qi = (iso: string) => { const i = q.findIndex((v) => v >= iso); return i < 0 ? n - 1 : i; };
  const years: { i: number; y: string }[] = [];
  let last = '';
  q.forEach((v, i) => { const y = v.slice(0, 4); if (y !== last && Number(y) % 4 === 0 && v.slice(5, 7) === '03') { years.push({ i, y }); } last = y; });
  const pick = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * W;
    return Math.max(0, Math.min(n - 1, Math.round(((px - ML) / (W - ML - MR)) * (n - 1))));
  };
  const a = active;
  const fmtA = (v: number | null) => (v == null ? '–' : short(v));
  return (
    <figure className="st-chart">
      <figcaption className="st-chart__head"><b>{id.toUpperCase()}</b> {title}
        <span className="st-chart__read gn-mono">
          <span className="st-m">{fmtA(money[a])}</span> · <span className="st-t">{fmtA(trade[a])}</span> → <b className={fired[a] ? 'st-on' : ''}>{fmtA(sig[a])}</b>
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${id.toUpperCase()} ${title}`}
        onPointerMove={(ev) => onHover(pick(ev.clientX, ev.currentTarget))} onPointerLeave={() => onHover(null)} onClick={(ev) => onPin(pick(ev.clientX, ev.currentTarget))}>
        {bands.fiscal.map(([s, e], k) => { const a0 = x(qi(s)), a1 = x(qi(e)); return <rect key={`f${k}`} x={Math.min(a0, a1)} y={T0} width={Math.max(2, Math.abs(a1 - a0))} height={B1 - T0} className="st-band--fiscal" />; })}
        {bands.funding.map((s, k) => { const i = q.indexOf(s); if (i < 0) return null; return <rect key={`e${k}`} x={x(Math.max(0, i - 4))} y={T0} width={x(i) - x(Math.max(0, i - 4)) + 2} height={B1 - T0} className="gn-episode" />; })}
        {/* top: the two single-side inputs */}
        {em && ticks(em[0], em[1]).map((v) => (<text key={`m${v}`} x={ML - 4} y={ym(v) + 3} textAnchor="end" className="gn-tick st-m">{short(v)}</text>))}
        {et && ticks(et[0], et[1]).map((v) => (<text key={`t${v}`} x={W - MR + 4} y={yt(v) + 3} className="gn-tick st-t">{short(v)}</text>))}
        <line x1={ML} x2={W - MR} y1={T1} y2={T1} className="gn-grid" />
        {em && <path d={path(money, ym)} className="gn-line-money" />}
        {et && <path d={path(trade, yt)} className="gn-line-trade" />}
        {/* bottom: the signal */}
        {es && ticks(es[0], es[1], 2).map((v) => (<g key={`s${v}`}><line x1={ML} x2={W - MR} y1={ys(v)} y2={ys(v)} className="gn-grid" /><text x={ML - 4} y={ys(v) + 3} textAnchor="end" className="gn-tick">{short(v)}</text></g>))}
        {es && thr != null && <line x1={ML} x2={W - MR} y1={ys(thr)} y2={ys(thr)} className="st-thr" />}
        {es && <path d={path(sig, ys)} className="st-sig" />}
        {es && sig.map((v, i) => (v != null && fired[i] ? <circle key={i} cx={x(i)} cy={ys(v)} r={2.4} className="st-fire" /> : null))}
        {bands.events.map((ev, k) => { const i = qi(ev.start); const cx = x(i); return <path key={`d${k}`} d={`M${cx},${B1 + 4} l4,5 l-4,5 l-4,-5 z`} className="st-event"><title>{ev.label}</title></path>; })}
        {years.map((l) => (<text key={l.i} x={x(l.i)} y={H - 2} textAnchor="middle" className="gn-tick">{l.y}</text>))}
        <line x1={x(a)} x2={x(a)} y1={T0} y2={B1} className="st-cursor" />
        <text x={ML} y={B0 - 5} className="gn-chart-label st-lbl">{labels.sig}{thr != null ? ` (${dir === 'low' ? '≤' : '≥'} ${thr})` : ''}</text>
      </svg>
      <p className="st-chart__key gn-small"><span className="st-key st-key--m" />{labels.money} <span className="st-key st-key--t" />{labels.trade}</p>
    </figure>
  );
}
