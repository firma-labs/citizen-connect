import { z } from "zod";
import { SESSION_COOKIE, SESSION_DAYS, authMode, checkCredentials, createSessionValue } from "@/lib/server/auth";
import { errorJson, json } from "@/lib/server/http";

const Body = z.object({ mobile: z.string().max(20), password: z.string().max(200) });

export async function POST(req: Request) {
  const mode = authMode();
  if (mode === "open") return json({ ok: true, mode });
  if (mode === "misconfigured") return errorJson(503, "sign-in not configured");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorJson(400, "mobile and password required");

  const session = checkCredentials(parsed.data.mobile, parsed.data.password);
  if (!session) {
    await new Promise((r) => setTimeout(r, 700)); // slow down guessing
    return errorJson(401, "invalid");
  }
  const res = json({ ok: true, mobile: session.mobile, name: session.name });
  const secure = new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  res.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(createSessionValue(session))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? "; Secure" : ""}`,
  );
  return res;
}
