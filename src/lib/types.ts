import { z } from "zod";
import { CATEGORY_CODES, DEPARTMENT_CODES } from "./reference";

// ---------------------------------------------------------------------------
// AI output schemas (PRD §7). These double as the structured-output formats
// sent to Claude, so keep them to JSON-Schema-friendly shapes.
// ---------------------------------------------------------------------------

export const Confidence = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof Confidence>;

/** Reader: page images → text + raw fields */
export const ReaderOutput = z.object({
  language: z.enum(["mr", "hi", "en", "other"]).describe("Main language of the letter"),
  pages: z.array(
    z.object({
      page_number: z.number().int().describe("1-based, in the order the images were given"),
      page_type: z.enum(["letter", "enclosure", "id_document", "photo", "envelope", "other"]),
      transcription: z.string().describe("Full transcription in the original script"),
    }),
  ),
  fields: z.object({
    applicant_name_original: z.string().nullable().describe("Applicant name exactly as written, original script"),
    applicant_name_roman: z.string().nullable().describe("Applicant name romanised (ISO-15919-lite, no diacritics)"),
    mobile: z.string().nullable().describe("Applicant mobile number as written; null if not legible"),
    address: z.string().nullable(),
    locality: z.string().nullable().describe("Village / ward / locality"),
    taluka: z.string().nullable(),
    district: z.string().nullable(),
    letter_date: z.string().nullable().describe("Date on the letter as YYYY-MM-DD, or null"),
    subject: z.string().nullable().describe("Subject line in the original language, or a short one if absent"),
    prior_follow_ups: z.array(z.string()).describe("Earlier applications/reminders the letter refers to"),
    attachments: z.array(z.string()).describe("Enclosures listed or visible"),
    signatories: z.array(z.string()).describe("Everyone who signed, original script"),
  }),
  confidence: z.object({
    applicant_name: Confidence,
    mobile: Confidence,
    address: Confidence,
    locality: Confidence,
    taluka: Confidence,
    district: Confidence,
    letter_date: Confidence,
    subject: Confidence,
  }),
  unclear: z
    .array(
      z.object({
        page_number: z.number().int(),
        field: z.string().nullable().describe("Field this affects, if any"),
        text: z.string().describe("The word/phrase as best seen, with ? for unreadable characters"),
      }),
    )
    .describe("Every word or number that could not be read with confidence"),
});
export type ReaderOutput = z.infer<typeof ReaderOutput>;

/** Reasoner: text + fields → summary, category, department, priority */
export const ReasonerOutput = z.object({
  summary_en: z.string().describe("2–4 sentence English summary for the Minister"),
  summary_local: z.string().describe("Same summary in the letter's own language"),
  category: z.enum(CATEGORY_CODES),
  department: z.enum(DEPARTMENT_CODES).describe("Primary department to route to"),
  secondary_departments: z.array(z.enum(DEPARTMENT_CODES)).describe("Other departments it also concerns"),
  priority: z.enum(["urgent", "high", "normal", "low"]),
  priority_reason: z.string(),
  confidence: z.object({ category: Confidence, department: Confidence }),
});
export type ReasonerOutput = z.infer<typeof ReasonerOutput>;

export interface Extraction {
  reader: ReaderOutput;
  reasoner: ReasonerOutput;
  engine: { reader: string; reasoner: string };
  timings_ms: { reader: number; reasoner: number };
  read_at: string;
}

// ---------------------------------------------------------------------------
// Verified (human-confirmed) record
// ---------------------------------------------------------------------------

export const VerifiedFields = z.object({
  applicant_name_original: z.string().nullable(),
  applicant_name_roman: z.string().nullable(),
  mobile: z.string().nullable(),
  address: z.string().nullable(),
  locality: z.string().nullable(),
  taluka: z.string().nullable(),
  district: z.string().nullable(),
  letter_date: z.string().nullable(),
  subject: z.string().nullable(),
  language: z.enum(["mr", "hi", "en", "other"]),
  summary_en: z.string(),
  summary_local: z.string(),
  category: z.enum(CATEGORY_CODES),
  department: z.enum(DEPARTMENT_CODES),
  secondary_departments: z.array(z.enum(DEPARTMENT_CODES)),
  priority: z.enum(["urgent", "high", "normal", "low"]),
  prior_follow_ups: z.array(z.string()),
  attachments: z.array(z.string()),
  signatories: z.array(z.string()),
});
export type VerifiedFields = z.infer<typeof VerifiedFields>;

export type ApplicationStatus =
  | "captured" // token issued, pages still arriving
  | "reading" // AI running
  | "read" // AI done, waiting for staff verification
  | "read_failed" // AI failed; staff can retry or fill manually
  | "routed" // verified, forwarded to the department, response clock running
  | "acknowledged" // department has acknowledged it
  | "in_progress" // department reports work in progress
  | "closed"; // resolved, with a closing remark

/** Statuses after staff verified and routed the application. */
export const ROUTED_STATUSES: readonly ApplicationStatus[] = ["routed", "acknowledged", "in_progress", "closed"];
/** Routed and still waiting for the department (counts toward "open" and "overdue"). */
export const OPEN_STATUSES: readonly ApplicationStatus[] = ["routed", "acknowledged", "in_progress"];
export const isRouted = (s: string) => (ROUTED_STATUSES as readonly string[]).includes(s);
export const isOpenCase = (s: string) => (OPEN_STATUSES as readonly string[]).includes(s);

export interface SmsRecord {
  to: string;
  language: string;
  body: string;
  provider: string;
  status: "sent" | "logged" | "failed" | "skipped";
  detail?: string;
  at: string;
}

/** Why an application was taken out of the queue (pilot clean-up of duplicates and test scans). */
export const ARCHIVE_REASONS = ["duplicate", "test", "mistake", "other"] as const;
export type ArchiveReason = (typeof ARCHIVE_REASONS)[number];

export interface ArchiveRecord {
  at: string;
  by: string;
  reason: ArchiveReason;
  note: string | null;
}

export interface AuditEntry {
  at: string;
  by: string;
  action: string;
  field?: string;
  from?: unknown;
  to?: unknown;
}

export interface Application {
  token: string;
  venue: string;
  captured_at: string;
  captured_by: string | null;
  page_count: number;
  pages_received: number[];
  /** Bumped on every rescan; used to bust image caches and drop stale AI reads. */
  pages_version?: number;
  status: ApplicationStatus;
  read_started_at: string | null;
  read_error: string | null;
  /** Machine-readable reason, so the UI can explain it in the user's language. */
  read_error_code?: "daily_limit" | "daily_limit_total" | null;
  extraction: Extraction | null;
  verified: VerifiedFields | null;
  verified_at: string | null;
  verified_by: string | null;
  sla_due_at: string | null;
  closing_remark: string | null;
  /** When and by whom it was resolved (also set for "resolved on the spot" at the Darbar). */
  resolved_at?: string | null;
  resolved_by?: string | null;
  resolved_on_spot?: boolean;
  /** Reminders sent to the department (recorded; delivery waits for SMS/email). */
  reminders_sent?: number;
  last_reminder_at?: string | null;
  sms: SmsRecord[];
  audit: AuditEntry[];
  /** Set while archived: hidden from the queue and counts, kept for the record, can be restored. */
  archived?: ArchiveRecord | null;
  updated_at: string;
}
