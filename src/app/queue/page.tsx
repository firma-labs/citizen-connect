"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Header, Page } from "@/components/Header";
import { StatusBadge } from "@/components/StatusBadge";
import { TokenCard } from "@/components/TokenCard";
import { listApps, subscribe, type LocalApplication } from "@/lib/client/db";
import { onSyncState, requestRead, syncNow } from "@/lib/client/sync";
import { dept } from "@/lib/reference";

interface ServerRow {
  token: string;
  status: string;
  captured_at: string;
  captured_by: string | null;
  page_count: number;
  pages_received: number[];
  read_error: string | null;
  summary_en: string | null;
  verified: { department: string; applicant_name_roman: string | null } | null;
}

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" });

export default function QueuePage() {
  const [local, setLocal] = useState<LocalApplication[]>([]);
  const [server, setServer] = useState<ServerRow[] | null>(null);
  const [sync, setSync] = useState({ running: false, online: true, lastError: null as string | null });
  const [showToken, setShowToken] = useState<string | null>(null);

  const loadServer = useCallback(() => {
    fetch("/api/applications", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setServer(d.applications))
      .catch(() => setServer(null));
  }, []);

  useEffect(() => {
    const refresh = () => listApps().then((a) => setLocal(a.filter((x) => x.state !== "draft")));
    refresh();
    loadServer();
    const unsub = subscribe(refresh);
    const off = onSyncState((s) => {
      setSync(s);
      if (!s.running) loadServer();
    });
    const t = setInterval(loadServer, 10_000);
    return () => {
      unsub();
      off();
      clearInterval(t);
    };
  }, [loadServer]);

  const localTokens = new Set(local.map((l) => l.token));
  const serverByToken = new Map((server ?? []).map((s) => [s.token, s]));
  const others = (server ?? []).filter((s) => !localTokens.has(s.token));

  return (
    <>
      <Header title="अर्ज यादी · Queue" back="/" />
      <Page>
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-sm">
          <div className="text-sm">
            {sync.online ? (sync.running ? "Syncing…" : "Online") : "Offline — will sync when signal returns"}
            {sync.lastError && <div className="text-danger-600">{sync.lastError}</div>}
          </div>
          <button
            onClick={() => void syncNow()}
            disabled={!sync.online || sync.running}
            className="h-12 rounded-xl bg-forest-700 px-4 font-semibold text-white disabled:bg-gray-400"
          >
            Sync now
          </button>
        </div>

        <h2 className="mb-2 font-extrabold">या फोनवरील · On this phone ({local.length})</h2>
        {local.length === 0 && <p className="mb-6 text-muted">No applications captured on this phone yet.</p>}
        <ul className="mb-8 space-y-3">
          {local.map((a) => {
            const s = serverByToken.get(a.token);
            const status = a.state === "queued" ? "queued" : (s?.status ?? a.server_status ?? "captured");
            return (
              <Row
                key={a.token}
                token={a.token}
                status={status}
                when={a.captured_at}
                pages={a.page_count}
                detail={
                  a.state === "queued"
                    ? `${a.pages_uploaded.length}/${a.page_count} pages uploaded${a.last_error ? ` · ${a.last_error}` : ""}`
                    : status === "read_failed"
                      ? (s?.read_error ?? a.last_error ?? undefined)
                      : (s?.summary_en ?? undefined)
                }
                dept={s?.verified?.department}
                onShowToken={() => setShowToken(a.token)}
              />
            );
          })}
        </ul>

        {others.length > 0 && (
          <>
            <h2 className="mb-2 font-extrabold">इतर फोन · Other devices ({others.length})</h2>
            <ul className="space-y-3">
              {others.map((s) => (
                <Row
                  key={s.token}
                  token={s.token}
                  status={s.status}
                  when={s.captured_at}
                  pages={s.page_count}
                  detail={s.status === "read_failed" ? (s.read_error ?? undefined) : (s.summary_en ?? undefined)}
                  dept={s.verified?.department}
                  by={s.captured_by}
                  onShowToken={() => setShowToken(s.token)}
                />
              ))}
            </ul>
          </>
        )}

        {showToken && (
          <div className="fixed inset-0 z-30 overflow-auto bg-black/60 p-4" onClick={() => setShowToken(null)}>
            <div className="mx-auto max-w-md" onClick={(e) => e.stopPropagation()}>
              <TokenCard token={showToken} />
              <button onClick={() => setShowToken(null)} className="mt-3 h-14 w-full rounded-2xl bg-white font-bold">
                Close
              </button>
            </div>
          </div>
        )}
      </Page>
    </>
  );
}

function Row({
  token,
  status,
  when,
  pages,
  detail,
  dept: deptCode,
  by,
  onShowToken,
}: {
  token: string;
  status: string;
  when: string;
  pages: number;
  detail?: string;
  dept?: string;
  by?: string | null;
  onShowToken: () => void;
}) {
  const [retrying, setRetrying] = useState(false);
  const canVerify = status === "read" || status === "read_failed";
  return (
    <li className={`rounded-2xl border-2 bg-white p-3 shadow-sm ${status === "read" ? "border-yellow-500" : "border-transparent"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button onClick={onShowToken} className="token-text whitespace-nowrap text-lg font-extrabold text-forest-800 underline-offset-4 active:underline">
          {token}
        </button>
        <StatusBadge status={status} />
      </div>
      <div className="mt-1 text-sm text-muted">
        {day(when)} {time(when)} · {pages} page(s){by ? ` · ${by}` : ""}
        {deptCode ? ` · → ${dept(deptCode)?.name ?? deptCode}` : ""}
      </div>
      {detail && <p className="mt-1 line-clamp-2 text-sm">{detail}</p>}
      {(canVerify || status === "routed") && (
        <div className="mt-2 flex gap-2">
          {canVerify && (
            <Link href={`/verify?t=${encodeURIComponent(token)}`} className="flex h-12 flex-1 items-center justify-center rounded-xl bg-forest-700 font-bold text-white">
              तपासा · Verify
            </Link>
          )}
          {status === "read_failed" && (
            <button
              disabled={retrying}
              onClick={() => {
                setRetrying(true);
                requestRead(token).finally(() => setRetrying(false));
              }}
              className="h-12 rounded-xl border-2 border-forest-700 px-4 font-semibold text-forest-800"
            >
              {retrying ? "…" : "Retry AI"}
            </button>
          )}
          {status === "routed" && (
            <Link href={`/verify?t=${encodeURIComponent(token)}`} className="flex h-12 flex-1 items-center justify-center rounded-xl border-2 border-forest-700 font-semibold text-forest-800">
              View record
            </Link>
          )}
        </div>
      )}
    </li>
  );
}
