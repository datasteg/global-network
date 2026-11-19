import type { Metadata } from 'next';
import { plain, rich } from '@/lib/rich';
import { pageMeta } from '@/lib/seo';
import { ShocksTabs } from '@/components/SectionTabs';
import { Suspense } from 'react';
import { ReplayTool } from '@/components/ReplayTool';
import { Head } from '@/components/ui';
import { readMeta, readReplay } from '@/lib/data';
import { month, quarter } from '@/lib/format';
import { replayStrings } from '@/lib/strings/replay';
import type { Lang } from '@/lib/types';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang = raw as Lang;
  const R = replayStrings(lang);
  const m = readMeta();
  return pageMeta(lang, '/shocks/scenarios/replay', { title: `${R.title} · ${R.kicker}`, description: `${plain(R.lede)} ${lang === 'ko' ? `잔액은 ${quarter(m.money.quarter, lang)} 기준입니다.` : `Stocks as of ${quarter(m.money.quarter, lang)}.`}` });
}

export default async function ReplayPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang = raw as Lang;
  const R = replayStrings(lang);
  const meta = readMeta();
  const replay = readReplay();
  const names = Object.fromEntries(meta.economies.map((e) => [e.code, e[lang]]));
  return (
    <div className="gn-wrap gn-page">
      <ShocksTabs lang={lang} current="scenarios" />
      <Head kicker={`${R.kicker} · ${quarter(meta.money.quarter, lang)} · ${month(meta.trade.shown, lang)}`} title={R.title} lede={rich(R.lede)} />
      <Suspense fallback={null}>
        <ReplayTool lang={lang} data={replay} names={names} q={meta.money.quarter} shown={meta.trade.shown} />
      </Suspense>
    </div>
  );
}
