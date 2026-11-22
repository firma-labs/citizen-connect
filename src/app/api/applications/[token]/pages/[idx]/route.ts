import { getStore } from "@/lib/server/store";
import { errorJson, parseToken } from "@/lib/server/http";

const MAX_BYTES = 4 * 1024 * 1024; // stays under Vercel's 4.5 MB request body limit
const TYPES = ["image/jpeg", "image/png", "image/webp"];

async function parse(ctx: RouteContext<"/api/applications/[token]/pages/[idx]">) {
  const p = await ctx.params;
  const token = parseToken(p.token);
  const idx = Number(p.idx);
  return { token, idx: Number.isInteger(idx) && idx >= 0 && idx < 40 ? idx : null };
}

/** Upload one page image as the raw request body. Idempotent. */
export async function PUT(req: Request, ctx: RouteContext<"/api/applications/[token]/pages/[idx]">) {
  const { token, idx } = await parse(ctx);
  if (!token || idx === null) return errorJson(400, "invalid token or page index");
  const contentType = (req.headers.get("content-type") ?? "").split(";")[0];
  if (!TYPES.includes(contentType)) return errorJson(415, "image/jpeg, image/png or image/webp only");
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return errorJson(413, "image empty or too large");

  const store = getStore();
  const app = await store.get(token);
  if (!app) return errorJson(404, "create the application first");
  if (idx >= app.page_count) return errorJson(400, "page index beyond page_count");

  await store.putPage(token, idx, { bytes, contentType });
  const updated = await store.update(token, (a) => {
    if (a.pages_received.includes(idx)) return null;
    a.pages_received = [...a.pages_received, idx].sort((x, y) => x - y);
    return a;
  });
  return Response.json({ pages_received: updated?.pages_received ?? [] });
}

export async function GET(_req: Request, ctx: RouteContext<"/api/applications/[token]/pages/[idx]">) {
  const { token, idx } = await parse(ctx);
  if (!token || idx === null) return errorJson(400, "invalid token or page index");
  const page = await getStore().getPage(token, idx);
  if (!page) return errorJson(404, "not found");
  return new Response(page.bytes as BodyInit, {
    headers: { "Content-Type": page.contentType, "Cache-Control": "private, max-age=86400, immutable" },
  });
}
