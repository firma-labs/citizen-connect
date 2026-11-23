import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { normaliseMobile } from "@/lib/token";

// Pilot sign-in: user ID = mobile number, one shared password (PRD §9.2 moves
// to Cognito mobile OTP in production). Configured by environment:
//   DEMO_USERS    = "9876543210:R. Jadhav,9822012345:A. Patil"   (name optional)
//   DEMO_PASSWORD = shared password
//   AUTH_SECRET   = optional signing key (defaults to one derived from the password,
//                   so changing the password signs everyone out)
// Sign-in is on when both DEMO_USERS and DEMO_PASSWORD are set. On Vercel the app
// stays closed if they are missing, so a deploy is never accidentally public.

export const SESSION_COOKIE = "cc_session";
export const SESSION_DAYS = 30;

export interface Session {
  mobile: string;
  name: string | null;
}

function users(): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const entry of (process.env.DEMO_USERS ?? "").split(",")) {
    const [rawMobile, ...nameParts] = entry.split(":");
    const mobile = normaliseMobile(rawMobile);
    if (mobile) map.set(mobile, nameParts.join(":").trim() || null);
  }
  return map;
}

export type AuthMode = "open" | "on" | "misconfigured";

export function authMode(): AuthMode {
  if (process.env.DEMO_PASSWORD && users().size > 0) return "on";
  return process.env.VERCEL ? "misconfigured" : "open";
}

const key = () => process.env.AUTH_SECRET || createHash("sha256").update(`cc-session:${process.env.DEMO_PASSWORD ?? ""}`).digest("hex");
const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const sign = (payload: string) => createHmac("sha256", key()).update(payload).digest("base64url");

function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Check mobile + password; returns the session to store, or null. */
export function checkCredentials(mobileInput: string, password: string): Session | null {
  const mobile = normaliseMobile(mobileInput);
  const list = users();
  const passwordOk = safeEqual(password, process.env.DEMO_PASSWORD ?? "");
  if (!mobile || !list.has(mobile) || !passwordOk) return null;
  return { mobile, name: list.get(mobile) ?? null };
}

export function createSessionValue(s: Session): string {
  const payload = b64url(JSON.stringify({ m: s.mobile, exp: Date.now() + SESSION_DAYS * 86_400_000 }));
  return `${payload}.${sign(payload)}`;
}

/** Verify the cookie value. Also rejects users removed from DEMO_USERS since sign-in. */
export function readSession(value: string | undefined | null): Session | null {
  if (!value) return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return null;
  try {
    const { m, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { m: string; exp: number };
    if (typeof exp !== "number" || exp < Date.now()) return null;
    const list = users();
    if (!list.has(m)) return null;
    return { mobile: m, name: list.get(m) ?? null };
  } catch {
    return null;
  }
}

/** Session from a request's cookies (route handlers). */
export function sessionFromRequest(req: Request): Session | null {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  return readSession(match ? decodeURIComponent(match.slice(SESSION_COOKIE.length + 1)) : null);
}

/** How a signed-in person appears in the audit log. */
export const auditName = (s: Session) => (s.name ? `${s.name} (${s.mobile})` : s.mobile);
