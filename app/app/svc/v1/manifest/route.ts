// GET /svc/v1/manifest: the app, its contract surface, the release it serves and its views (api/docs/SVC-CONTRACT.md).
import { svcGuard, svcRun } from '@/lib/svc';
import { manifest } from '@/lib/svc-views/hooks';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const denied = svcGuard(req); if (denied) return denied;
  return svcRun(() => manifest());
}
