"use client";

import { useI18n, type MessageKey } from "@/lib/i18n";
import { PRIORITIES, category, dept, refLabel } from "@/lib/reference";
import type { Application, ReadingLive } from "@/lib/types";

/**
 * Check details while the AI reads: what it has produced so far, as it
 * produces it (saved by the server every second or so; see ReadingLive).
 * The transcription appears first, then the details, then the summary and
 * the department - the order the model writes them in.
 */
export function LiveReading({ app }: { app: Application }) {
  const { t, num, locale } = useI18n();
  const live = app.reading_live ?? null;
  const waitingForPages = app.pages_received.length < app.page_count;
  const reader = live?.reader ?? null;
  const reasoner = live?.stage === "reasoner" ? live.reasoner : null;
  const pages = (reader?.pages ?? []).filter((p) => p && typeof p.transcription === "string");
  const fields = reader?.fields ?? null;
  const current = pages.length ? pages[pages.length - 1] : null;
  const language = typeof reader?.language === "string" ? reader.language : undefined;

  const stage: string = waitingForPages
    ? t("verify.reading.wait", { a: app.pages_received.length, b: app.page_count })
    : live?.stage === "reasoner"
      ? t("verify.live.routing")
      : fields
        ? t("verify.live.details")
        : current
          ? t("verify.live.page", { n: num(pages.length), total: num(app.page_count) })
          : t("verify.live.opening");

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  const FIELDS: { label: MessageKey; value: unknown }[] = [
    { label: "field.nameOriginal", value: fields?.applicant_name_original },
    { label: "field.mobile.label", value: fields?.mobile },
    { label: "field.address", value: fields?.address },
    { label: "field.taluka", value: fields?.taluka },
    { label: "field.district", value: fields?.district },
    { label: "field.subject", value: fields?.subject },
  ];
  const catCode = str(reasoner?.category);
  const deptCode = str(reasoner?.department);
  const prio = str(reasoner?.priority);
  const ROUTING: { label: MessageKey; value: string | null }[] = [
    { label: "field.summaryLocal", value: str(reasoner?.summary_local) },
    { label: "field.category", value: catCode ? refLabel(category(catCode), locale) || null : null },
    { label: "field.department", value: deptCode ? refLabel(dept(deptCode), locale) || null : null },
    { label: "field.priority.label", value: prio ? refLabel(PRIORITIES.find((p) => p.code === prio), locale) || null : null },
  ];
  // The last few lines of the page being read, as they arrive.
  const tail = current?.transcription ? current.transcription.slice(-260) : "";

  return (
    <section className="overflow-hidden rounded-[var(--radius-panel)] bg-surface-container" aria-labelledby="live-title">
      <div className="flex items-center gap-3 bg-gradient-to-r from-indigo-50 via-sky-50 to-mint-50 px-5 py-4">
        <span className="ai-spark grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-on-primary" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9zM19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" />
          </svg>
        </span>
        <div className="min-w-0" role="status" aria-live="polite">
          <h2 id="live-title" className="font-bold leading-tight">
            {t("verify.reading.title")}
          </h2>
          <p className="text-[0.92rem] text-ink-2">{stage}</p>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {/* Transcription, as it is read */}
        {tail && !fields && (
          <p lang={language} className="live-text max-h-40 overflow-hidden whitespace-pre-line rounded-[var(--radius-control)] bg-surface px-4 py-3 text-[0.98rem] leading-relaxed text-ink-2">
            {tail.length >= 260 ? "…" : ""}
            {tail}
            <span className="live-caret" aria-hidden />
          </p>
        )}

        <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <LiveField key={f.label} label={t(f.label)} value={str(f.value)} lang={language} wide={f.label === "field.subject" || f.label === "field.address"} />
          ))}
        </dl>

        {(live?.stage === "reasoner" || fields) && (
          <dl className="grid gap-x-5 gap-y-3 border-t border-rule pt-4 sm:grid-cols-2">
            {ROUTING.map((f) => (
              <LiveField key={f.label} label={t(f.label)} value={live?.stage === "reasoner" ? f.value : null} lang={f.label === "field.summaryLocal" ? language : undefined} wide={f.label === "field.summaryLocal"} />
            ))}
          </dl>
        )}

        <p className="text-[0.88rem] text-ink-3">{t("verify.reading.body")}</p>
      </div>
    </section>
  );
}

function LiveField({ label, value, lang, wide }: { label: string; value: string | null; lang?: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-[0.85rem] font-semibold text-ink-3">{label}</dt>
      <dd lang={lang} className="mt-0.5 min-h-6">
        {value ? <span className="live-in block break-words font-medium">{value}</span> : <span className="live-shimmer block h-5 w-3/4 rounded-full" aria-hidden />}
      </dd>
    </div>
  );
}

/** The scan band that sweeps over a page while it is being read. Decorative. */
export function ScanBand() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <span className="scan-band" />
    </span>
  );
}

/** Which page (0-based) the reading is on, from the live snapshot; null before it starts. */
export function livePage(live: ReadingLive | null | undefined, pageCount: number): number | null {
  if (!live || live.stage !== "reader") return null;
  const pages = (live.reader?.pages ?? []).filter((p) => p && typeof p.transcription === "string");
  if (live.reader?.fields) return null; // past the pages, onto the details
  return Math.min(Math.max(pages.length - 1, 0), pageCount - 1);
}
