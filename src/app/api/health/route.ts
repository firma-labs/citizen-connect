import { connection } from "next/server";
import { getReader, getReasoner } from "@/lib/server/ai";
import { getStore } from "@/lib/server/store";
import { getMessageSender } from "@/lib/server/whatsapp";
import { ANONYMOUS, aiUsageToday } from "@/lib/server/quota";
import { authMode, sessionFromRequest } from "@/lib/server/auth";
import { pilotDeleteAllowed } from "@/lib/server/pipeline";

export async function GET(req: Request) {
  await connection();
  return Response.json({
    ok: true,
    store: getStore().name,
    reader: getReader().id,
    reasoner: getReasoner().id,
    whatsapp: getMessageSender().name,
    ai_today: await aiUsageToday(sessionFromRequest(req)?.mobile ?? ANONYMOUS),
    auth: authMode(),
    /** Pilot only: archived applications can be deleted permanently. */
    pilot_delete: pilotDeleteAllowed(),
    time: new Date().toISOString(),
  });
}
