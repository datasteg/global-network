// GET /svc/v1/stress?economy=&quarter=&inputs=&lang=: the stress signals /{lang}/stress (lib/svc-views/stress.ts).
import { svcGuard, svcLang, svcRun } from '@/lib/svc';
import { stressView } from '@/lib/svc-views/stress';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const denied = svcGuard(req); if (denied) return denied;
  const url = new URL(req.url);
  return svcRun(() => stressView(url.searchParams, svcLang(url)));
}
