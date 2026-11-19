// The datasteg flow-site family. One source of truth: family/family.json in the
// shared datasteg tree, copied here before the image build (tests/test_family_sync.py keeps the copies
// equal). This file reads the copy and fills the link templates; the markup is in components/Family.tsx. Every
// cross-site link keeps the reader's language, opens in the same tab, carries no UTM and names the site and the object.
import family from './family.json';
import type { Lang } from './types';

export type SiteId = 'money-flow' | 'trade-flow' | 'global-network';
export type FamilyText = Record<Lang, string>;
export interface FamilySite { id: string; host: string; name: string; prefix?: string; role: FamilyText; links: Record<string, string> }
export interface FamilyData { version: number; kicker: FamilyText; menu: FamilyText; current: FamilyText; open: FamilyText; sites: FamilySite[]; articles: FamilySite }

export const FAMILY = family as unknown as FamilyData;
export const SELF: SiteId = 'global-network';
const SITES = Object.fromEntries(FAMILY.sites.map((s) => [s.id, s])) as Record<SiteId, FamilySite>;
export const SITE_URL = SITES[SELF]?.host ?? 'https://global-network.datasteg.com';

/** Fills `{lang}`, `{iso3}`, `{a}`, `{b}`, … in a template; a placeholder with no value is left as written. */
export function fill(template: string, vars: Record<string, string | number | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] == null ? m : String(vars[k])));
}

/** An absolute URL on a sibling site: `siteUrl('money-flow', 'world_follow', 'ko', { iso3: 'KOR' })`. An unknown
 *  key falls back to the site's home page, so a page never prints a broken link. */
export function siteUrl(site: SiteId, key: string, lang: Lang, params: Record<string, string | number> = {}): string {
  const s = SITES[site];
  const tpl = s.links[key] ?? s.links.home;
  const path = tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k === 'lang' ? lang : String(params[k] ?? '')));
  return `${s.host}${path}`;
}

export const siteName = (site: SiteId) => SITES[site].name;
export const siteRole = (site: SiteId, lang: Lang) => SITES[site].role[lang];
export const articlesUrl = (lang: Lang) => `${FAMILY.articles.host}${fill(FAMILY.articles.links.home, { lang })}`;

/** What a page is about, for the siblings' context links (components/Family.tsx reads it from the path). */
export type FamilyContext =
  | { kind: 'economy'; iso3: string; name: string }
  | { kind: 'pair'; a: string; b: string; aName: string; bName: string }
  | { kind: 'shock'; id: string; title: string }
  | { kind: 'dollar' }
  | { kind: 'home' };

export interface FamilyCard { id: string; name: string; role: string; current: boolean; href: string | null; text: string }

/** The three cards for a page: each sibling's context link when the page has the same object on it (the economy,
 *  the pair, the event), else its home page; the current site is marked and carries no link. */
export function familyCards(lang: Lang, ctx: FamilyContext): FamilyCard[] {
  const ko = lang === 'ko';
  return FAMILY.sites.map((s) => {
    const current = s.id === SELF;
    let href: string | null = null, text = '';
    if (!current) {
      const site = s.id as SiteId;
      const open = fill(FAMILY.open[lang], { name: s.name });
      href = siteUrl(site, 'home', lang); text = open;
      if (ctx.kind === 'economy') {
        href = siteUrl(site, 'economy', lang, { iso3: ctx.iso3 });
        text = ko ? `${s.name}에서 ${ctx.name} 보기` : `${ctx.name} in ${s.name}`;
      } else if (ctx.kind === 'pair') {
        href = site === 'money-flow' ? siteUrl(site, 'bank_pair', lang, { a: ctx.a, b: ctx.b }) : siteUrl(site, 'flow', lang, { a: ctx.a, b: ctx.b });
        text = site === 'money-flow'
          ? (ko ? `${s.name}에서 ${ctx.aName}·${ctx.bName} 은행 셀 보기` : `${ctx.aName} · ${ctx.bName} bank cell in ${s.name}`)
          : (ko ? `${s.name}에서 ${ctx.aName}→${ctx.bName} 흐름 보기` : `${ctx.aName} → ${ctx.bName} flow in ${s.name}`);
      } else if (ctx.kind === 'shock' && site === 'trade-flow') {
        href = siteUrl(site, 'event', lang, { event: ctx.id });
        text = ko ? `${s.name}에서 이 사건 보기` : `This event in ${s.name}`;
      } else if (ctx.kind === 'dollar' && site === 'money-flow') {
        href = siteUrl(site, 'world', lang);
        text = ko ? `${s.name}의 세계 페이지` : `The World page in ${s.name}`;
      }
    }
    return { id: s.id, name: s.name, role: s.role[lang], current, href, text };
  });
}
