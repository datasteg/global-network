// GET /health: the container healthcheck (the deploy waits for 200 before routing traffic). It names the data build.
import { readMeta } from '@/lib/data';

export const dynamic = 'force-dynamic';

export function GET() {
  let built: string | null = null;
  try { built = readMeta().built; } catch { built = null; }
  return Response.json(
    { status: built ? 'ok' : 'no-data', service: 'global-network', version: process.env.APP_VERSION ?? 'dev', built: process.env.BUILD_TIME, data: built, time: new Date().toISOString() },
    { status: built ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}
