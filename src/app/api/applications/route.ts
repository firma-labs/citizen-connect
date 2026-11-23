import { connection } from "next/server";
import { z } from "zod";
import { VENUES } from "@/lib/reference";
import { auditName, sessionFromRequest } from "@/lib/server/auth";
import { getStore } from "@/lib/server/store";
import { errorJson, json, parseToken } from "@/lib/server/http";
import type { Application } from "@/lib/types";

export async function GET() {
  await connection();
  const apps = await getStore().list(200);
  return json({ applications: apps.map(({ extraction, ...rest }) => ({ ...rest, has_extraction: !!extraction, summary_en: extraction?.reasoner.summary_en ?? null })) });
}

const CreateBody = z.object({
  token: z.string(),
  venue: z.enum(VENUES.map((v) => v.code) as [string, ...string[]]),
  captured_at: z.string(),
  captured_by: z.string().nullable().optional(),
  page_count: z.number().int().min(1).max(40),
});

/** Idempotent: the device retries this on every sync until it succeeds. */
export async function POST(req: Request) {
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorJson(400, parsed.error.message);
  const token = parseToken(parsed.data.token);
  if (!token) return errorJson(400, "invalid token format");
  // A phone still holding a scan that staff deleted must not upload it again.
  if (await getStore().wasRemoved(token)) return errorJson(410, "deleted");
  const now = new Date().toISOString();
  // Signed-in identity wins over the name typed on the device.
  const session = sessionFromRequest(req);
  const capturedBy = session ? auditName(session) : (parsed.data.captured_by ?? null);
  const app: Application = {
    token,
    venue: parsed.data.venue,
    captured_at: parsed.data.captured_at,
    captured_by: capturedBy,
    page_count: parsed.data.page_count,
    pages_received: [],
    status: "captured",
    read_started_at: null,
    read_error: null,
    extraction: null,
    verified: null,
    verified_at: null,
    verified_by: null,
    sla_due_at: null,
    closing_remark: null,
    sms: [],
    audit: [{ at: now, by: capturedBy ?? "device", action: "token_issued" }],
    updated_at: now,
  };
  const stored = await getStore().createIfAbsent(app);
  if (stored.captured_at !== app.captured_at || stored.venue !== app.venue) {
    // Same token from a different capture: astronomically unlikely, but never merge two citizens.
    return errorJson(409, "token collision");
  }
  if (stored.page_count !== app.page_count && stored.status === "captured") {
    await getStore().update(token, (a) => ({ ...a, page_count: app.page_count }));
  }
  return json({ application: { token: stored.token, status: stored.status, pages_received: stored.pages_received } }, 201);
}
