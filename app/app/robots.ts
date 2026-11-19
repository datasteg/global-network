import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/seo';

// Open to crawlers since 2 Nov 2026: everything but the health check.
// The feed and the sitemap stay crawlable; there is no data route. /svc/ is internal (the api service's views).
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/health', '/svc/'] }], sitemap: `${SITE}/sitemap.xml` };
}
