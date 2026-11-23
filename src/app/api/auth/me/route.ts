import { connection } from "next/server";
import { authMode, sessionFromRequest } from "@/lib/server/auth";

export async function GET(req: Request) {
  // Per request: the answer depends on the cookie and on environment set at runtime,
  // so it must not be prerendered at build time.
  await connection();
  const mode = authMode();
  const s = mode === "on" ? sessionFromRequest(req) : null;
  return Response.json({ mode, signedIn: !!s, mobile: s?.mobile ?? null, name: s?.name ?? null });
}
