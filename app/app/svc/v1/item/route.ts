// GET /svc/v1/item?id=<kind>:<key>&lang=: readable Markdown of what a page shows (kinds country, pair, shock, stress).
import { svcGuard, svcLang, svcRun } from '@/lib/svc';
import { item } from '@/lib/svc-views/hooks';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const denied = svcGuard(req); if (denied) return denied;
  const url = new URL(req.url);
  return svcRun(() => item(url.searchParams, svcLang(url)));
}
