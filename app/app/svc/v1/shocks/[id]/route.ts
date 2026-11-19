// GET /svc/v1/shocks/{id}?economy=&part=summary|network|dollar&lang=: one replay /{lang}/shocks/{id} (lib/svc-views/shock.ts).
import { svcGuard, svcLang, svcRun } from '@/lib/svc';
import { shockView } from '@/lib/svc-views/shock';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = svcGuard(req); if (denied) return denied;
  const { id } = await ctx.params;
  const url = new URL(req.url);
  return svcRun(() => shockView(id, url.searchParams, svcLang(url)));
}
