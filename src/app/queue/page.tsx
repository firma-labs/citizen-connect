"use client";

import { useCallback, useEffect, useState } from "react";
import { TokenCard } from "@/components/TokenCard";
import { AppBar, BottomNav, Screen } from "@/components/ui/AppBar";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { StatTile } from "@/components/ui/StatTile";
import { StatusTag } from "@/components/ui/StatusTag";
import { listApps, subscribe, type LocalApplication } from "@/lib/client/db";
import { onSyncState, requestRead, syncNow } from "@/lib/client/sync";
import { useI18n } from "@/lib/i18n";
import { dept, refLabel } from "@/lib/reference";

interface ServerRow {
  token: string;
  status: string;
  captured_at: string;
  captured_by: string | null;
  page_count: number;
  read_error: string | null;
  summary_en: string | null;
  verified: { department: string } | null;
}

// Last server list, kept for the session so the queue shows straight away on the
// next visit instead of an empty list while the request crosses the network.
const CACHE_KEY = "cc-queue-server";
let memoryCache: ServerRow[] | null = null;
function readCache(): ServerRow[] | null {
  if (memoryCache) return memoryCache;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as ServerRow[]) : null;
  } catch {
    return null;
  }
}
function writeCache(rows: ServerRow[]) {
  memoryCache = rows;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(rows));
  } catch {}
}

export default function QueuePage() {
  const { t, num } = useI18n();
  const [local, setLocal] = useState<LocalApplication[]>([]);
  const [server, setServer] = useState<ServerRow[] | null>(null);
  const [sync, setSync] = useState({ running: false, online: true, lastError: null as string | null });
  const [showToken, setShowToken] = useState<string | null>(null);

  const loadServer = useCallback(() => {
    fetch("/api/applications", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        writeCache(d.applications);
        setServer(d.applications);
      })
      // Offline or failed: keep showing the last list rather than nothing.
      .catch(() => setServer((cur) => cur ?? readCache()));
  }, []);

  useEffect(() => {
    const refresh = () => listApps().then((a) => setLocal(a.filter((x) => x.state !== "draft")));
    refresh();
    // Show the cached list at once (after hydration, so server and client HTML match), then refresh.
    void Promise.resolve().then(() => setServer((cur) => cur ?? readCache()));
    loadServer();
    const unsub = subscribe(refresh);
    const off = onSyncState((s) => {
      setSync(s);
      if (!s.running) loadServer();
    });
    const timer = setInterval(loadServer, 10_000);
    return () => {
      unsub();
      off();
      clearInterval(timer);
    };
  }, [loadServer]);

  const localTokens = new Set(local.map((l) => l.token));
  const byToken = new Map((server ?? []).map((s) => [s.token, s]));
  const others = (server ?? []).filter((s) => !localTokens.has(s.token));
  // Status of every application this screen knows about, for the summary tiles.
  const statuses = [
    ...local.map((a) => (a.state === "queued" ? "queued" : (byToken.get(a.token)?.status ?? a.server_status ?? "captured"))),
    ...others.map((s) => s.status),
  ];
  const count = (...st: string[]) => num(statuses.filter((x) => st.includes(x)).length);

  return (
    <>
      <AppBar />
      <Screen wide>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[1.7rem] font-bold tracking-tight">{t("queue.title")}</h1>
          <Button variant="secondary" icon="upload" onClick={() => void syncNow()} disabled={!sync.online || sync.running}>
            {sync.running ? t("queue.uploading") : t("queue.syncNow")}
          </Button>
        </div>
        <div className="mb-6 grid grid-cols-3 gap-2.5 sm:gap-3">
          <StatTile tone="peach" value={count("read", "read_failed")} label={t("status.read")} />
          <StatTile tone="sky" value={count("queued", "captured", "reading")} label={t("status.reading")} />
          <StatTile tone="mint" value={count("routed", "in_progress", "closed")} label={t("status.routed")} />
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
              const status = a.state === "queued" ? "queued" : (s?.status ?? a.server_status ?? "captured");
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
                />
              ))}
            </ul>
          </>
        )}
      </Screen>
      <BottomNav />

      {showToken && (
        <div className="fixed inset-0 z-30 overflow-auto bg-ink/70 p-4 backdrop-blur-sm" onClick={() => setShowToken(null)} role="dialog" aria-modal="true">
          <div className="mx-auto max-w-md rounded-[28px] bg-gradient-to-br from-indigo-50 via-sky-50 to-mint-50 p-4" onClick={(e) => e.stopPropagation()}>
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
}: {
  token: string;
  status: string;
  when: string;
  pages: number;
  detail?: string;
  deptCode?: string;
  by?: string | null;
  onShowToken: () => void;
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
      {(needsCheck || status === "routed") && (
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
        </div>
      )}
    </li>
  );
}
