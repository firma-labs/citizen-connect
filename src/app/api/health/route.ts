import { connection } from "next/server";
import { getReader, getReasoner } from "@/lib/server/ai";
import { getStore } from "@/lib/server/store";
import { getSmsSender } from "@/lib/server/sms";
import { aiUsageToday } from "@/lib/server/quota";
import { authMode } from "@/lib/server/auth";

export async function GET() {
  await connection();
  return Response.json({
    ok: true,
    store: getStore().name,
    reader: getReader().id,
    reasoner: getReasoner().id,
    sms: getSmsSender().name,
    ai_today: await aiUsageToday(),
    auth: authMode(),
    time: new Date().toISOString(),
  });
}
