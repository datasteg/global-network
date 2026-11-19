// Per-page metadata for search engines and the JSON-LD objects. Every route's
// generateMetadata builds its title, description, canonical and language alternates here from the route's own path,
// so a crawler sees each page as itself and not as a copy of the home page: canonical without query, en and ko
// alternates, x-default on the English page (never "/", which redirects by cookie and a crawler has none), the feed.
import type { Metadata } from 'next';
import { SITE_URL } from './family';
import type { Lang } from './types';

export const SITE = SITE_URL;
export const SITE_NAME = 'global-network';
/** The publisher named in JSON-LD and OpenGraph: the service, never a person. */
export const PUBLISHER = 'datasteg';
export const PUBLISHER_URL = 'https://datasteg.com';
export const LOCALE: Record<Lang, string> = { en: 'en-GB', ko: 'ko-KR' };

export interface PageMetaOptions {
  title: string;
  description: string;
  /** The title stands alone (no " — global-network" template). */
  absolute?: boolean;
  /** An image path for the card when the route has no opengraph-image.tsx of its own. */
  ogImage?: string;
}

/** `path` is the route after the language, starting with "/" ("" for the Overview), without query. */
export function pageMeta(lang: Lang, path: string, o: PageMetaOptions): Metadata {
  const here = `/${lang}${path}`;
  const other: Lang = lang === 'ko' ? 'en' : 'ko';
  const ogTitle = o.absolute ? o.title : `${o.title} — ${SITE_NAME}`;
  return {
    title: o.absolute ? { absolute: o.title } : o.title,
    description: o.description,
    alternates: {
      canonical: here,
      languages: { en: `/en${path}`, ko: `/ko${path}`, 'x-default': `/en${path}` },
      types: { 'application/rss+xml': `${SITE}/feed` },
    },
    openGraph: {
      title: ogTitle, description: o.description, url: here, type: 'website', siteName: `datasteg ${SITE_NAME}`,
      locale: LOCALE[lang].replace('-', '_'), alternateLocale: LOCALE[other].replace('-', '_'), ...(o.ogImage ? { images: [o.ogImage] } : {}),
    },
    twitter: { card: 'summary_large_image', title: ogTitle, description: o.description },
  };
}

// JSON-LD (schema.org). The publisher is always datasteg.
const ORG = { '@type': 'Organization', name: PUBLISHER, url: PUBLISHER_URL };

export function webSiteLd(lang: Lang, description: string) {
  return {
    '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, alternateName: `datasteg ${SITE_NAME}`,
    url: `${SITE}/${lang}`, inLanguage: LOCALE[lang], description, publisher: ORG,
  };
}

export function datasetLd(lang: Lang, o: { name: string; description: string; path: string; modified: string; keywords?: string[]; temporalCoverage?: string; isBasedOn?: string[] }) {
  return {
    '@context': 'https://schema.org', '@type': 'Dataset', name: o.name, description: o.description,
    url: `${SITE}/${lang}${o.path}`, inLanguage: LOCALE[lang], dateModified: o.modified, keywords: o.keywords, temporalCoverage: o.temporalCoverage,
    // The About page's sources section: the licence of every dataset the sheet joins, and what this site adds.
    license: `${SITE}/${lang}/about#sources`,
    isBasedOn: o.isBasedOn, creator: ORG, publisher: ORG, isAccessibleForFree: true,
  };
}

/** The serialised object for a <script type="application/ld+json">; `<` is escaped so no data can close the script. */
export function ldJson(data: object): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
