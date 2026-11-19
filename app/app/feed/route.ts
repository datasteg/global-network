// GET /feed: an RSS 2.0 feed with two items, the English and the Korean digest, as plain sentences. The proxy's matcher
// excludes this path, so it is served without a language prefix. Regenerated from the data at every request.
import { readMeta } from '@/lib/data';
import { buildDigest, digestText } from '@/lib/digest';
import type { Lang } from '@/lib/types';

export const dynamic = 'force-dynamic';

const SITE = 'https://global-network.datasteg.com';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function GET() {
  let xml: string;
  let status = 200;
  try {
    const meta = readMeta();
    const built = new Date(meta.built);
    const pub = built.toUTCString();
    const stamp = meta.built.slice(0, 10);
    const items = (['en', 'ko'] as Lang[]).map((lang) => {
      const d = buildDigest(lang);
      return `    <item>
      <title>${esc(d.title)}</title>
      <link>${SITE}/${lang}/digest</link>
      <guid isPermaLink="false">${SITE}/${lang}/digest#${stamp}</guid>
      <pubDate>${pub}</pubDate>
      <description>${esc(digestText(lang))}</description>
    </item>`;
    });
    xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>global-network digest</title>
    <link>${SITE}/en/digest</link>
    <atom:link href="${SITE}/feed" rel="self" type="application/rss+xml" />
    <description>Funding and trade on one screen: the dated digest of the latest quarter and shown month, in English and Korean, regenerated at every build.</description>
    <language>en</language>
    <lastBuildDate>${pub}</lastBuildDate>
    <generator>datasteg global-network</generator>
${items.join('\n')}
  </channel>
</rss>
`;
  } catch {
    status = 503;
    xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>global-network digest</title><link>${SITE}/en/digest</link><description>no data</description></channel></rss>\n`;
  }
  return new Response(xml, { status, headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': status === 200 ? 'public, max-age=3600' : 'no-store' } });
}
