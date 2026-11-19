// The tab strips of the merged sections: Shocks (replays, scenarios, dollar; the episode catalogue and the Fiscal
// Stress Monitor moved to the parents on 2 Nov 2026) and an economy (sheet, compare).
import { Tabs } from './ui';
import { shocks } from '@/lib/strings/shocks';
import { country } from '@/lib/strings/country';
import { name } from '@/lib/names';
import { readShocks } from '@/lib/data';
import type { Lang } from '@/lib/types';

export type ShockTab = 'hub' | 'replay' | 'scenarios' | 'dollar';

export function ShocksTabs({ lang, current }: { lang: Lang; current: ShockTab | string }) {
  const S = shocks(lang);
  const replays = readShocks().replays.map((r) => ({ id: r.id, label: r.label[lang] }));
  const items = [
    { href: `/${lang}/shocks`, label: S.tabs.hub, current: current === 'hub' },
    ...replays.map((r) => ({ href: `/${lang}/shocks/${r.id}`, label: r.label, current: current === r.id })),
    { href: `/${lang}/shocks/scenarios`, label: S.tabs.scenarios, current: current === 'scenarios' },
    { href: `/${lang}/shocks/dollar`, label: S.tabs.dollar, current: current === 'dollar' },
  ];
  return <Tabs items={items} label={S.kicker} />;
}

export function EconomyTabs({ lang, code, partner, current }: { lang: Lang; code: string; partner: string; current: 'sheet' | 'compare' }) {
  const C = country(lang);
  return (
    <Tabs label={C.kicker} items={[
      { href: `/${lang}/c/${code}`, label: C.tabSheet, current: current === 'sheet' },
      { href: `/${lang}/c/${code}/with/${partner}`, label: C.tabCompare(name(partner, lang)), current: current === 'compare' },
    ]} />
  );
}
