import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authMode, readSession } from "@/lib/server/auth";

// Staff sign-in gate for the pilot. The citizen status page stays public: it
// shows nothing without a token and the matching mobile number.
const PUBLIC = [/^\/login$/, /^\/api\/auth\//, /^\/track$/, /^\/api\/track$/, /^\/offline$/, /^\/privacy$/, /^\/terms$/, /^\/accessibility$/];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();

  const mode = authMode();
  if (mode === "open") return NextResponse.next();

  const session = mode === "on" ? readSession(req.cookies.get(SESSION_COOKIE)?.value) : null;
  if (session) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: mode === "misconfigured" ? "sign-in not configured" : "sign in required" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except build assets, icons, the manifest and the service worker.
  matcher: ["/((?!_next/static|_next/image|vendor/|pwa-icon|manifest.webmanifest|sw.js|favicon.ico).*)"],
};
