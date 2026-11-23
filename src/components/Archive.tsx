"use client";

import { useEffect, useState } from "react";
import { useSettings } from "@/lib/client/settings";
import { useI18n } from "@/lib/i18n";
import { ARCHIVE_REASONS, isRouted, type ArchiveReason, type ArchiveRecord } from "@/lib/types";
import { Button } from "./ui/Button";
import { inputClass } from "./ui/Field";
import { Notice } from "./ui/Notice";

// Pilot clean-up: archive duplicates and test scans (restorable), and — only
// when the server allows it (PILOT_ALLOW_DELETE=1) — delete archived ones for good.

async function post(url: string, init: RequestInit) {
  const res = await fetch(url, { cache: "no-store", headers: { "Content-Type": "application/json" }, ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  return body;
}
const base = (token: string) => `/api/applications/${encodeURIComponent(token)}`;

let pilotDelete: Promise<boolean> | null = null;
/** Whether this server allows permanent delete (asked once per page load). */
export function usePilotDelete() {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    pilotDelete ??= fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((h) => !!h.pilot_delete)
      .catch(() => false);
    let live = true;
    void pilotDelete.then((v) => live && setAllowed(v));
    return () => {
      live = false;
    };
  }, []);
  return allowed;
}

/** Ask for a reason (and an optional note), then archive. */
export function ArchiveDialog({ token, status, onClose, onDone }: { token: string; status?: string; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const [settings] = useSettings();
  const [reason, setReason] = useState<ArchiveReason>("duplicate");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const routed = !!status && isRouted(status);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post(`${base(token)}/archive`, { method: "POST", body: JSON.stringify({ reason, note: note.trim() || null, staff: settings.staff || undefined }) });
      onDone();
    } catch (err) {
      setError(t("archive.error", { msg: (err as Error).message }));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 overflow-auto bg-ink/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="archive-title" onClick={onClose}>
      <form onSubmit={submit} className="mx-auto mt-[8vh] max-w-md rounded-[var(--radius-dialog)] bg-surface-container-low p-6 shadow-[var(--elevation-3)]" onClick={(e) => e.stopPropagation()}>
        <h2 id="archive-title" className="text-[1.25rem] font-bold">
          {t("archive.title", { token })}
        </h2>
        <p className="mt-1 text-ink-2">{t("archive.body")}</p>
        {routed && (
          <Notice tone="attention" className="mt-3">
            {t("archive.routedWarning")}
          </Notice>
        )}

        <fieldset className="mt-4">
          <legend className="font-semibold">{t("archive.reasonLabel")}</legend>
          <div className="mt-2 grid gap-1">
            {ARCHIVE_REASONS.map((r) => (
              <label
                key={r}
                className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] px-3 font-medium transition-colors ${reason === r ? "bg-primary-container text-on-primary-container" : "hover:bg-ink/5"}`}
              >
                <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="h-5 w-5 accent-primary" />
                {t(`archive.reasons.${r}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <label htmlFor="archive-note" className="mt-4 block font-semibold">
          {t("archive.noteLabel")}
        </label>
        <p className="text-[0.9rem] text-ink-3">{t("archive.noteHint")}</p>
        <input id="archive-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className={`${inputClass()} mt-1.5`} />

        {error && (
          <Notice tone="error" role="alert" className="mt-3">
            {error}
          </Notice>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="quiet" onClick={onClose} disabled={busy}>
            {t("archive.cancel")}
          </Button>
          <Button type="submit" icon="archive" className="flex-1" disabled={busy}>
            {t("archive.confirm")}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Shows why an application is archived, with Restore (and Delete when the pilot allows it). */
export function ArchivedNotice({
  token,
  archived,
  onRestored,
  onDeleted,
  compact = false,
}: {
  token: string;
  archived: ArchiveRecord;
  onRestored: () => void;
  onDeleted: () => void;
  compact?: boolean;
}) {
  const { t, date } = useI18n();
  const [settings] = useSettings();
  const canDelete = usePilotDelete();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>, done: () => void) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      done();
    } catch (e) {
      setError(t("archived.error", { msg: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  }
  const staff = JSON.stringify({ staff: settings.staff || undefined });

  return (
    <div className={compact ? "" : "mb-5"}>
      <Notice tone="attention" title={t("archived.title", { reason: t(`archive.reasons.${archived.reason}`) })}>
        <p>{t("archived.by", { by: archived.by, date: date(archived.at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) })}</p>
        {archived.note && <p className="mt-1">“{archived.note}”</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" icon="refresh" disabled={busy} onClick={() => void run(() => post(`${base(token)}/restore`, { method: "POST", body: staff }), onRestored)}>
            {t("archived.restore")}
          </Button>
          {canDelete && (
            <Button
              variant="danger"
              icon="trash"
              disabled={busy}
              onClick={() => {
                if (confirm(t("archived.deleteConfirm", { token }))) void run(() => post(base(token), { method: "DELETE", body: staff }), onDeleted);
              }}
            >
              {t("archived.delete")}
            </Button>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-2 font-semibold text-red-700">
            {error}
          </p>
        )}
      </Notice>
    </div>
  );
}
