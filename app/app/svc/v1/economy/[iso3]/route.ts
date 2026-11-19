// GET /svc/v1/economy/{iso3}?lang=: the country sheet's headline; covered:false for codes without a sheet.
import { svcGuard, svcLang, svcRun } from '@/lib/svc';
import { economyHook } from '@/lib/svc-views/hooks';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ iso3: string }> }) {
  const denied = svcGuard(req); if (denied) return denied;
  const { iso3 } = await ctx.params;
  return svcRun(() => economyHook(iso3, svcLang(new URL(req.url))));
}
