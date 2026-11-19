// lib/svc.ts: the guard and response helpers for /svc/v1 (see api/docs/SVC-CONTRACT.md)
const PUBLIC = /\./; // public hosts have dots (money-flow.datasteg.com); Docker service names do not (money-flow)
export function svcGuard(req: Request): Response | null {
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  const fwd = (req.headers.get("x-forwarded-host") || "").split(":")[0].toLowerCase();
  const local = host === "localhost" || host === "127.0.0.1";
  if ((!local && PUBLIC.test(host)) || (fwd && PUBLIC.test(fwd) && fwd !== "127.0.0.1")) return svcError(404, "not-found", "Not found", "No such path.");
  const token = process.env.DATASTEG_SVC_TOKEN;
  if (token && req.headers.get("x-datasteg-gateway") !== token) return svcError(404, "not-found", "Not found", "No such path.");
  return null;
}
const HDRS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" };
export function svcJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: HDRS });
}
export function svcError(status: number, type: string, title: string, detail: string): Response {
  return svcJson({ error: { status, type, title, detail } }, status);
}
export function svcLang(url: URL): "en" | "ko" { return url.searchParams.get("lang") === "ko" ? "ko" : "en"; }

// ---- global-network additions (the views live in lib/svc-views/) ----

/** A refusal a view builder throws: it becomes the contract's error envelope with this status. */
export class SvcFail extends Error {
  constructor(public status: number, public type: string, public title: string, public detail: string) { super(detail); }
}
export const badParam = (detail: string) => new SvcFail(400, "bad-parameter", "Bad parameter", detail);

/** Runs a view builder: its object as JSON, a SvcFail as its error, anything else (a missing data file) as 503
 *  without a stack trace (the server log keeps the cause). */
export async function svcRun(build: () => unknown | Promise<unknown>): Promise<Response> {
  try {
    return svcJson(await build());
  } catch (e) {
    if (e instanceof SvcFail) return svcError(e.status, e.type, e.title, e.detail);
    console.error("svc:", e);
    return svcError(503, "data-unavailable", "Data unavailable", "global-network could not read the data for this view. Try again later; GET /svc/v1/manifest shows the release it serves.");
  }
}
