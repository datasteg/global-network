// A JSON-LD block (lib/seo.ts builds the objects).
import { ldJson } from '@/lib/seo';

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(data) }} />;
}
