import "server-only";
import { dept } from "@/lib/reference";
import { isValidMobile, normaliseMobile } from "@/lib/token";
import type { Application, AuditEntry, VerifiedFields } from "@/lib/types";
import { AIError, getReader, getReasoner, type PageImage } from "./ai";
import { getSmsSender, tokenSms } from "./sms";
import { getStore } from "./store";

const READ_STALE_MS = 3 * 60_000;

export const allPagesReceived = (a: Application) =>
  a.page_count > 0 && Array.from({ length: a.page_count }, (_, i) => i).every((i) => a.pages_received.includes(i));

/** Atomically move an application into "reading". Returns false if it isn't ready or is already being read. */
export async function claimRead(token: string, force = false): Promise<boolean> {
  let claimed = false;
  await getStore().update(token, (a) => {
    if (!allPagesReceived(a)) return null;
    const stale = a.read_started_at && Date.now() - Date.parse(a.read_started_at) > READ_STALE_MS;
    const eligible =
      a.status === "captured" ||
      a.status === "read_failed" ||
      (a.status === "reading" && stale) ||
      (force && a.status === "read");
    if (!eligible) return null;
    claimed = true;
    a.status = "reading";
    a.read_started_at = new Date().toISOString();
    a.read_error = null;
    return a;
  });
  return claimed;
}

/** Run Reader then Reasoner. Caller must have claimed the read first. */
export async function runRead(token: string): Promise<void> {
  const store = getStore();
  let version = -1;
  try {
    const app = await store.get(token);
    if (!app) throw new Error("application not found");
    version = app.pages_version ?? 0;
    const pages: PageImage[] = [];
    for (let i = 0; i < app.page_count; i++) {
      const blob = await store.getPage(token, i);
      if (!blob) throw new Error(`page ${i + 1} missing`);
      const mediaType = (["image/png", "image/webp"].includes(blob.contentType) ? blob.contentType : "image/jpeg") as PageImage["mediaType"];
      pages.push({ index: i, mediaType, base64: Buffer.from(blob.bytes).toString("base64") });
    }

    const reader = getReader();
    const reasoner = getReasoner();
    const t0 = Date.now();
    const read = await reader.read(pages);
    const t1 = Date.now();

    // Devanagari digits → ASCII in the mobile field only (PRD §7.5). A number that
    // doesn't normalise to a valid Indian mobile is kept as read but flagged low.
    const rawMobile = read.fields.mobile;
    const mobile = normaliseMobile(rawMobile);
    if (rawMobile && rawMobile.includes("?")) {
      read.fields.mobile = null;
      read.confidence.mobile = "low";
    } else {
      read.fields.mobile = mobile;
      if (mobile && !isValidMobile(mobile)) read.confidence.mobile = "low";
    }

    const reasoned = await reasoner.reason(read);
    const t2 = Date.now();

    await store.update(token, (a) => {
      if ((a.pages_version ?? 0) !== version) return null; // pages were rescanned meanwhile — discard this read
      a.status = "read";
      a.read_error = null;
      a.extraction = {
        reader: read,
        reasoner: reasoned,
        engine: { reader: reader.id, reasoner: reasoner.id },
        timings_ms: { reader: t1 - t0, reasoner: t2 - t1 },
        read_at: new Date().toISOString(),
      };
      a.audit.push({ at: new Date().toISOString(), by: "system", action: `ai_read (${reader.id} / ${reasoner.id}, ${t2 - t0} ms)` });
      return a;
    });
  } catch (e) {
    const message = e instanceof AIError ? e.message : `AI reading failed: ${(e as Error).message}`;
    console.error(`[read] ${token}:`, e);
    await store.update(token, (a) => {
      if (a.status !== "reading" || (version >= 0 && (a.pages_version ?? 0) !== version)) return null; // rescanned meanwhile
      a.status = "read_failed";
      a.read_error = message;
      a.audit.push({ at: new Date().toISOString(), by: "system", action: "ai_read_failed", to: message });
      return a;
    });
  }
}

export class VerifyError extends Error {}

/**
 * Staff replace the page photos before verification (blurred, cropped or missing
 * page). Same token; pages are re-uploaded and read again. Not allowed once the
 * application has been verified and routed.
 */
export async function startRescan(token: string, pageCount: number, by: string) {
  return getStore().update(token, (a) => {
    if (a.status === "routed" || a.status === "in_progress" || a.status === "closed") {
      throw new VerifyError("Already verified — pages can no longer be replaced");
    }
    const stale = a.read_started_at && Date.now() - Date.parse(a.read_started_at) > READ_STALE_MS;
    if (a.status === "reading" && !stale) throw new VerifyError("AI is reading this application — try again in a moment");
    a.audit.push({ at: new Date().toISOString(), by, action: "rescan", from: a.page_count, to: pageCount });
    a.page_count = pageCount;
    a.pages_received = [];
    a.pages_version = (a.pages_version ?? 0) + 1;
    a.status = "captured";
    a.extraction = null;
    a.read_error = null;
    a.read_started_at = null;
    return a;
  });
}

