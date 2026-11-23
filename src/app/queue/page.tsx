"use client";

import { useEffect, useState } from "react";
import { ArchiveDialog, ArchivedNotice } from "@/components/Archive";
import { TokenCard } from "@/components/TokenCard";
import { AppBar, BottomNav, Screen } from "@/components/ui/AppBar";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { StatTile } from "@/components/ui/StatTile";
import { StatusTag } from "@/components/ui/StatusTag";
import { deleteApp } from "@/lib/client/db";
import { localStatus, officeSummary, useOfficeApplications } from "@/lib/client/office";
import { onSyncState, requestRead, syncNow } from "@/lib/client/sync";
import { useI18n } from "@/lib/i18n";
import { dept, refLabel } from "@/lib/reference";

export default function QueuePage() {
  const { t, num } = useI18n();
  const { local: allLocal, server, reload } = useOfficeApplications();
  const [sync, setSync] = useState({ running: false, online: true, lastError: null as string | null });
  const [showToken, setShowToken] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<{ token: string; status: string } | null>(null);

  useEffect(() => onSyncState(setSync), []);

  const office = officeSummary(allLocal, server);
  const { byToken, others, local, archived } = office;
  /** A scan that never reached the server can only be removed from this phone. */
  const deleteLocal = (token: string) => {
    if (confirm(t("queue.deleteLocalConfirm"))) void deleteApp(token);
  };

  return (
    <>
      <AppBar />
      <Screen wide>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[1.7rem] font-bold tracking-tight">{t("queue.title")}</h1>
          {/* Sync = upload this phone's waiting scans, ask for AI readings, refresh every status. */}
          <Button variant="secondary" icon="refresh" onClick={() => void syncNow()} disabled={!sync.online || sync.running}>
            {sync.running ? t("queue.uploading") : t("queue.syncNow")}
            {office.notUploaded > 0 && (
              <span className="ml-2 inline-grid h-6 min-w-6 place-items-center rounded-full bg-marigold-500 px-1.5 align-middle text-[0.8rem] font-bold leading-none text-white">
                <span aria-hidden>{num(office.notUploaded)}</span>
                <span className="sr-only">{t("queue.pendingBadge", { n: office.notUploaded })}</span>
              </span>
            )}
          </Button>
        </div>
        <div className="mb-6 grid grid-cols-3 gap-2.5 sm:gap-3">
          <StatTile tone="peach" value={num(office.toCheck)} label={t("status.read")} />
          <StatTile tone="sky" value={num(office.reading)} label={t("status.reading")} />
          <StatTile tone="mint" value={num(office.routed)} label={t("status.routed")} />
        </div>

        {!sync.online && (
          <Notice tone="attention" className="mb-5">
            {t("queue.offline")}
          </Notice>
        )}
        {sync.lastError && sync.online && (
          <Notice tone="error" className="mb-5">
            {sync.lastError}
          </Notice>
        )}

        <h2 className="mb-2 text-[1.1rem] font-bold">
          {t("queue.onPhone")} <span className="font-normal text-ink-3">({local.length})</span>
        </h2>
        {local.length === 0 ? (
          <p className="mb-8 rounded-[var(--radius-panel)] bg-paper p-6 text-center text-ink-3">{t("queue.empty")}</p>
        ) : (
          <ul className="mb-8 grid gap-3 lg:grid-cols-2">
            {local.map((a) => {
              const s = byToken.get(a.token);
              const status = localStatus(a, byToken);
              return (
                <Item
                  key={a.token}
                  token={a.token}
                  status={status}
                  when={a.captured_at}
                  pages={a.page_count}
                  detail={
                    a.state === "queued"
                      ? t("queue.uploaded", { a: a.pages_uploaded.length, b: a.page_count }) + (a.last_error ? ` — ${a.last_error}` : "")
                      : status === "read_failed"
                        ? (s?.read_error ?? a.last_error ?? undefined)
                        : (s?.summary_en ?? undefined)
                  }
                  deptCode={s?.verified?.department}
                  onShowToken={() => setShowToken(a.token)}
                  onArchive={s ? () => setArchiving({ token: a.token, status }) : undefined}
                  onDeleteLocal={!s && a.state === "queued" ? () => deleteLocal(a.token) : undefined}
                />
              );
            })}
          </ul>
        )}

        {others.length > 0 && (
          <>
            <h2 className="mb-2 text-[1.1rem] font-bold">
              {t("queue.others")} <span className="font-normal text-ink-3">({others.length})</span>
            </h2>
            <ul className="grid gap-3 lg:grid-cols-2">
              {others.map((s) => (
                <Item
                  key={s.token}
                  token={s.token}
                  status={s.status}
                  when={s.captured_at}
                  pages={s.page_count}
                  by={s.captured_by}
                  detail={s.status === "read_failed" ? (s.read_error ?? undefined) : (s.summary_en ?? undefined)}
                  deptCode={s.verified?.department}
                  onShowToken={() => setShowToken(s.token)}
                  onArchive={() => setArchiving({ token: s.token, status: s.status })}
                />
              ))}
            </ul>
          </>
        )}

        {archived.length > 0 && (
          <details className="mt-8">
            <summary className="mb-2 cursor-pointer text-[1.1rem] font-bold">
              {t("queue.archived")} <span className="font-normal text-ink-3">({archived.length})</span>
            </summary>
            <ul className="grid gap-3 lg:grid-cols-2">
              {archived.map((s) => (
                <li key={s.token} className="card p-4">
                  <p className="token mb-2 text-[1.05rem]">{s.token}</p>
                  <ArchivedNotice token={s.token} archived={s.archived!} onRestored={reload} onDeleted={reload} compact />
                </li>
              ))}
            </ul>
          </details>
        )}
      </Screen>
      <BottomNav />

      {archiving && (
        <ArchiveDialog
          token={archiving.token}
          status={archiving.status}
          onClose={() => setArchiving(null)}
          onDone={() => {
            setArchiving(null);
            reload();
          }}
        />
      )}

      {showToken && (
        <div className="fixed inset-0 z-30 overflow-auto bg-ink/70 p-4 backdrop-blur-sm" onClick={() => setShowToken(null)} role="dialog" aria-modal="true">
          <div className="mx-auto max-w-md rounded-[var(--radius-hero)] bg-gradient-to-br from-indigo-50 via-sky-50 to-mint-50 p-4" onClick={(e) => e.stopPropagation()}>
            <TokenCard token={showToken} />
            <Button variant="secondary" block className="mt-3" icon="close" onClick={() => setShowToken(null)}>
              {t("capture.close")}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

const EDGE: Record<string, string> = {
  queued: "border-l-marigold-200",
  captured: "border-l-sky-200",
  reading: "border-l-sky-500",
  read: "border-l-marigold-500 bg-gradient-to-br from-marigold-50/70 via-white to-white",
  read_failed: "border-l-red-500 bg-gradient-to-br from-red-50/70 via-white to-white",
  routed: "border-l-mint-500",
  in_progress: "border-l-indigo-600",
  closed: "border-l-ink",
};

function Item({
  token,
  status,
  when,
  pages,
  detail,
  deptCode,
  by,
  onShowToken,
  onArchive,
  onDeleteLocal,
}: {
  token: string;
  status: string;
  when: string;
  pages: number;
  detail?: string;
  deptCode?: string;
  by?: string | null;
  onShowToken: () => void;
  onArchive?: () => void;
  onDeleteLocal?: () => void;
}) {
  const { t, date, locale } = useI18n();
  const [retrying, setRetrying] = useState(false);
  const needsCheck = status === "read" || status === "read_failed";
  const verifyHref = `/verify?t=${encodeURIComponent(token)}`;
  const meta = [
    date(when, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
    t("queue.pages", { n: pages }),
    by,
    deptCode ? refLabel(dept(deptCode), locale) : null,
  ].filter(Boolean);

  return (
    <li className={`card border-l-4 p-4 ${EDGE[status] ?? "border-l-rule-strong"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={onShowToken} className="token flex items-center gap-1.5 text-[1.1rem] text-ink underline-offset-4 hover:underline">
          {token}
        </button>
        <StatusTag status={status} />
      </div>
      <p className="mt-1 text-[0.9rem] text-ink-3">{meta.join(" · ")}</p>
      {detail && <p className={`mt-2 line-clamp-2 text-[0.95rem] ${status === "read_failed" ? "text-red-700" : "text-ink-2"}`}>{detail}</p>}
      {(needsCheck || status === "routed" || onArchive || onDeleteLocal) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {needsCheck && (
            <Button href={verifyHref} className="flex-1">
              {t("queue.check")}
            </Button>
          )}
          {status === "read_failed" && (
            <Button
              variant="secondary"
              icon="refresh"
              disabled={retrying}
              onClick={() => {
                setRetrying(true);
                requestRead(token).finally(() => setRetrying(false));
              }}
            >
              {t("queue.retry")}
            </Button>
          )}
          {status === "routed" && (
            <Button variant="secondary" href={verifyHref} className="flex-1">
              {t("queue.view")}
            </Button>
          )}
          {onArchive && (
            <Button variant="quiet" icon="archive" onClick={onArchive} className="ml-auto">
              {t("archive.action")}
            </Button>
          )}
          {onDeleteLocal && (
            <Button variant="quiet" icon="trash" onClick={onDeleteLocal} className="ml-auto text-red-600">
              {t("queue.deleteLocal")}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
