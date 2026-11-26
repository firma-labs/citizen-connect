import "server-only";
import { TOKEN_RE, normaliseToken } from "@/lib/token";
import { StoreBusyError, getStore } from "./store";

export const json = (data: unknown, init?: number | ResponseInit) =>
  Response.json(data, typeof init === "number" ? { status: init } : init);

export const errorJson = (status: number, error: string) => json({ error }, status);

/**
 * An unexpected failure, answered as JSON like every other error (a bare 500
 * has no body, and the page would show a JSON parse error instead of a reason).
 * 503 when the store was busy: nothing was saved, and trying again is safe.
 */
export function serverError(e: unknown) {
  if (e instanceof StoreBusyError) {
    console.warn(e.message);
    return errorJson(503, "busy");
  }
  console.error(e);
  return errorJson(500, e instanceof Error ? e.message : "server error");
}

/** Wrap a route handler so any unexpected failure becomes `serverError`. */
export function withErrors<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (e) {
      return serverError(e);
    }
  };
}

/** 410 Gone for a permanently deleted token (phones then drop their copy), else 404. */
export async function notFoundOrGone(token: string) {
  return (await getStore().wasRemoved(token)) ? errorJson(410, "deleted") : errorJson(404, "not found");
}

export function parseToken(raw: string): string | null {
  const t = normaliseToken(decodeURIComponent(raw));
  return TOKEN_RE.test(t) ? t : null;
}

/** Public base URL for links in WhatsApp messages and QR codes. Behind `tailscale serve` the Host header is preserved. */
export function publicOrigin(req: Request): string {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.endsWith(".ts.net") ? "https" : new URL(req.url).protocol.replace(":", ""));
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}
