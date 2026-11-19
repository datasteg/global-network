import Link from 'next/link';
import { siteUrl } from '@/lib/family';
import { josa, month, num, pct, quarter } from '@/lib/format';
import { name } from '@/lib/names';
import type { Change, Lang } from '@/lib/types';

/** One "what changed" item as a sentence with its period. Money kinds come from money-flow, trade kinds from trade-flow,
 * the joint kinds from this site's build; with `links` the line ends with the parent page the item points to. */
export function ChangeLine({ c, lang, links = false }: { c: Change; lang: Lang; links?: boolean }) {
  const ko = lang === 'ko';
  const when = c.q ? quarter(c.q, lang) : c.t ? month(c.t, lang) : c.year ? String(c.year) : '';
  const eco = c.eco ? <Link href={`/${lang}/c/${c.eco}`}>{name(c.eco, lang)}</Link> : null;
  const cn = c.chain_name ? c.chain_name[lang] : c.chain;
  const f = (c.from_name ? c.from_name[lang] : c.from) ?? (ko ? '없음' : 'none');
  const to = (c.to_name ? c.to_name[lang] : c.to) ?? (ko ? '없음' : 'none');
  let text: React.ReactNode = null;
  switch (c.kind) {
    case 'funding_exports': text = ko
      ? <>{eco}: 자금이 유출로 전환된 분기에 12개월 수출도 감소 전환. F {num(c.flow![0], lang, 1, true)} → {num(c.flow![1], lang, 1, true)}, 수출 {pct(c.mom![0], lang, 1, true)} → {pct(c.mom![1], lang, 1, true)} ({c.t ? month(c.t, lang) : ''})</>
      : <>{eco}: funding turned to withdrawal while 12-month exports turned down, F {num(c.flow![0], lang, 1, true)} → {num(c.flow![1], lang, 1, true)}, exports {pct(c.mom![0], lang, 1, true)} → {pct(c.mom![1], lang, 1, true)} ({c.t ? month(c.t, lang) : ''})</>; break;
    case 'chokepoint_lender': text = ko
      ? <>{cn}: 병목이 {f}에서 {josa(to, '으로')} 이동한 해({c.year})에 그 단계 상위 수출국인 {eco}(세계 수출의 {num(c.share, lang, 0)}%)에서 자금 유출. F {num(c.flow![0], lang, 1, true)} → {num(c.flow![1], lang, 1, true)}</>
      : <>{cn}: the chokepoint moved from {f} to {to} ({c.year}) while funding left {eco}, a top exporter of the stage ({num(c.share, lang, 0)}% of world exports), F {num(c.flow![0], lang, 1, true)} → {num(c.flow![1], lang, 1, true)}</>; break;
    case 'stress_count': {
      const up = (c.count?.[1] ?? 0) >= (c.K ?? 3);
      const fired = (c.fired ?? []).map((x) => x.toUpperCase()).join(' ');
      text = ko
        ? <>{eco}: 스트레스 신호 수가 {up ? `${c.K}개 이상으로 상승` : `${c.K}개 미만으로 하락`}. {c.count![0]} → {c.count![1]}{fired ? ` (${fired})` : ''} · <Link href={`/${lang}/stress?e=${c.eco}`}>스트레스 신호 →</Link></>
        : <>{eco}: the stress count {up ? `rose to ${c.K} or more` : `fell below ${c.K}`}, {c.count![0]} → {c.count![1]}{fired ? ` (${fired})` : ''} · <Link href={`/${lang}/stress?e=${c.eco}`}>Stress signals →</Link></>;
      break;
    }
    case 'partner_stress': text = ko
      ? <>{eco}: 수출처 스트레스(J4)가 한 단계 상승했습니다. {num(c.j4![0], lang, 1)} → {num(c.j4![1], lang, 1)} · <Link href={`/${lang}/stress?e=${c.eco}`}>스트레스 신호 →</Link></>
      : <>{eco}: stress at its export destinations (J4) rose a tercile, {num(c.j4![0], lang, 1)} → {num(c.j4![1], lang, 1)} · <Link href={`/${lang}/stress?e=${c.eco}`}>Stress signals →</Link></>; break;
    case 'at_risk_in': text = ko ? <>{eco}: 위험 사분면 진입. V {num(c.v![0], lang, 1)} → {num(c.v![1], lang, 1)}, F {num(c.flow![0], lang, 1, true)} → {num(c.flow![1], lang, 1, true)}</> : <>{eco} entered the at-risk quadrant: V {num(c.v![0], lang, 1)} → {num(c.v![1], lang, 1)}, F {num(c.flow![0], lang, 1, true)} → {num(c.flow![1], lang, 1, true)}</>; break;
    case 'at_risk_out': text = ko ? <>{eco}: 위험 사분면 이탈. V {num(c.v![1], lang, 0)}, F {num(c.flow![1], lang, 1, true)}</> : <>{eco} left the at-risk quadrant: V {num(c.v![1], lang, 0)}, F {num(c.flow![1], lang, 1, true)}</>; break;
    case 'flow_sign': text = ko
      ? <>{eco}: 자금 흐름이 {c.flow![1] < 0 ? '유출로' : '유입으로'} 전환. F {num(c.flow![0], lang, 1, true)} → {num(c.flow![1], lang, 1, true)} (은행 {num((c.b1 ?? 0) * 10, lang, 0, true)}억, 채권 {num((c.b2 ?? 0) * 10, lang, 0, true)}억 달러)</>
      : <>{eco}: funding turned {c.flow![1] < 0 ? 'to withdrawal' : 'to inflow'}, F {num(c.flow![0], lang, 1, true)} → {num(c.flow![1], lang, 1, true)} (bank {num(c.b1, lang, 1, true)}, bond {num(c.b2, lang, 1, true)} bn)</>; break;
    case 'a2_100': text = ko ? <>{eco}: 은행 단기 청구권이 순외환보유액의 {c.a2![1] >= 100 ? '100% 상회' : '100% 하회'}. A2 {num(c.a2![0], lang, 0)} → {num(c.a2![1], lang, 0)}</> : <>{eco}: short-term bank claims {c.a2![1] >= 100 ? 'rose above' : 'fell below'} net reserves, A2 {num(c.a2![0], lang, 0)} → {num(c.a2![1], lang, 0)}</>; break;
    case 'v_jump': text = ko ? <>{eco}: V 10점 넘게 변동. {num(c.v![0], lang, 0)} → {num(c.v![1], lang, 0)}</> : <>{eco}: V moved more than 10 points, {num(c.v![0], lang, 0)} → {num(c.v![1], lang, 0)}</>; break;
    case 'export_sign': text = ko ? <>{eco}: 12개월 수출이 전년동기대비 {c.mom![1] < 0 ? '감소 전환' : '증가 전환'}. {pct(c.mom![0], lang, 1, true)} → {pct(c.mom![1], lang, 1, true)}</> : <>{eco}: 12-month exports turned {c.mom![1] < 0 ? 'down' : 'up'} on a year earlier, {pct(c.mom![0], lang, 1, true)} → {pct(c.mom![1], lang, 1, true)}</>; break;
    case 'divergence': text = ko ? <>{eco} → {name(c.partner!, lang)}: 두 보고의 비율이 평소보다 {c.dir === 2 ? '높음' : '낮음'} (수입국/수출국 {num(c.mr, lang, 2)})</> : <>{eco} → {name(c.partner!, lang)}: the two reports diverge, ratio {c.dir === 2 ? 'above' : 'below'} its usual level ({num(c.mr, lang, 2)})</>; break;
    case 'chokepoint': text = ko ? <>{cn}: 병목 단계 변경, {f} → {to} ({c.year})</> : <>{cn}: chokepoint stage changed, {f} → {to} ({c.year})</>; break;
    default: text = <>{eco} {c.kind}</>;
  }
  const outs: React.ReactNode[] = [];
  if (links) {
    const money = c.side !== 'trade' && c.eco;
    const trade = c.side !== 'money';
    if (money) outs.push(<a key="m" href={siteUrl('money-flow', 'world_follow', lang, { iso3: c.eco! })}>money-flow →</a>);
    if (trade && c.chain) outs.push(<a key="t" href={siteUrl('trade-flow', 'chain', lang, { chain: c.chain })}>trade-flow →</a>);
    else if (trade && c.eco) outs.push(<a key="t" href={siteUrl('trade-flow', 'economy', lang, { iso3: c.eco })}>trade-flow →</a>);
  }
  return <><span className="when">{when}</span><span>{text}{outs.length > 0 && <span className="gn-small gn-change__out"> · {outs.map((o, i) => (<span key={i}>{i > 0 && ' · '}{o}</span>))}</span>}</span></>;
}
