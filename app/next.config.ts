import path from 'node:path';
import type { NextConfig } from 'next';

const dev = process.env.NODE_ENV === 'development';

// A public site that loads nothing from another origin except the visitor count (an image request to stats.datasteg.com).
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://stats.datasteg.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

const config: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  output: 'standalone',
  // The design system lives one folder up (global-network/design), so the project root is global-network/.
  outputFileTracingRoot: path.join(__dirname, '..'),
  turbopack: { root: path.join(__dirname, '..') },
  // The built data is read at run time from DATA_DIR (lib/data.ts), never bundled or traced.
  outputFileTracingExcludes: { '*': ['../data/**'] },
  images: { unoptimized: true },
  allowedDevOrigins: ['127.0.0.1'],
  poweredByHeader: false,
  // Old URLs from before the four-section menu (1 Nov 2026) keep working: permanent redirects to their new homes.
  // A fragment on the old URL (/method#g9) survives, because the new page keeps the same anchor ids.
  async redirects() {
    const L = ':lang(en|ko)';
    return [
      { source: `/${L}/p/:a/:b`, destination: '/:lang/c/:a/with/:b', permanent: true },
      { source: `/${L}/episodes`, destination: '/:lang/shocks', permanent: true },
      { source: `/${L}/scenarios`, destination: '/:lang/shocks/scenarios', permanent: true },
      { source: `/${L}/scenarios/:rest*`, destination: '/:lang/shocks/scenarios/:rest*', permanent: true },
      { source: `/${L}/dollar`, destination: '/:lang/shocks/dollar', permanent: true },
      { source: `/${L}/method`, destination: '/:lang/about', permanent: true },
      { source: `/${L}/sources`, destination: '/:lang/about#sources', permanent: true },
      // The refurbish of 2 Nov 2026: copies of the parents' pages left this site.
      // The episode catalogue is money-flow's validation set and trade-flow's event list; the hub links to both.
      { source: `/${L}/shocks/episodes`, destination: '/:lang/shocks', statusCode: 301 },
      // Scenario S2 (a supplier drops out) is trade-flow's "Cut a supplier" case tool; S4 (a lender pulls back) is
      // money-flow's "Cut a lender" panel on the bank market. Neither page kept its state in the URL, so there is no
      // query to map; the targets open on their defaults (Korea as the debtor).
      { source: `/${L}/shocks/scenarios/supplier`, destination: 'https://trade-flow.datasteg.com/:lang/cases/tools/cut-supplier', statusCode: 301 },
      { source: `/${L}/shocks/scenarios/lenders`, destination: 'https://money-flow.datasteg.com/:lang/m/bank?cut=1&by=debtor&e=KOR', statusCode: 301 },
      // The Fiscal Stress Monitor (and its earlier name, the Sovereign stress warning) is money-flow's Sovereign section.
      // Next passes the query through (?e=, r1..r7, off, k, y), so shared links keep their settings.
      { source: `/${L}/fiscal-stress`, destination: 'https://money-flow.datasteg.com/:lang/sovereign', statusCode: 301 },
      { source: `/${L}/warning`, destination: 'https://money-flow.datasteg.com/:lang/sovereign', statusCode: 301 },
    ];
  },
  async headers() {
    const CACHE = { key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=86400' };
    return [
      {
        // No X-Robots-Tag any more: the site is open to search engines since 2 Nov 2026;
        // robots.ts and the layout's robots metadata say what may be indexed).
        source: '/((?!_next/static).*)',
        headers: [
          { key: 'Content-Security-Policy', value: CSP },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      // The HTML of the pages (the data change at most daily): five minutes in a shared cache, a day stale while
      // revalidating. Only the language-prefixed pages: not /health, not /feed, not the bare / (which redirects by cookie).
      { source: '/:lang(en|ko)', headers: [CACHE] },
      { source: '/:lang(en|ko)/:path*', headers: [CACHE] },
    ];
  },
  env: {
    APP_VERSION: process.env.APP_VERSION ?? 'dev',
    BUILD_TIME: process.env.BUILD_TIME ?? new Date().toISOString(),
  },
};

export default config;
