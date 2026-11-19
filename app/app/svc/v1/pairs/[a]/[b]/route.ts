// GET /svc/v1/pairs/{a}/{b}?history=&since=&lang=: the pair page /{lang}/c/{a}/with/{b} (lib/svc-views/pair.ts).
import { svcGuard, svcLang, svcRun } from '@/lib/svc';
import { pairView } from '@/lib/svc-views/pair';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ a: string; b: string }> }) {
  const denied = svcGuard(req); if (denied) return denied;
  const { a, b } = await ctx.params;
  const url = new URL(req.url);
  return svcRun(() => pairView(a, b, url.searchParams, svcLang(url)));
}
