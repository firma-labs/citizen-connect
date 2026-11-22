import { connection } from "next/server";
import { getReader, getReasoner } from "@/lib/server/ai";
import { getStore } from "@/lib/server/store";
import { getSmsSender } from "@/lib/server/sms";

export async function GET() {
  await connection();
  return Response.json({
    ok: true,
    store: getStore().name,
    reader: getReader().id,
    reasoner: getReasoner().id,
    sms: getSmsSender().name,
    time: new Date().toISOString(),
  });
}