const FIELD_SOURCES: Record<keyof VerifiedFields, (a: Application) => unknown> = {
  applicant_name_original: (a) => a.extraction?.reader.fields.applicant_name_original ?? null,
  applicant_name_roman: (a) => a.extraction?.reader.fields.applicant_name_roman ?? null,
  mobile: (a) => a.extraction?.reader.fields.mobile ?? null,
  address: (a) => a.extraction?.reader.fields.address ?? null,
  locality: (a) => a.extraction?.reader.fields.locality ?? null,
  taluka: (a) => a.extraction?.reader.fields.taluka ?? null,
  district: (a) => a.extraction?.reader.fields.district ?? null,
  letter_date: (a) => a.extraction?.reader.fields.letter_date ?? null,
  subject: (a) => a.extraction?.reader.fields.subject ?? null,
  language: (a) => a.extraction?.reader.language ?? null,
  summary_en: (a) => a.extraction?.reasoner.summary_en ?? null,
  summary_local: (a) => a.extraction?.reasoner.summary_local ?? null,
  category: (a) => a.extraction?.reasoner.category ?? null,
  department: (a) => a.extraction?.reasoner.department ?? null,
  secondary_departments: (a) => a.extraction?.reasoner.secondary_departments ?? [],
  priority: (a) => a.extraction?.reasoner.priority ?? null,
  prior_follow_ups: (a) => a.extraction?.reader.fields.prior_follow_ups ?? [],
  attachments: (a) => a.extraction?.reader.fields.attachments ?? [],
  signatories: (a) => a.extraction?.reader.fields.signatories ?? [],
};

/**
 * Human confirmation (PRD §4.1 #4): nothing is saved as the application's
 * record until staff confirm. Logs every edit against the AI value, routes to
 * the department with its SLA clock, and sends the token SMS.
 */
export async function verifyApplication(token: string, fields: VerifiedFields, by: string, origin: string) {
  const store = getStore();
  const now = new Date();
  fields = { ...fields, mobile: normaliseMobile(fields.mobile) };

  const updated = await store.update(token, (a) => {
    if (a.status === "routed" || a.status === "in_progress" || a.status === "closed") {
      throw new VerifyError("Already verified");
    }
    const at = now.toISOString();
    const audit: AuditEntry[] = [];
    for (const key of Object.keys(FIELD_SOURCES) as (keyof VerifiedFields)[]) {
      const ai = FIELD_SOURCES[key](a);
      const final = fields[key];
      if (JSON.stringify(ai ?? null) !== JSON.stringify(final ?? null)) {
        audit.push({ at, by, action: "field_edited", field: key, from: ai, to: final });
      }
    }
    const sla = dept(fields.department)?.sla ?? 15;
    a.verified = fields;
    a.verified_at = at;
    a.verified_by = by;
    a.status = "routed";
    a.sla_due_at = new Date(now.getTime() + sla * 86_400_000).toISOString();
    a.audit.push(...audit, {
      at,
      by,
      action: "verified_and_routed",
      to: { department: fields.department, secondary: fields.secondary_departments, sla_days: sla },
    });
    return a;
  });
  if (!updated) throw new VerifyError("Application not found");

  // SMS after the record is safely saved.
  const sender = getSmsSender();
  const trackUrl = `${origin}/track?t=${encodeURIComponent(token)}`;
  const body = tokenSms(fields.language, token, trackUrl);
  let sms;
  if (!isValidMobile(fields.mobile)) {
    sms = { to: fields.mobile ?? "", language: fields.language, body, provider: sender.name, status: "skipped" as const, detail: "No valid mobile number", at: new Date().toISOString() };
  } else {
    try {
      const r = await sender.send(fields.mobile!, body);
      sms = { to: fields.mobile!, language: fields.language, body, provider: sender.name, ...r, at: new Date().toISOString() };
    } catch (e) {
      sms = { to: fields.mobile!, language: fields.language, body, provider: sender.name, status: "failed" as const, detail: (e as Error).message, at: new Date().toISOString() };
    }
  }
  return store.update(token, (a) => {
    a.sms.push(sms);
    a.audit.push({ at: sms.at, by: "system", action: `sms_${sms.status}`, to: sms.to });
    return a;
  });
}
