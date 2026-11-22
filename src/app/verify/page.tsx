"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { RescanPanel } from "@/components/RescanPanel";
import { AppBar, Screen } from "@/components/ui/AppBar";
import { Button } from "@/components/ui/Button";
import { Field, SectionTitle, inputClass, type Attention } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { StatusTag } from "@/components/ui/StatusTag";
import { useSettings } from "@/lib/client/settings";
import { fetchApplication, requestRead, syncNow } from "@/lib/client/sync";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { CATEGORIES, DEPARTMENTS, LANGUAGES, PAGE_TYPES, PRIORITIES, dept, refLabel } from "@/lib/reference";
import { isValidMobile, normaliseMobile } from "@/lib/token";
import type { Application, Confidence, VerifiedFields } from "@/lib/types";

export default function VerifyPage() {
  return (
    <Suspense fallback={<AppBar title="verify.title" back="/queue" />}>
      <Verify />
    </Suspense>
  );
}

const EMPTY: VerifiedFields = {
  applicant_name_original: null,
  applicant_name_roman: null,
  mobile: null,
  address: null,
  locality: null,
  taluka: null,
  district: null,
  letter_date: null,
  subject: null,
  language: "mr",
  summary_en: "",
  summary_local: "",
  category: "other",
  department: "OTH",
  secondary_departments: [],
  priority: "normal",
  prior_follow_ups: [],
  attachments: [],
  signatories: [],
};

function fromExtraction(app: Application): VerifiedFields {
  const x = app.extraction;
  if (!x) return EMPTY;
  const f = x.reader.fields;
  return {
    applicant_name_original: f.applicant_name_original,
    applicant_name_roman: f.applicant_name_roman,
    mobile: f.mobile,
    address: f.address,
    locality: f.locality,
    taluka: f.taluka,
    district: f.district,
    letter_date: f.letter_date,
    subject: f.subject,
    language: x.reader.language,
    summary_en: x.reasoner.summary_en,
    summary_local: x.reasoner.summary_local,
    category: x.reasoner.category,
    department: x.reasoner.department,
    secondary_departments: x.reasoner.secondary_departments,
    priority: x.reasoner.priority,
    prior_follow_ups: f.prior_follow_ups,
    attachments: f.attachments,
    signatories: f.signatories,
  };
}

/** Fields that can carry an AI confidence, in reading order, with their labels. */
const CHECKABLE: { key: keyof VerifiedFields; label: MessageKey }[] = [
  { key: "applicant_name_original", label: "field.nameOriginal" },
  { key: "applicant_name_roman", label: "field.nameRoman" },
  { key: "mobile", label: "field.mobile" },
  { key: "address", label: "field.address" },
  { key: "locality", label: "field.locality" },
  { key: "taluka", label: "field.taluka" },
  { key: "district", label: "field.district" },
  { key: "letter_date", label: "field.date" },
  { key: "subject", label: "field.subject" },
  { key: "category", label: "field.category" },
  { key: "department", label: "field.department" },
];

/** The AI names fields in English ("address", "mobile"); show the UI's own label instead. */
const UNCLEAR_LABELS: Record<string, MessageKey> = {
  applicant_name: "field.nameOriginal",
  applicant_name_original: "field.nameOriginal",
  applicant_name_roman: "field.nameRoman",
  name: "field.nameOriginal",
  mobile: "field.mobile",
  address: "field.address",
  locality: "field.locality",
  taluka: "field.taluka",
  district: "field.district",
  letter_date: "field.date",
  date: "field.date",
  subject: "field.subject",
  signatories: "field.signatories",
  attachments: "field.attachments",
};

const toAttention = (c: Confidence | undefined): Attention => (c === "low" ? "low" : c === "medium" ? "medium" : undefined);

