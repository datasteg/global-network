// GET /svc/v1/economies?lang=: the 37 economies with a country sheet (36 board economies and the United States).
import { svcGuard, svcLang, svcRun } from '@/lib/svc';
import { economies } from '@/lib/svc-views/hooks';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const denied = svcGuard(req); if (denied) return denied;
  return svcRun(() => economies(svcLang(new URL(req.url))));
}
