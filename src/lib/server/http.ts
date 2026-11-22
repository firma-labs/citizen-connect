import "server-only";
import { TOKEN_RE, normaliseToken } from "@/lib/token";

export const json = (data: unknown, init?: number | ResponseInit) =>
  Response.json(data, typeof init === "number" ? { status: init } : init);

export const errorJson = (status: number, error: string) => json({ error }, status);

export function parseToken(raw: string): string | null {
  const t = normaliseToken(decodeURIComponent(raw));
  return TOKEN_RE.test(t) ? t : null;
}

/** Public base URL for links in SMS/QR. Behind `tailscale serve` the Host header is preserved. */
export function publicOrigin(req: Request): string {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.endsWith(".ts.net") ? "https" : new URL(req.url).protocol.replace(":", ""));
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}
