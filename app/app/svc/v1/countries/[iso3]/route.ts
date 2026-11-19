// GET /svc/v1/countries/{iso3}?part=sheet|funding|trade&lang=: the country sheet /{lang}/c/{iso3} (lib/svc-views/country.ts).
import { svcGuard, svcLang, svcRun } from '@/lib/svc';
import { countryView } from '@/lib/svc-views/country';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ iso3: string }> }) {
  const denied = svcGuard(req); if (denied) return denied;
  const { iso3 } = await ctx.params;
  const url = new URL(req.url);
  return svcRun(() => countryView(iso3, url.searchParams, svcLang(url)));
}
