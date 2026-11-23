import "server-only";
import { dept } from "@/lib/reference";
import { isValidMobile, normaliseMobile } from "@/lib/token";
import { isOpenCase, isRouted, type Application, type ArchiveReason, type AuditEntry, type VerifiedFields } from "@/lib/types";
import type { DepartmentCode } from "@/lib/reference";
import { AIError, getReader, getReasoner, type PageImage } from "./ai";
import { AI_LIMIT_PER_USER, AI_LIMIT_TOTAL, ANONYMOUS, takeAiRead } from "./quota";
import { getSmsSender, tokenSms } from "./sms";
import { getStore } from "./store";

const READ_STALE_MS = 3 * 60_000;

export const allPagesReceived = (a: Application) =>
  a.page_count > 0 && Array.from({ length: a.page_count }, (_, i) => i).every((i) => a.pages_received.includes(i));

/** Atomically move an application into "reading". Returns false if it isn't ready or is already being read. */
export async function claimRead(token: string, force = false): Promise<boolean> {
  let claimed = false;
  await getStore().update(token, (a) => {
    if (a.archived || !allPagesReceived(a)) return null;
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
    a.read_error_code = null;
    return a;
  });
  return claimed;
}

/**
 * Run Reader then Reasoner. Caller must have claimed the read first.
 * `user` is who started the reading (signed-in mobile), for the per-person AI cap.
 */
