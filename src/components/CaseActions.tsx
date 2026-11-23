"use client";

import { useState } from "react";
import { useSettings } from "@/lib/client/settings";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { DEPARTMENTS, refLabel, type DepartmentCode } from "@/lib/reference";
import type { Application } from "@/lib/types";
import { Button } from "./ui/Button";
import { inputClass } from "./ui/Field";
import { Notice } from "./ui/Notice";

type Action = "acknowledge" | "in_progress" | "remind" | "transfer" | "resolve" | "reopen";

/** What each action asks for before it is recorded. */
const FORM: Record<Action, { input?: "note" | "remark" | "reason"; required?: boolean; dept?: boolean; submit: MessageKey }> = {
  acknowledge: { input: "note", submit: "case.acknowledge" },
  in_progress: { input: "note", submit: "case.inProgress" },
  remind: { input: "note", submit: "case.remind" },
  transfer: { input: "reason", required: true, dept: true, submit: "case.transfer" },
  resolve: { input: "remark", required: true, submit: "case.resolve" },
  reopen: { input: "reason", required: true, submit: "case.reopen" },
};

/**
 * Department follow-up after routing (pilot: office staff record it on the
 * department's behalf): acknowledged, in progress, reminder, transfer to
 * another department, resolved with a closing remark — or reopen.
 */
export function CaseActions({ app, onChange }: { app: Application; onChange: (a: Application) => void }) {
  const { t, locale } = useI18n();
  const [settings] = useSettings();
  const [open, setOpen] = useState<Action | null>(null);
  const [text, setText] = useState("");
  const [department, setDepartment] = useState<DepartmentCode | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolved = app.status === "closed";
  const current = app.verified?.department;

  function start(a: Action) {
    setOpen(a);
    setText("");
    setDepartment("");
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!open) return;
    const f = FORM[open];
    const body: Record<string, unknown> = { action: open, staff: settings.staff || undefined };
    if (f.input) body[f.input] = text.trim() || null;
    if (f.dept) body.department = department;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${encodeURIComponent(app.token)}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `${res.status}`);
      onChange(data.application);
      setOpen(null);
    } catch (err) {
      setError(t("case.error", { msg: (err as Error).message }));
    } finally {
      setBusy(false);
    }
  }

  const f = open ? FORM[open] : null;
  const label: Record<"note" | "remark" | "reason", MessageKey> = { note: "case.note", remark: "case.remark", reason: "case.reason" };

  return (
    <section className="card p-5" aria-labelledby="case-actions">
      <h2 id="case-actions" className="text-[1.1rem] font-bold">
        {t("case.title")}
      </h2>
      <p className="mt-0.5 text-[0.92rem] text-ink-3">{t("case.onBehalf")}</p>

      {!open && (
        <div className="mt-4 flex flex-wrap gap-2">
          {resolved ? (
            <Button variant="secondary" icon="refresh" onClick={() => start("reopen")}>
              {t("case.reopen")}
            </Button>
          ) : (
            <>
              {app.status === "routed" && (
                <Button variant="secondary" onClick={() => start("acknowledge")}>
                  {t("case.acknowledge")}
                </Button>
              )}
              <Button variant="secondary" onClick={() => start("in_progress")}>
                {t("case.inProgress")}
              </Button>
              <Button variant="secondary" onClick={() => start("remind")}>
                {t("case.remind")}
                {(app.reminders_sent ?? 0) > 0 && <span className="text-[0.85rem] font-normal opacity-80">· {app.reminders_sent}</span>}
              </Button>
              <Button variant="secondary" onClick={() => start("transfer")}>
                {t("case.transfer")}
              </Button>
              <Button icon="check" onClick={() => start("resolve")}>
                {t("case.resolve")}
              </Button>
            </>
          )}
        </div>
      )}

      {open && f && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <p className="font-semibold">{t(f.submit)}</p>
          {f.dept && (
            <div>
              <label htmlFor="case-dept" className="block text-[0.92rem] font-semibold">
                {t("case.toDepartment")}
              </label>
              <select
                id="case-dept"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value as DepartmentCode)}
                className={`${inputClass()} mt-1`}
              >
                <option value="" disabled>
                  {t("case.chooseDepartment")}
                </option>
                {DEPARTMENTS.filter((d) => d.code !== current).map((d) => (
                  <option key={d.code} value={d.code}>
                    {refLabel(d, locale)} · {t("field.days", { d: d.sla })}
                  </option>
                ))}
              </select>
            </div>
          )}
          {f.input && (
            <div>
              <label htmlFor="case-text" className="block text-[0.92rem] font-semibold">
                {t(label[f.input])}
                {!f.required && <span className="font-normal text-ink-3"> · {t("case.optional")}</span>}
              </label>
              <textarea id="case-text" required={f.required} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} className={`${inputClass()} mt-1`} />
            </div>
          )}
          {open === "remind" && <p className="text-[0.9rem] text-ink-3">{t("case.remindNote")}</p>}
          {open === "transfer" && <p className="text-[0.9rem] text-ink-3">{t("case.transferNote")}</p>}
          {error && (
            <Notice tone="error" role="alert">
              {error}
            </Notice>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {t(f.submit)}
            </Button>
            <Button variant="quiet" onClick={() => setOpen(null)} disabled={busy}>
              {t("archive.cancel")}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
