import type { MetadataRoute } from 'next';
import { readMeta, readShocks } from '@/lib/data';
import { LANGS } from '@/lib/i18n';
import { SITE } from '@/lib/seo';

export const dynamic = 'force-dynamic';

// Both languages, from the same lists the pages use: the Overview with its two
// feeds, the country sheets of the board economies and the hub, the Shocks hub with every replay, the dollar channel
// and the scenarios, About. The pair pages (1,332 per language) stay out of the sitemap at first; they remain reachable
// from every country sheet. lastModified is the data build's day.
export default function sitemap(): MetadataRoute.Sitemap {
  const meta = readMeta();
  const date = new Date(meta.built);
  const codes = [...meta.economies.map((e) => e.code), meta.hub];
  const paths: { p: string; priority: number }[] = [
    { p: '', priority: 1 }, { p: '/stress', priority: 0.8 }, { p: '/changes', priority: 0.6 }, { p: '/digest', priority: 0.6 },
    ...codes.map((c) => ({ p: `/c/${c}`, priority: 0.8 })),
    { p: '/shocks', priority: 0.7 },
    ...readShocks().replays.map((r) => ({ p: `/shocks/${r.id}`, priority: 0.7 })),
    { p: '/shocks/dollar', priority: 0.6 }, { p: '/shocks/scenarios', priority: 0.5 }, { p: '/shocks/scenarios/replay', priority: 0.5 },
    { p: '/about', priority: 0.5 },
  ];
  const languages = (p: string) => Object.fromEntries([...LANGS.map((l) => [l, `${SITE}/${l}${p}`]), ['x-default', `${SITE}/en${p}`]]);
  return LANGS.flatMap((lang) => paths.map(({ p, priority }) => ({
    url: `${SITE}/${lang}${p}`, lastModified: date, changeFrequency: 'daily' as const, priority, alternates: { languages: languages(p) },
  })));
}