export async function runRead(token: string, user: string = ANONYMOUS): Promise<void> {
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

    // Spend from today's AI allowance before any model call (the mock engine is free).
    const quota = reader.id === "mock" && reasoner.id === "mock" ? null : await takeAiRead(user);
    if (quota && !quota.ok) {
      const total = quota.reason === "total";
      await store.update(token, (a) => {
        if ((a.pages_version ?? 0) !== version) return null;
        a.status = "read_failed";
        a.read_error = total
          ? `Today's overall AI limit is reached (${AI_LIMIT_TOTAL} readings). Enter the details by hand, or read again tomorrow.`
          : `Daily AI limit reached for this person (${AI_LIMIT_PER_USER} readings). Another staff member can read it, or enter the details by hand.`;
        a.read_error_code = total ? "daily_limit_total" : "daily_limit";
        a.audit.push({ at: new Date().toISOString(), by: user, action: total ? "ai_daily_limit_total_reached" : "ai_daily_limit_reached" });
        return a;
      });
      return;
    }

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
      a.read_error_code = null;
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
      a.read_error_code = null;
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
    if (a.archived) throw new VerifyError("Archived — restore it first");
    if (isRouted(a.status)) {
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
export async function verifyApplication(
  token: string,
  fields: VerifiedFields,
  by: string,
  origin: string,
  onSpot?: { remark: string } | null,
) {
  const store = getStore();
  const now = new Date();
  fields = { ...fields, mobile: normaliseMobile(fields.mobile) };

  const updated = await store.update(token, (a) => {
    if (a.archived) throw new VerifyError("Archived — restore it first");
    if (isRouted(a.status)) {
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
    // PRD "Hear" step: the Minister (or officer present) settled it at the Darbar.
    if (onSpot) {
      a.status = "closed";
      a.closing_remark = onSpot.remark;
      a.resolved_at = at;
      a.resolved_by = by;
      a.resolved_on_spot = true;
      a.audit.push({ at, by, action: "resolved_on_the_spot", to: onSpot.remark });
    }
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

// ---------------------------------------------------------------- archive / delete (pilot clean-up)

/** Permanent delete is for the pilot's test data only; switched off unless PILOT_ALLOW_DELETE=1. */
export const pilotDeleteAllowed = () => process.env.PILOT_ALLOW_DELETE === "1";

/** Take an application out of the queue (duplicate, test scan, mistake). Kept on record; can be restored. */
export async function archiveApplication(token: string, reason: ArchiveReason, note: string | null, by: string) {
  return getStore().update(token, (a) => {
    if (a.archived) return null; // already archived — keep the first record
    const at = new Date().toISOString();
    a.archived = { at, by, reason, note };
    a.audit.push({ at, by, action: "archived", to: note ? `${reason}: ${note}` : reason });
    return a;
  });
}

export async function restoreApplication(token: string, by: string) {
  return getStore().update(token, (a) => {
    if (!a.archived) return null;
    a.audit.push({ at: new Date().toISOString(), by, action: "restored", from: a.archived.reason });
    a.archived = null;
    return a;
  });
}

/** Delete an archived application and its pages for good (pilot only). */
export async function deleteApplication(token: string, by: string): Promise<"deleted" | "not_found"> {
  if (!pilotDeleteAllowed()) throw new VerifyError("Permanent delete is switched off on this server");
  const store = getStore();
  const app = await store.get(token);
  if (!app) return "not_found";
  if (!app.archived) throw new VerifyError("Archive it first, then delete");
  await store.remove(token, by);
  return "deleted";
}

// ---------------------------------------------------------------- after routing (department follow-up)

export type ProgressAction =
  | { action: "acknowledge"; note?: string | null }
  | { action: "in_progress"; note?: string | null }
  | { action: "remind"; note?: string | null }
  | { action: "transfer"; department: DepartmentCode; reason: string }
  | { action: "resolve"; remark: string }
  | { action: "reopen"; reason: string };

/**
 * Record what the department did (pilot: office staff record it on the
 * department's behalf). Every step goes into the audit trail, which is the
 * timeline shown on the record and summarised on the citizen status page.
 */
export async function recordProgress(token: string, act: ProgressAction, by: string) {
  return getStore().update(token, (a) => {
    if (a.archived) throw new VerifyError("Archived — restore it first");
    if (!isRouted(a.status)) throw new VerifyError("Verify and route the application first");
    const at = new Date().toISOString();
    const open = isOpenCase(a.status);
    switch (act.action) {
      case "acknowledge":
        if (a.status !== "routed") throw new VerifyError("Only a newly forwarded application can be acknowledged");
        a.status = "acknowledged";
        a.audit.push({ at, by, action: "acknowledged", to: act.note || null });
        break;
      case "in_progress":
        if (!open) throw new VerifyError("Already resolved — reopen it first");
        a.status = "in_progress";
        a.audit.push({ at, by, action: "in_progress", to: act.note || null });
        break;
      case "remind":
        if (!open) throw new VerifyError("Already resolved");
        a.reminders_sent = (a.reminders_sent ?? 0) + 1;
        a.last_reminder_at = at;
        a.audit.push({ at, by, action: "reminder", to: act.note || null });
        break;
      case "transfer": {
        if (!open) throw new VerifyError("Already resolved — reopen it first");
        if (!a.verified) throw new VerifyError("No verified details");
        const from = a.verified.department;
        if (from === act.department) throw new VerifyError("Already with that department");
        const sla = dept(act.department)?.sla ?? 15;
        a.verified = {
          ...a.verified,
          department: act.department,
          secondary_departments: a.verified.secondary_departments.filter((d) => d !== act.department),
        };
        // The new department's response clock starts now.
        a.status = "routed";
        a.sla_due_at = new Date(Date.parse(at) + sla * 86_400_000).toISOString();
        a.audit.push({ at, by, action: "transferred", from, to: { department: act.department, reason: act.reason, sla_days: sla } });
        break;
      }
      case "resolve":
        if (!open) throw new VerifyError("Already resolved");
        a.status = "closed";
        a.closing_remark = act.remark;
        a.resolved_at = at;
        a.resolved_by = by;
        a.audit.push({ at, by, action: "resolved", to: act.remark });
        break;
      case "reopen":
        if (a.status !== "closed") throw new VerifyError("Not resolved");
        a.status = "in_progress";
        a.resolved_at = null;
        a.resolved_by = null;
        a.resolved_on_spot = false;
        a.audit.push({ at, by, action: "reopened", from: a.closing_remark, to: act.reason });
        a.closing_remark = null;
        break;
    }
    return a;
  });
}
