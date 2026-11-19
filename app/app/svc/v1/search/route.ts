// GET /svc/v1/search?q=&lang=&limit=: economies (code, English or Korean name), pairs, shock replays and stress signals.
import { svcGuard, svcLang, svcRun } from '@/lib/svc';
import { search } from '@/lib/svc-views/hooks';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const denied = svcGuard(req); if (denied) return denied;
  const url = new URL(req.url);
  return svcRun(() => search(url.searchParams, svcLang(url)));
}
