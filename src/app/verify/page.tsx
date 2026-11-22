"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { BigButton, Header, Page } from "@/components/Header";
import { RescanPanel } from "@/components/RescanPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { useSettings } from "@/lib/client/settings";
import { fetchApplication, requestRead, syncNow } from "@/lib/client/sync";
import { CATEGORIES, DEPARTMENTS, LANGUAGES, PAGE_TYPES, PRIORITIES, dept } from "@/lib/reference";
import { isValidMobile, normaliseMobile } from "@/lib/token";
import type { Application, Confidence, VerifiedFields } from "@/lib/types";

export default function VerifyPage() {
  return (
    <Suspense fallback={<Header title="तपासणी · Verify" back="/queue" />}>
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

function Verify() {
  const token = useSearchParams().get("t") ?? "";
  const [settings] = useSettings();
  const [app, setApp] = useState<Application | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<VerifiedFields | null>(null);
  const [manual, setManual] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);
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
    let t: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const a = await load();
      if (stop) return;
      if (!a || a.status === "captured" || a.status === "reading") t = setTimeout(tick, 3000);
    };
    void tick();
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [token, load, pollKey]);

  // Fill the form from each new AI result — the first one, and again after a rescan or retry.
  useEffect(() => {
    const readAt = app?.extraction?.read_at ?? null;
    if (app?.status === "read" && readAt && readAt !== seededFrom) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- seed the editable form from a new AI result
      setForm(fromExtraction(app));
      setSeededFrom(readAt);
      setConfirmed(false);
    }
  }, [app, seededFrom]);

  const conf = useMemo(() => {
    const c = app?.extraction?.reader.confidence;
    const r = app?.extraction?.reasoner.confidence;
    return (key: string): Confidence | undefined => {
      const map: Record<string, Confidence | undefined> = {
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
      return map[key];
    };
  }, [app]);

  if (!token) return <Missing />;

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

  return (
    <>
      <Header title="तपासणी · Verify" back="/queue" />
      <Page>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="token-text whitespace-nowrap text-xl font-extrabold">{token}</span>
          {status && <StatusBadge status={status} />}
        </div>

        {loadError && !app && (
          <p className="rounded-xl bg-danger-50 p-3 text-danger-600">
            {loadError === "not found" ? "Not on the server yet — it may still be uploading from the capture phone." : loadError}
          </p>
        )}

        {pageUrls.length > 0 && (
          <div className="-mx-4 mb-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
            {pageUrls.map((u, i) => (
              <button key={u} onClick={() => setZoom(i)} className="relative w-40 shrink-0 snap-start overflow-hidden rounded-xl border-2 border-line bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element -- authenticated API image */}
                <img src={u} alt={`Page ${i + 1}`} className="aspect-[3/4] w-full object-cover" loading="lazy" />
                <span className="absolute left-1.5 top-1.5 rounded-full bg-forest-700 px-2 text-sm font-bold text-white">{i + 1}</span>
                {app?.extraction?.reader.pages[i] && (
                  <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-xs text-white">
                    {PAGE_TYPES.find((p) => p.code === app.extraction!.reader.pages[i].page_type)?.en}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {canRescan && !rescanning && app && app.pages_received.length === app.page_count && (
          <button
            onClick={() => setRescanning(true)}
            className="mb-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-forest-700 bg-white font-semibold text-forest-800"
          >
            📷 पुन्हा स्कॅन करा · Rescan pages
          </button>
        )}

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
          <div className="rounded-2xl bg-blue-50 p-5 text-center">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" />
            <p className="font-bold">AI वाचन सुरू आहे · AI is reading the pages</p>
            <p className="text-sm text-muted">
              {app && app.pages_received.length < app.page_count
                ? `Waiting for pages: ${app.pages_received.length}/${app.page_count} uploaded`
                : "Usually under 30 seconds. The token is already issued — the citizen does not need to wait."}
            </p>
          </div>
        )}

        {!rescanning && status === "read_failed" && !form && (
          <div className="space-y-3 rounded-2xl border-2 border-danger-600 bg-danger-50 p-4">
            <p className="font-bold">AI could not read this application</p>
            <p className="text-sm">{app?.read_error}</p>
            <div className="flex gap-2">
              <button onClick={() => void requestRead(token).then(load)} className="h-12 flex-1 rounded-xl bg-forest-700 font-semibold text-white">
                Retry AI
              </button>
              <button
                onClick={() => {
                  setManual(true);
                  setForm(EMPTY);
                }}
                className="h-12 flex-1 rounded-xl border-2 border-forest-700 bg-white font-semibold text-forest-800"
              >
                Enter manually
              </button>
            </div>
          </div>
        )}

        {(status === "routed" || status === "in_progress" || status === "closed") && app && <Saved app={app} />}

        {!rescanning && form && (status === "read" || (status === "read_failed" && manual)) && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="space-y-6"
          >
            {app?.extraction && (
              <p className="rounded-xl bg-forest-50 p-3 text-sm">
                AI-filled. <b className="rounded bg-warn-50 px-1 ring-1 ring-warn-500">Yellow fields</b> are low confidence — check them
                against the letter. Nothing is saved until you confirm below.
              </p>
            )}

            {app?.extraction && app.extraction.reader.unclear.length > 0 && (
              <section className="rounded-2xl border-2 border-warn-500 bg-warn-50 p-3">
                <h3 className="font-bold">न वाचता आलेले शब्द · Words the AI could not read</h3>
                <ul className="mt-1 space-y-1">
                  {app.extraction.reader.unclear.map((u, i) => (
                    <li key={i} className="text-[15px]">
                      <span className="font-mono">{u.text}</span>
                      <span className="text-sm text-muted"> — page {u.page_number}{u.field ? `, ${u.field}` : ""}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <Section mr="अर्जदार" en="Applicant">
              <Text label="नाव (मूळ लिपी) · Name (original)" k="applicant_name_original" form={form} set={set} conf={conf} />
              <Text label="नाव (रोमन) · Name (romanised)" k="applicant_name_roman" form={form} set={set} conf={conf} />
              <Text label="मोबाईल · Mobile" k="mobile" form={form} set={set} conf={conf} inputMode="numeric" />
              {form.mobile && !isValidMobile(normaliseMobile(form.mobile)) && (
                <p className="-mt-2 text-sm font-semibold text-danger-600">Not a valid 10-digit mobile — SMS will not be sent.</p>
              )}
              {!form.mobile && <p className="-mt-2 text-sm text-warn-700">No mobile — the citizen will not get an SMS.</p>}
              <Text label="पत्ता · Address" k="address" form={form} set={set} conf={conf} multiline />
              <div className="grid grid-cols-2 gap-3">
                <Text label="गाव/परिसर · Locality" k="locality" form={form} set={set} conf={conf} />
                <Text label="तालुका · Taluka" k="taluka" form={form} set={set} conf={conf} />
              </div>
              <Text label="जिल्हा · District" k="district" form={form} set={set} conf={conf} />
            </Section>

            <Section mr="अर्ज" en="Letter">
              <div className="grid grid-cols-2 gap-3">
                <Text label="दिनांक · Date" k="letter_date" form={form} set={set} conf={conf} type="date" />
                <Select label="भाषा · Language" value={form.language} onChange={(v) => set("language", v as VerifiedFields["language"])} options={LANGUAGES.map((l) => [l.code, `${l.mr} · ${l.en}`])} />
              </div>
              <Text label="विषय · Subject" k="subject" form={form} set={set} conf={conf} multiline />
              <Area label="सारांश (इंग्रजी) · Summary (English)" value={form.summary_en} onChange={(v) => set("summary_en", v)} />
              <Area label="सारांश (मूळ भाषा) · Summary (letter's language)" value={form.summary_local} onChange={(v) => set("summary_local", v)} />
            </Section>

            <Section mr="वर्गीकरण व विभाग" en="Category & routing">
              <Select label="वर्ग · Category" value={form.category} low={conf("category") === "low"} onChange={(v) => set("category", v as VerifiedFields["category"])} options={CATEGORIES.map((c) => [c.code, `${c.mr} · ${c.en}`])} />
              <Select
                label="मुख्य विभाग · Primary department"
                value={form.department}
                low={conf("department") === "low"}
                onChange={(v) => set("department", v as VerifiedFields["department"])}
                options={DEPARTMENTS.map((d) => [d.code, `${d.code} — ${d.name} (${d.sla}d)`])}
              />
              <div>
                <div className="mb-1 font-semibold">संबंधित इतर विभाग · Also concerns</div>
                <div className="flex flex-wrap gap-2">
                  {DEPARTMENTS.filter((d) => d.code !== form.department).map((d) => {
                    const on = form.secondary_departments.includes(d.code);
                    return (
                      <button
                        type="button"
                        key={d.code}
                        onClick={() =>
                          set("secondary_departments", on ? form.secondary_departments.filter((x) => x !== d.code) : [...form.secondary_departments, d.code])
                        }
                        className={`min-h-11 rounded-full border-2 px-3 text-sm font-semibold ${on ? "border-forest-700 bg-forest-700 text-white" : "border-line bg-white"}`}
                      >
                        {d.code}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Select label="प्राधान्य · Priority" value={form.priority} onChange={(v) => set("priority", v as VerifiedFields["priority"])} options={PRIORITIES.map((p) => [p.code, `${p.mr} · ${p.en}`])} />
              {app?.extraction?.reasoner.priority_reason && <p className="-mt-2 text-sm text-muted">AI: {app.extraction.reasoner.priority_reason}</p>}
            </Section>

            <Section mr="इतर तपशील" en="Other details (one per line)">
              <Lines label="पूर्वीचे पाठपुरावे · Prior follow-ups" value={form.prior_follow_ups} onChange={(v) => set("prior_follow_ups", v)} />
              <Lines label="सोबतची कागदपत्रे · Attachments" value={form.attachments} onChange={(v) => set("attachments", v)} />
              <Lines label="स्वाक्षरी करणारे · Signatories" value={form.signatories} onChange={(v) => set("signatories", v)} />
            </Section>

            {app?.extraction && (
              <details className="rounded-2xl bg-white p-3 shadow-sm">
                <summary className="min-h-11 cursor-pointer font-bold">पूर्ण मजकूर · Full transcription</summary>
                {app.extraction.reader.pages.map((p) => (
                  <div key={p.page_number} className="mt-3">
                    <div className="text-sm font-semibold text-muted">
                      Page {p.page_number} · {PAGE_TYPES.find((t) => t.code === p.page_type)?.en}
                    </div>
                    <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-forest-50 p-3 font-sans text-[15px] leading-relaxed">{p.transcription}</pre>
                  </div>
                ))}
                <p className="mt-3 text-xs text-muted">
                  {app.extraction.engine.reader} · read {Math.round(app.extraction.timings_ms.reader / 1000)}s + reason{" "}
                  {Math.round(app.extraction.timings_ms.reasoner / 1000)}s
                </p>
              </details>
            )}

            <label className="flex items-start gap-3 rounded-2xl border-2 border-forest-700 bg-white p-4">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 h-7 w-7 shrink-0 accent-forest-700" />
              <span>
                <b>मी हे तपशील मूळ अर्जाशी तपासले आहेत.</b>
                <span className="block text-sm text-muted">I have checked these details against the original letter.</span>
              </span>
            </label>
            {saveError && <p className="rounded-xl bg-danger-50 p-3 text-danger-600">{saveError}</p>}
            <BigButton type="submit" mr={saving ? "जतन होत आहे…" : "जतन करा व SMS पाठवा"} en="Save, route & send SMS" disabled={!confirmed || saving} />
          </form>
        )}

        {zoom !== null && (
          <div className="fixed inset-0 z-30 flex flex-col bg-black" role="dialog">
            <div className="flex items-center justify-between p-3 text-white">
              <span className="font-bold">Page {zoom + 1} / {pageUrls.length}</span>
              <div className="flex gap-2">
                <button disabled={zoom === 0} onClick={() => setZoom(zoom - 1)} className="h-11 w-11 rounded-lg bg-white/15 disabled:opacity-30">‹</button>
                <button disabled={zoom === pageUrls.length - 1} onClick={() => setZoom(zoom + 1)} className="h-11 w-11 rounded-lg bg-white/15 disabled:opacity-30">›</button>
                <button onClick={() => setZoom(null)} className="h-11 rounded-lg bg-white/15 px-4">Close</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto" style={{ touchAction: "pinch-zoom pan-x pan-y" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- full-resolution page */}
              <img src={pageUrls[zoom]} alt="" className="mx-auto w-full max-w-none" />
            </div>
          </div>
        )}
      </Page>
    </>
  );
}

function Saved({ app }: { app: Application }) {
  const v = app.verified!;
  const d = dept(v.department);
  const sms = app.sms.at(-1);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-forest-700 p-5 text-white">
        <div className="text-2xl font-extrabold">✓ जतन केले · Saved</div>
        <div className="mt-1">
          → <b>{d?.name}</b> {v.secondary_departments.length ? `(also: ${v.secondary_departments.join(", ")})` : ""}
        </div>
        {app.sla_due_at && <div className="text-sm text-white/85">SLA due {new Date(app.sla_due_at).toLocaleDateString()} ({d?.sla} days)</div>}
      </div>
      {sms && (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="text-sm font-bold">
            SMS {sms.status === "logged" ? "(pilot: logged, not sent)" : sms.status} {sms.to ? `→ +91 ${sms.to}` : ""}
          </div>
          {sms.detail && <div className="text-sm text-muted">{sms.detail}</div>}
          <p className="mt-2 rounded-lg bg-forest-50 p-3 text-[15px]">{sms.body}</p>
        </div>
      )}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="font-bold">{v.applicant_name_original} {v.applicant_name_roman ? `· ${v.applicant_name_roman}` : ""}</div>
        <p className="mt-1 text-[15px]">{v.summary_en}</p>
        <p className="mt-1 text-[15px] text-muted">{v.summary_local}</p>
      </div>
      <details className="rounded-2xl bg-white p-4 shadow-sm">
        <summary className="min-h-11 cursor-pointer font-bold">Audit log ({app.audit.length})</summary>
        <ul className="mt-2 space-y-1 text-sm">
          {app.audit.map((a, i) => (
            <li key={i} className="border-b border-line pb-1">
              <span className="text-muted">{new Date(a.at).toLocaleString()}</span> · <b>{a.by}</b> · {a.action}
              {a.field ? ` · ${a.field}: ${JSON.stringify(a.from)} → ${JSON.stringify(a.to)}` : ""}
            </li>
          ))}
        </ul>
      </details>
      <BigButton href="/capture" mr="पुढील अर्ज" en="Scan next application" />
      <BigButton href="/queue" variant="secondary" mr="अर्ज यादी" en="Back to queue" />
    </div>
  );
}

function Missing() {
  return (
    <>
      <Header title="तपासणी · Verify" back="/queue" />
      <Page>
        <p>No token given. <Link href="/queue" className="underline">Open the queue</Link>.</p>
      </Page>
    </>
  );
}

function Section({ mr, en, children }: { mr: string; en: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
      <h3 className="text-lg font-extrabold">
        {mr} <span className="text-sm font-semibold text-muted">· {en}</span>
      </h3>
      {children}
    </section>
  );
}

type TextKey = "applicant_name_original" | "applicant_name_roman" | "mobile" | "address" | "locality" | "taluka" | "district" | "letter_date" | "subject";

function Text({
  label,
  k,
  form,
  set,
  conf,
  multiline,
  type = "text",
  inputMode,
}: {
  label: string;
  k: TextKey;
  form: VerifiedFields;
  set: <K extends keyof VerifiedFields>(k: K, v: VerifiedFields[K]) => void;
  conf: (k: string) => Confidence | undefined;
  multiline?: boolean;
  type?: string;
  inputMode?: "numeric" | "text";
}) {
  const c = conf(k);
  const cls = `mt-1 block w-full rounded-xl border-2 border-line bg-white px-3 py-3 ${c === "low" ? "field-low" : ""}`;
  const value = form[k] ?? "";
  const onChange = (v: string) => set(k, v.trim() === "" ? null : v);
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-2 font-semibold">
        <span>{label}</span>
        {c && <ConfBadge c={c} />}
      </span>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className={cls} />
      ) : (
        <input value={value} type={type} inputMode={inputMode} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </label>
  );
}

function ConfBadge({ c }: { c: Confidence }) {
  const s = { high: "text-forest-700", medium: "text-warn-700", low: "bg-warn-500 text-white px-1.5 rounded" }[c];
  return <span className={`text-xs font-bold ${s}`}>{c === "low" ? "⚠ check · तपासा" : c}</span>;
}

function Select({ label, value, onChange, options, low }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; low?: boolean }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between font-semibold">
        {label}
        {low && <ConfBadge c="low" />}
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`mt-1 block min-h-12 w-full rounded-xl border-2 border-line bg-white px-3 ${low ? "field-low" : ""}`}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Area({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="font-semibold">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4} className="mt-1 block w-full rounded-xl border-2 border-line bg-white px-3 py-3" />
    </label>
  );
}

function Lines({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join("\n"));
  return (
    <label className="block">
      <span className="font-semibold">{label}</span>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean));
        }}
        rows={2}
        className="mt-1 block w-full rounded-xl border-2 border-line bg-white px-3 py-3"
      />
    </label>
  );
}
