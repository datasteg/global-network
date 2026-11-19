import type { Metadata } from 'next';
import { ChangeLine } from '@/components/ChangeLine';
import { Head, Panel } from '@/components/ui';
import { Cite } from '@/components/Cite';
import { BOARD, comtrade, money, qRange, w12 } from '@/lib/cites';
import { plain, rich } from '@/lib/rich';
import { readChanges, readMeta } from '@/lib/data';
import { siteUrl } from '@/lib/family';
import { month, quarter } from '@/lib/format';
import { t } from '@/lib/i18n';
import { pageMeta } from '@/lib/seo';
import { changes as strings } from '@/lib/strings/changes';
import type { Change, Lang } from '@/lib/types';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang = raw as Lang;
  const meta = readMeta(), ch = readChanges();
  const prevQ = ch.prev_q ?? meta.money.quarters[meta.money.quarters.length - 2];
  const C = strings(lang);
  return pageMeta(lang, '/changes', { title: C.title, description: plain(C.lede(quarter(ch.q, lang), quarter(prevQ, lang), month(ch.t, lang), month(ch.prev_t ?? prevMonth(ch.t), lang))) });
}

const JOINT_KINDS = ['funding_exports', 'stress_count', 'partner_stress', 'chokepoint_lender'] as const;
const MONEY_KINDS = ['at_risk_in', 'at_risk_out', 'flow_sign', 'a2_100', 'v_jump'] as const;
const TRADE_KINDS = ['export_sign', 'divergence', 'chokepoint'] as const;
type Kind = (typeof JOINT_KINDS)[number] | (typeof MONEY_KINDS)[number] | (typeof TRADE_KINDS)[number];

const prevMonth = (tm: number) => (tm % 100 === 1 ? (Math.floor(tm / 100) - 1) * 100 + 12 : tm - 1);

export default async function ChangesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang = raw as Lang;
  const L = t(lang);
  const C = strings(lang);
  const meta = readMeta();
  const ch = readChanges();
  const byKind = new Map<string, Change[]>();
  for (const c of ch.items) byKind.set(c.kind, [...(byKind.get(c.kind) ?? []), c]);
  const prevQ = ch.prev_q ?? meta.money.quarters[meta.money.quarters.length - 2];
  const q = quarter(ch.q, lang), prevQs = quarter(prevQ, lang), m = month(ch.t, lang), prevM = month(ch.prev_t ?? prevMonth(ch.t), lang);
  const nJoint = JOINT_KINDS.reduce((s, k) => s + (byKind.get(k)?.length ?? 0), 0);

  const group = (kind: Kind) => {
    const items = byKind.get(kind) ?? [];
    const K = C.kinds[kind];
    return (
      <div className="gn-kind" key={kind}>
        <h3>{K.h} <span className="gn-muted gn-mono" style={{ fontSize: 13, fontWeight: 400 }}>{items.length}</span></h3>
        <p className="gn-kind__rule">{rich(K.rule)}</p>
        {items.length ? (
          <ul className="gn-list">{items.map((c, i) => (<li key={i}><ChangeLine c={c} lang={lang} links /></li>))}</ul>
        ) : <p className="gn-small gn-muted">{C.none}</p>}
      </div>
    );
  };

  return (
    <div className="gn-wrap gn-page">
      <Head kicker={`${C.kicker} · ${q} · ${m}`} title={C.title} lede={C.lede(q, prevQs, m, prevM)} />

      <Panel title={C.joint} period={`${q} · ${m}`} right={<span className="gn-mono gn-muted">{nJoint}</span>}>
        <p className="gn-small gn-muted">{C.jointLede}</p>
        <div className="gn-kinds">{JOINT_KINDS.map(group)}</div>
        <Cite items={[...money(BOARD, qRange(meta, lang, prevQ, ch.q)), comtrade(w12(meta.trade.shown, lang))]}>{C.sourceJoint}</Cite>
      </Panel>

      <div className="gn-grid-2" style={{ alignItems: 'start' }}>
        <Panel tone="money" title={C.money} period={`${prevQs} → ${q}`}>
          <div className="gn-kinds">{MONEY_KINDS.map(group)}</div>
          <p><a className="gn-btn gn-btn--sm" href={siteUrl('money-flow', 'world', lang)}>{C.openMoney} →</a></p>
          <Cite items={money(BOARD, qRange(meta, lang, prevQ, ch.q))}>{C.sourceMoney(q, prevQs, meta.surfaces.money.method)}</Cite>
        </Panel>
        <Panel tone="trade" title={C.trade} period={`${prevM} → ${m}`}>
          <div className="gn-kinds">{TRADE_KINDS.map(group)}</div>
          <p><a className="gn-btn gn-btn--sm" href={siteUrl('trade-flow', 'events', lang)}>{C.openTrade} →</a></p>
          <Cite items={[comtrade(w12(meta.trade.shown, lang)), comtrade(lang === 'ko' ? `공급망 단계, ${meta.trade.complete.A}년` : `chain stages, ${meta.trade.complete.A}`)]}>{C.sourceTrade(m, meta.trade.complete.A)}</Cite>
        </Panel>
      </div>
      {void L}
    </div>
  );
}
