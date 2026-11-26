"use client";

import { useI18n, type MessageKey } from "@/lib/i18n";
import { dept, refLabel } from "@/lib/reference";
import type { AuditEntry } from "@/lib/types";

type Tone = "sky" | "violet" | "mint" | "peach" | "rose" | "ink";
const DOT: Record<Tone, string> = {
  sky: "bg-sky-500",
  violet: "bg-indigo-600",
  mint: "bg-mint-500",
  peach: "bg-marigold-500",
  rose: "bg-red-500",
  ink: "bg-ink-3",
};

/**
 * The application's history as plain sentences ("Forwarded to NMMC (15-day
 * response time)", "Acknowledged by the department", …), newest last — built
 * from the audit trail. Individual field corrections are grouped into one line.
 */
export function Timeline({ audit }: { audit: AuditEntry[] }) {
  const { t, date, locale } = useI18n();
  const deptName = (code: unknown) => refLabel(dept(String(code)), locale) || String(code);
  const text = (k: MessageKey, v?: Record<string, string | number>) => t(k, v);

  const rows: { at: string; by: string; tone: Tone; title: string; note?: string | null }[] = [];
  const edits = audit.filter((a) => a.action === "field_edited");
  for (const a of audit) {
    const note = typeof a.to === "string" ? a.to : null;
    switch (true) {
      case a.action === "token_issued":
        rows.push({ at: a.at, by: a.by, tone: "ink", title: text("timeline.received") });
        break;
      case a.action.startsWith("ai_read ("):
        rows.push({ at: a.at, by: a.by, tone: "ink", title: text("timeline.aiRead") });
        break;
      case a.action === "ai_read_failed":
        rows.push({ at: a.at, by: a.by, tone: "rose", title: text("timeline.aiFailed") });
        break;
      case a.action === "rescan":
        rows.push({ at: a.at, by: a.by, tone: "ink", title: text("timeline.rescan") });
        break;
      case a.action === "verified_and_routed": {
        const to = a.to as { department?: string; sla_days?: number } | undefined;
        if (edits.length) rows.push({ at: a.at, by: a.by, tone: "ink", title: text("timeline.edited", { n: edits.length }) });
        rows.push({ at: a.at, by: a.by, tone: "sky", title: text("timeline.forwarded", { dept: deptName(to?.department), days: to?.sla_days ?? 0 }) });
        break;
      }
      case a.action.startsWith("whatsapp_"): {
        const status = a.action.slice("whatsapp_".length) as "sent" | "logged" | "skipped" | "failed";
        rows.push({ at: a.at, by: a.by, tone: "ink", title: text(`timeline.whatsapp.${status}`) });
        break;
      }
      // Applications saved before WhatsApp replaced SMS.
      case a.action.startsWith("sms_"):
        rows.push({ at: a.at, by: a.by, tone: "ink", title: text(a.action === "sms_sent" ? "timeline.smsSent" : a.action === "sms_skipped" ? "timeline.smsSkipped" : "timeline.smsLogged") });
        break;
      case a.action === "acknowledged":
        rows.push({ at: a.at, by: a.by, tone: "sky", title: text("timeline.acknowledged"), note });
        break;
      case a.action === "in_progress":
        rows.push({ at: a.at, by: a.by, tone: "violet", title: text("timeline.inProgress"), note });
        break;
      case a.action === "reminder":
        rows.push({ at: a.at, by: a.by, tone: "peach", title: text("timeline.reminder"), note });
        break;
      case a.action === "transferred": {
        const to = a.to as { department?: string; reason?: string; sla_days?: number } | undefined;
        rows.push({
          at: a.at,
          by: a.by,
          tone: "sky",
          title: text("timeline.transferred", { from: deptName(a.from), to: deptName(to?.department), days: to?.sla_days ?? 0 }),
          note: to?.reason,
        });
        break;
      }
      case a.action === "resolved":
        rows.push({ at: a.at, by: a.by, tone: "mint", title: text("timeline.resolved"), note });
        break;
      case a.action === "resolved_on_the_spot":
        rows.push({ at: a.at, by: a.by, tone: "mint", title: text("timeline.resolvedOnSpot"), note });
        break;
      case a.action === "reopened":
        rows.push({ at: a.at, by: a.by, tone: "peach", title: text("timeline.reopened"), note });
        break;
      case a.action === "archived":
        rows.push({ at: a.at, by: a.by, tone: "rose", title: text("timeline.archived"), note: typeof a.to === "string" ? a.to : null });
        break;
      case a.action === "restored":
        rows.push({ at: a.at, by: a.by, tone: "ink", title: text("timeline.restored") });
        break;
    }
  }

  return (
    <ol className="relative ml-1.5 space-y-4 border-l-2 border-surface pl-5">
      {rows.map((r, i) => (
        <li key={i} className="relative">
          <span aria-hidden className={`absolute -left-[1.6rem] top-1.5 h-3 w-3 rounded-full ring-4 ring-surface-container ${DOT[r.tone]}`} />
          <p className="font-semibold leading-snug">{r.title}</p>
          {r.note && <p className="mt-0.5 text-ink-2">“{r.note}”</p>}
          <p className="mt-0.5 text-[0.85rem] text-ink-3">
            {date(r.at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
            {r.by && r.by !== "system" && r.by !== "device" ? ` · ${r.by}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}
