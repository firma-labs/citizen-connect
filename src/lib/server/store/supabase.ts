import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Application } from "@/lib/types";
import type { PageBlob, Store } from "./types";

// Supabase store for the hosted pilot (PRD §9.1 — mock or redacted letters only;
// this stack is outside India and must never hold real citizen data).
// Schema: supabase/migrations/0001_init.sql. The whole record lives in `data`
// (jsonb); a few columns are lifted out for filtering. Writes use optimistic
// concurrency on `version`.

const BUCKET = process.env.SUPABASE_PAGES_BUCKET ?? "pages";

let client: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!client) {
    client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
  }
  return client;
}

interface Row {
  token: string;
  data: Application;
  version: number;
}

const columns = (app: Application) => ({
  token: app.token,
  venue: app.venue,
  status: app.status,
  captured_at: app.captured_at,
  department: app.verified?.department ?? null,
  sla_due_at: app.sla_due_at,
  updated_at: app.updated_at,
  data: app,
});

const pagePath = (token: string, idx: number) => `${token}/${idx}`;

export const supabaseStore: Store = {
  name: "supabase",
  async get(token) {
    const { data, error } = await db().from("applications").select("data").eq("token", token).maybeSingle();
    if (error) throw error;
    return (data?.data as Application) ?? null;
  },
  async createIfAbsent(app) {
    const { error } = await db()
      .from("applications")
      .upsert({ ...columns(app), version: 1 }, { onConflict: "token", ignoreDuplicates: true });
    if (error) throw error;
    return (await this.get(app.token))!;
  },
  async update(token, fn) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await db()
        .from("applications")
        .select("token,data,version")
        .eq("token", token)
        .maybeSingle<Row>();
      if (error) throw error;
      if (!data) return null;
      const next = fn(structuredClone(data.data));
      if (!next) return data.data;
      next.updated_at = new Date().toISOString();
      const { data: updated, error: upErr } = await db()
        .from("applications")
        .update({ ...columns(next), version: data.version + 1 })
        .eq("token", token)
        .eq("version", data.version)
        .select("token");
      if (upErr) throw upErr;
      if (updated && updated.length === 1) return next;
      // Lost the race — re-read and re-apply.
    }
    throw new Error(`update conflict on ${token}`);
  },
  async list(limit = 200) {
    const { data, error } = await db()
      .from("applications")
      .select("data")
      .order("captured_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((r) => r.data as Application);
  },
  async putPage(token, idx, page) {
    const { error } = await db()
      .storage.from(BUCKET)
      .upload(pagePath(token, idx), page.bytes, { contentType: page.contentType, upsert: true });
    if (error) throw error;
  },
  async takeAiRead(day, limit) {
    // Atomic in Postgres (see 0002_ai_usage.sql): concurrent serverless calls can't overshoot.
    const { data, error } = await db().rpc("take_ai_read", { p_day: day, p_limit: limit });
    if (error) throw error;
    return typeof data === "number" && data > 0 ? data : null;
  },
  async aiReadsOn(day) {
    const { data, error } = await db().from("ai_usage").select("reads").eq("day", day).maybeSingle();
    if (error) throw error;
    return (data?.reads as number | undefined) ?? 0;
  },
  async getPage(token, idx): Promise<PageBlob | null> {
    const { data, error } = await db().storage.from(BUCKET).download(pagePath(token, idx));
    if (error) {
      if ("statusCode" in error && String((error as { statusCode?: unknown }).statusCode) === "404") return null;
      if (/not found/i.test(error.message)) return null;
      throw error;
    }
    return { bytes: new Uint8Array(await data.arrayBuffer()), contentType: data.type || "image/jpeg" };
  },
};
