// GET /svc/v1/shocks?lang=: the shock replays on /{lang}/shocks (lib/svc-views/shock.ts).
import { svcGuard, svcLang, svcRun } from '@/lib/svc';
import { shocksView } from '@/lib/svc-views/shock';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const denied = svcGuard(req); if (denied) return denied;
  return svcRun(() => shocksView(svcLang(new URL(req.url))));
}