function Verify() {
  const token = useSearchParams().get("t") ?? "";
  const [settings] = useSettings();
  const { t, date, locale } = useI18n();
  const [app, setApp] = useState<Application | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<VerifiedFields | null>(null);
  const [manual, setManual] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);
  const [viewing, setViewing] = useState(0);
  const [rescanning, setRescanning] = useState(false);
  const [pollKey, setPollKey] = useState(0);
  const [seededFrom, setSeededFrom] = useState<string | null>(null); // read_at of the AI result in the form

  const load = useCallback(async () => {
    try {
      const a: Application = await fetchApplication(token);
      setApp(a);
      setLoadError(null);
      return a;
    } catch (e) {
      setLoadError((e as Error).message);
      return null;
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const a = await load();
      if (stop) return;
      if (!a || a.status === "captured" || a.status === "reading") timer = setTimeout(tick, 3000);
    };
    void tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [token, load, pollKey]);

  // Fill the form from each new AI result — the first one, and again after a rescan
  // or retry. Adjusting state during render (not in an effect) avoids a second pass.
  const readAt = app?.extraction?.read_at ?? null;
  if (app?.status === "read" && readAt && readAt !== seededFrom) {
    setSeededFrom(readAt);
    setForm(fromExtraction(app));
    setConfirmed(false);
  }

  const attentionOf = useMemo(() => {
    const c = app?.extraction?.reader.confidence;
    const r = app?.extraction?.reasoner.confidence;
    const map: Partial<Record<keyof VerifiedFields, Confidence | undefined>> = {
      applicant_name_original: c?.applicant_name,
      applicant_name_roman: c?.applicant_name,
      mobile: c?.mobile,
      address: c?.address,
      locality: c?.locality,
      taluka: c?.taluka,
      district: c?.district,
      letter_date: c?.letter_date,
      subject: c?.subject,
      category: r?.category,
      department: r?.department,
    };
    return (k: keyof VerifiedFields) => toAttention(map[k]);
  }, [app]);

  if (!token) {
    return (
      <>
        <AppBar title="verify.title" back="/queue" />
        <Screen>
          <Notice tone="error">{t("verify.notOnServer")}</Notice>
        </Screen>
      </>
    );
  }

  const set = <K extends keyof VerifiedFields>(k: K, v: VerifiedFields[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  async function save() {
    if (!form || !confirmed) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/applications/${encodeURIComponent(token)}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { ...form, mobile: normaliseMobile(form.mobile) }, staff: settings.staff || "unknown", confirmed: true }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      setApp(body.application);
      void syncNow();
      window.scrollTo({ top: 0 });
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const status = app?.status;
  // ?v= busts the browser's image cache after a rescan replaces the pages.
  const pageUrls = app
    ? Array.from({ length: app.page_count }, (_, i) => `/api/applications/${encodeURIComponent(token)}/pages/${i}?v=${app.pages_version ?? 0}`)
    : [];
  const canRescan = status === "read" || status === "read_failed" || status === "captured";
  const showForm = !rescanning && !!form && (status === "read" || (status === "read_failed" && manual));
  const done = status === "routed" || status === "in_progress" || status === "closed";
  const pageType = (i: number) => {
    const code = app?.extraction?.reader.pages[i]?.page_type;
    return code ? refLabel(PAGE_TYPES.find((p) => p.code === code), locale) : null;
  };
  const flagged = form && app?.extraction ? CHECKABLE.filter((f) => attentionOf(f.key)) : [];
  const mobileNorm = form ? normaliseMobile(form.mobile) : null;

  return (
    <>
      <AppBar title="verify.title" back="/queue" />
      <Screen wide>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="token text-[1.5rem]">{token}</h1>
          {status && <StatusTag status={status} />}
        </div>

        {loadError && !app && <Notice tone="error">{loadError === "not found" ? t("verify.notOnServer") : loadError}</Notice>}

        <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start lg:gap-8">
          {/* Letter pages: a strip on phones, a large side-by-side viewer on wide screens */}
          {pageUrls.length > 0 && (
            <aside className="mb-5 lg:sticky lg:top-20 lg:mb-0">
              <h2 className="sr-only">{t("verify.pages")}</h2>
              <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 lg:hidden">
                {pageUrls.map((u, i) => (
                  <button
                    key={u}
                    onClick={() => setZoom(i)}
                    aria-label={t("verify.openPage", { n: i + 1 })}
                    className="relative w-36 shrink-0 snap-start overflow-hidden rounded-[var(--radius-control)] border border-rule bg-surface"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- API image */}
                    <img src={u} alt="" className="aspect-[3/4] w-full object-cover" loading="lazy" />
                    <span className="absolute left-2 top-2 grid h-7 min-w-7 place-items-center rounded-full bg-ink px-2 text-[0.85rem] font-bold text-white">{i + 1}</span>
                    {pageType(i) && <span className="absolute inset-x-0 bottom-0 bg-ink/75 px-2 py-0.5 text-[0.8rem] text-white">{pageType(i)}</span>}
                  </button>
                ))}
              </div>
              <div className="hidden lg:block">
                <button
                  onClick={() => setZoom(viewing)}
                  aria-label={t("verify.openPage", { n: viewing + 1 })}
                  className="block w-full overflow-hidden rounded-[var(--radius-panel)] border border-rule bg-surface"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- API image */}
                  <img src={pageUrls[Math.min(viewing, pageUrls.length - 1)]} alt="" className="max-h-[calc(100vh-11rem)] w-full object-contain" />
                </button>
                {pageUrls.length > 1 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pageUrls.map((u, i) => (
                      <button
                        key={u}
                        onClick={() => setViewing(i)}
                        aria-current={viewing === i}
                        className={`h-11 min-w-11 rounded-full px-3 font-semibold ${viewing === i ? "bg-ink text-white" : "bg-surface text-ink ring-1 ring-rule-strong"}`}
                      >
                        {i + 1}
                        {pageType(i) ? <span className="ml-1.5 font-normal opacity-80">{pageType(i)}</span> : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {canRescan && !rescanning && app && app.pages_received.length === app.page_count && (
                <Button variant="secondary" icon="camera" block className="mt-3" onClick={() => setRescanning(true)}>
                  {t("verify.rescan")}
                </Button>
              )}
            </aside>
          )}

          <div className="min-w-0">
            {rescanning && (
              <RescanPanel
                token={token}
                pageUrls={pageUrls}
                onCancel={() => setRescanning(false)}
                onDone={() => {
                  setRescanning(false);
                  setForm(null);
                  setManual(false);
                  setConfirmed(false);
                  setPollKey((k) => k + 1);
                  window.scrollTo({ top: 0 });
                }}
              />
            )}

            {!rescanning && (status === "captured" || status === "reading") && (
              <div className="flex items-start gap-4 rounded-[var(--radius-panel)] border border-rule bg-surface p-5" role="status">
                <span className="mt-1 h-8 w-8 shrink-0 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-700" aria-hidden />
                <div>
                  <p className="font-bold">{t("verify.reading.title")}</p>
                  <p className="text-ink-2">
                    {app && app.pages_received.length < app.page_count
                      ? t("verify.reading.wait", { a: app.pages_received.length, b: app.page_count })
                      : t("verify.reading.body")}
                  </p>
                </div>
              </div>
            )}

            {!rescanning && status === "read_failed" && !form && (
              <Notice tone="error" title={t("verify.failed.title")}>
                <p>{app?.read_error}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button icon="refresh" onClick={() => void requestRead(token).then(load)}>
                    {t("verify.failed.retry")}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setManual(true);
                      setForm(EMPTY);
                    }}
                  >
                    {t("verify.failed.manual")}
                  </Button>
                </div>
              </Notice>
            )}

            {done && app && renderSaved(app)}

            {showForm && form && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
                className="space-y-8"
              >
                {app?.extraction && (
                  renderAttention(flagged, app.extraction.reader.unclear)
                )}

                <section className="space-y-5">
                  <SectionTitle k="section.applicant" />
                  <TextField id="applicant_name_original" label="field.nameOriginal" form={form} set={set} attention={attentionOf("applicant_name_original")} />
                  <TextField id="applicant_name_roman" label="field.nameRoman" form={form} set={set} attention={attentionOf("applicant_name_roman")} />
                  <TextField
                    id="mobile"
                    label="field.mobile"
                    form={form}
                    set={set}
                    attention={attentionOf("mobile")}
                    inputMode="tel"
                    error={form.mobile && !isValidMobile(mobileNorm) ? t("field.mobile.invalid") : undefined}
                    help={!form.mobile ? <span className="text-marigold-700">{t("field.mobile.missing")}</span> : undefined}
                  />
                  <TextField id="address" label="field.address" form={form} set={set} attention={attentionOf("address")} multiline />
                  <div className="grid gap-5 sm:grid-cols-2">
                    <TextField id="locality" label="field.locality" form={form} set={set} attention={attentionOf("locality")} />
                    <TextField id="taluka" label="field.taluka" form={form} set={set} attention={attentionOf("taluka")} />
                  </div>
                  <TextField id="district" label="field.district" form={form} set={set} attention={attentionOf("district")} />
                </section>

                <section className="space-y-5">
                  <SectionTitle k="section.letter" />
                  <div className="grid gap-5 sm:grid-cols-2">
                    <TextField id="letter_date" label="field.date" form={form} set={set} attention={attentionOf("letter_date")} type="date" />
                    <Field id="language" label="field.language">
                      <select id="language" value={form.language} onChange={(e) => set("language", e.target.value as VerifiedFields["language"])} className={inputClass()}>
                        {LANGUAGES.map((l) => (
                          <option key={l.code} value={l.code}>
                            {refLabel(l, locale)}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <TextField id="subject" label="field.subject" form={form} set={set} attention={attentionOf("subject")} multiline />
                  <Field id="summary_en" label="field.summaryEn">
                    <textarea id="summary_en" lang="en" rows={5} value={form.summary_en} onChange={(e) => set("summary_en", e.target.value)} className={inputClass()} />
                  </Field>
                  <Field id="summary_local" label="field.summaryLocal">
                    <textarea id="summary_local" rows={5} value={form.summary_local} onChange={(e) => set("summary_local", e.target.value)} className={inputClass()} />
                  </Field>
                </section>

                <section className="space-y-5">
                  <SectionTitle k="section.routing" />
                  <Field id="category" label="field.category" attention={attentionOf("category")}>
                    <select id="category" value={form.category} onChange={(e) => set("category", e.target.value as VerifiedFields["category"])} className={inputClass(attentionOf("category"))}>
                      {CATEGORIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {refLabel(c, locale)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field id="department" label="field.department" attention={attentionOf("department")}>
                    <select id="department" value={form.department} onChange={(e) => set("department", e.target.value as VerifiedFields["department"])} className={inputClass(attentionOf("department"))}>
                      {DEPARTMENTS.map((d) => (
                        <option key={d.code} value={d.code}>
                          {refLabel(d, locale)} — {t("field.days", { d: d.sla })}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <fieldset>
                    <legend className="font-semibold">{t("field.secondary")}</legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {DEPARTMENTS.filter((d) => d.code !== form.department).map((d) => {
                        const on = form.secondary_departments.includes(d.code);
                        return (
                          <button
                            type="button"
                            key={d.code}
                            aria-pressed={on}
                            title={refLabel(d, locale)}
                            onClick={() =>
                              set("secondary_departments", on ? form.secondary_departments.filter((x) => x !== d.code) : [...form.secondary_departments, d.code])
                            }
                            className={`flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-[0.92rem] font-semibold ${on ? "bg-indigo-700 text-white" : "bg-surface text-ink ring-1 ring-inset ring-rule-strong"}`}
                          >
                            {on && <Icon name="check" size={16} />}
                            {refLabel(d, locale)}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  <Field
                    id="priority"
                    label="field.priority"
                    help={app?.extraction?.reasoner.priority_reason ? t("field.priority.reason", { r: app.extraction.reasoner.priority_reason }) : undefined}
                  >
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup">
                      {PRIORITIES.map((p) => (
                        <label
                          key={p.code}
                          className={`flex min-h-12 cursor-pointer items-center justify-center rounded-[var(--radius-control)] px-3 font-semibold ${form.priority === p.code ? (p.code === "urgent" ? "bg-red-600 text-white" : "bg-indigo-700 text-white") : "bg-surface ring-1 ring-inset ring-rule-strong"}`}
                        >
                          <input type="radio" name="priority" value={p.code} checked={form.priority === p.code} onChange={() => set("priority", p.code)} className="sr-only" />
                          {refLabel(p, locale)}
                        </label>
                      ))}
                    </div>
                  </Field>
                </section>

                <section className="space-y-5">
                  <SectionTitle k="section.other" />
                  <Lines id="prior_follow_ups" label="field.followUps" value={form.prior_follow_ups} onChange={(v) => set("prior_follow_ups", v)} />
                  <Lines id="attachments" label="field.attachments" value={form.attachments} onChange={(v) => set("attachments", v)} />
                  <Lines id="signatories" label="field.signatories" value={form.signatories} onChange={(v) => set("signatories", v)} />
                </section>

                {app?.extraction && (
                  <details className="rounded-[var(--radius-panel)] border border-rule bg-surface">
                    <summary className="flex min-h-14 cursor-pointer items-center gap-2 px-4 font-semibold">
                      <Icon name="doc" className="text-indigo-700" />
                      {t("verify.transcription")}
                    </summary>
                    <div className="space-y-4 border-t border-rule p-4">
                      {app.extraction.reader.pages.map((p) => (
                        <div key={p.page_number}>
                          <p className="text-[0.9rem] font-semibold text-ink-3">
                            {t("capture.page", { n: p.page_number })} · {refLabel(PAGE_TYPES.find((x) => x.code === p.page_type), locale)}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap leading-relaxed">{p.transcription}</p>
                        </div>
                      ))}
                      <p className="text-[0.85rem] text-ink-3">
                        {t("verify.engine", {
                          e: app.extraction.engine.reader.replace(/^anthropic:/, ""),
                          s: Math.round((app.extraction.timings_ms.reader + app.extraction.timings_ms.reasoner) / 1000),
                        })}
                      </p>
                    </div>
                  </details>
                )}

                <div className="rounded-[var(--radius-panel)] border-2 border-indigo-700 bg-surface p-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-7 w-7 shrink-0 accent-indigo-700" />
                    <span className="font-semibold">{t("verify.confirm")}</span>
                  </label>
                  {saveError && (
                    <Notice tone="error" role="alert" className="mt-3">
                      {saveError}
                    </Notice>
                  )}
                  <Button type="submit" size="lg" block className="mt-4" disabled={!confirmed || saving}>
                    {saving ? t("verify.saving") : t("verify.save")}
                  </Button>
                  <p className="mt-2 text-center text-[0.88rem] text-ink-3">{t("verify.nothingSaved")}</p>
                </div>
              </form>
            )}
          </div>
        </div>
      </Screen>

      {zoom !== null && (
        <div className="fixed inset-0 z-30 flex flex-col bg-ink" role="dialog" aria-modal="true" aria-label={t("zoom.page", { a: zoom + 1, b: pageUrls.length })}>
          <div className="flex items-center justify-between gap-2 p-3 text-white" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
            <span className="font-semibold">{t("zoom.page", { a: zoom + 1, b: pageUrls.length })}</span>
            <div className="flex gap-2">
              <button disabled={zoom === 0} onClick={() => setZoom(zoom - 1)} aria-label={t("capture.earlier")} className="grid h-12 w-12 place-items-center rounded-full bg-white/15 disabled:opacity-30">
                <Icon name="back" />
              </button>
              <button
                disabled={zoom === pageUrls.length - 1}
                onClick={() => setZoom(zoom + 1)}
                aria-label={t("capture.later")}
                className="grid h-12 w-12 place-items-center rounded-full bg-white/15 disabled:opacity-30"
              >
                <Icon name="next" />
              </button>
              <button onClick={() => setZoom(null)} className="flex h-12 items-center gap-2 rounded-full bg-white/15 px-4 font-semibold">
                <Icon name="close" size={20} />
                {t("zoom.close")}
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto" style={{ touchAction: "pinch-zoom pan-x pan-y" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- full-resolution page */}
            <img src={pageUrls[zoom]} alt="" className="mx-auto w-full max-w-4xl" />
          </div>
        </div>
      )}
    </>
  );

  function renderAttention(flagged: { key: keyof VerifiedFields; label: MessageKey }[], unclear: { page_number: number; field: string | null; text: string }[]) {
    if (!flagged.length && !unclear.length) {
      return <Notice tone="done">{t("verify.attention.none")}</Notice>;
    }
    return (
      <section aria-labelledby="attention-title" className="rounded-[var(--radius-panel)] border-l-[6px] border-marigold-500 bg-marigold-50 p-4">
        <h2 id="attention-title" className="flex items-center gap-2 text-[1.15rem] font-bold">
          <Icon name="alert" className="text-marigold-700" />
          {flagged.length === 1 ? t("verify.attention.one") : t("verify.attention.title", { n: flagged.length })}
        </h2>
        <p className="mt-1 text-ink-2">{t("verify.attention.body")}</p>
        {flagged.length > 0 && (
          <ul className="mt-3 space-y-1">
            {flagged.map((f) => (
              <li key={f.key}>
                <a href={`#field-${f.key}`} className="inline-flex min-h-10 items-center gap-2 font-semibold text-indigo-800 underline underline-offset-4">
                  {t(f.label)}
                  {attentionOf(f.key) === "medium" && <span className="font-normal text-ink-3 no-underline">— {t("verify.probably")}</span>}
                </a>
              </li>
            ))}
          </ul>
        )}
        {unclear.length > 0 && (
          <div className="mt-4 border-t border-marigold-200 pt-3">
            <p className="font-semibold">{t("verify.unreadable")}</p>
            <ul className="mt-1 space-y-1">
              {unclear.map((u, i) => (
                <li key={i}>
                  <span className="rounded bg-surface px-1.5 py-0.5 font-semibold">{u.text}</span>
                  <span className="text-[0.9rem] text-ink-3">
                    {" "}
                    — {t("verify.onPage", { p: u.page_number })}
                    {u.field ? `, ${UNCLEAR_LABELS[u.field] ? t(UNCLEAR_LABELS[u.field]) : u.field}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    );
  }

  function renderSaved(app: Application) {
    const v = app.verified!;
    const d = dept(v.department);
    const sms = app.sms.at(-1);
    return (
      <div className="space-y-5">
        <Notice tone="done" title={t("saved.title")}>
          <p className="font-semibold text-ink">{refLabel(d, locale)}</p>
          {v.secondary_departments.length > 0 && (
            <p>{t("saved.also", { list: v.secondary_departments.map((c) => refLabel(dept(c), locale)).join(", ") })}</p>
          )}
          {app.sla_due_at && <p>{t("saved.due", { date: date(app.sla_due_at) })}</p>}
        </Notice>
        {sms && (
          <section className="rounded-[var(--radius-panel)] border border-rule bg-surface p-4">
            <h2 className="font-bold">
              {t("saved.sms")}
              {sms.to ? <span className="ml-2 font-normal text-ink-3">+91 {sms.to}</span> : null}
            </h2>
            <p className="text-[0.92rem] text-ink-3">
              {sms.status === "logged" ? t("saved.sms.logged") : sms.status === "skipped" ? t("saved.sms.skipped") : sms.status === "failed" ? t("saved.sms.failed") : null}
            </p>
            <p className="mt-2 rounded-[var(--radius-control)] bg-paper p-3">{sms.body}</p>
          </section>
        )}
        <section className="rounded-[var(--radius-panel)] border border-rule bg-surface p-4">
          <p className="text-[1.1rem] font-bold">{v.applicant_name_original}</p>
          {v.applicant_name_roman && <p className="text-ink-3">{v.applicant_name_roman}</p>}
          <p className="mt-2">{v.summary_local}</p>
          <p lang="en" className="mt-2 text-ink-2">
            {v.summary_en}
          </p>
        </section>
        <details className="rounded-[var(--radius-panel)] border border-rule bg-surface">
          <summary className="flex min-h-14 cursor-pointer items-center px-4 font-semibold">{t("saved.history", { n: app.audit.length })}</summary>
          <ol className="space-y-2 border-t border-rule p-4 text-[0.9rem]">
            {app.audit.map((a, i) => (
              <li key={i} className="border-b border-rule pb-2 last:border-0">
                <span className="text-ink-3">{date(a.at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span> — <b>{a.by}</b>{" "}
                {a.action}
                {a.field ? `: ${a.field} ${JSON.stringify(a.from)} → ${JSON.stringify(a.to)}` : ""}
              </li>
            ))}
          </ol>
        </details>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button href="/capture" icon="camera" size="lg">
            {t("saved.next")}
          </Button>
          <Button href="/queue" variant="secondary" size="lg">
            {t("saved.queue")}
          </Button>
        </div>
      </div>
    );
  }
}

type TextKey = "applicant_name_original" | "applicant_name_roman" | "mobile" | "address" | "locality" | "taluka" | "district" | "letter_date" | "subject";

function TextField({
  id,
  label,
  form,
  set,
  attention,
  multiline,
  type = "text",
  inputMode,
  error,
  help,
}: {
  id: TextKey;
  label: MessageKey;
  form: VerifiedFields;
  set: <K extends keyof VerifiedFields>(k: K, v: VerifiedFields[K]) => void;
  attention?: Attention;
  multiline?: boolean;
  type?: string;
  inputMode?: "tel" | "text";
  error?: string;
  help?: React.ReactNode;
}) {
  const value = form[id] ?? "";
  const onChange = (v: string) => set(id, v.trim() === "" ? null : v);
  const cls = inputClass(attention, !!error);
  return (
    <Field id={id} label={label} attention={attention} error={error} help={help}>
      {multiline ? (
        <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={cls} />
      ) : (
        <input id={id} value={value} type={type} inputMode={inputMode} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </Field>
  );
}

function Lines({ id, label, value, onChange }: { id: string; label: MessageKey; value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join("\n"));
  return (
    <Field id={id} label={label} hintKey="field.onePerLine">
      <textarea
        id={id}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean));
        }}
        rows={2}
        className={inputClass()}
      />
    </Field>
  );
}
