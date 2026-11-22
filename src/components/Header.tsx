"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listApps, subscribe } from "@/lib/client/db";
import { onSyncState } from "@/lib/client/sync";

export function Header({ title, back }: { title?: string; back?: string }) {
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const off = onSyncState((s) => {
      setOnline(s.online);
      setSyncing(s.running);
    });
    const refresh = () =>
      listApps()
        .then((apps) => setPending(apps.filter((a) => a.state === "queued").length))
        .catch(() => {});
    refresh();
    const unsub = subscribe(refresh);
    return () => {
      off();
      unsub();
    };
  }, []);

  return (
    <header className="sticky top-0 z-20 bg-forest-700 text-white shadow-md" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
        {back ? (
          <Link href={back} aria-label="Back" className="-ml-2 grid h-11 w-11 place-items-center rounded-full text-2xl hover:bg-white/10">
            ←
          </Link>
        ) : null}
        <Link href="/" className="min-w-0 flex-1">
          <div className="truncate text-lg font-extrabold leading-tight">{title ?? "जनता दरबार"}</div>
          <div className="text-xs text-white/80">Citizen Connect · वनमंत्री कार्यालय</div>
        </Link>
        <Link
          href="/queue"
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${online ? "bg-white/15" : "bg-warn-500"}`}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${online ? (syncing ? "bg-yellow-300 animate-pulse" : "bg-green-300") : "bg-white"}`} />
          {online ? (pending ? `${pending} sync` : "Online") : `Offline${pending ? ` · ${pending}` : ""}`}
        </Link>
      </div>
    </header>
  );
}

export function Page({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-4">{children}</main>;
}

/** Big, bilingual primary action button. */
export function BigButton({
  mr,
  en,
  onClick,
  href,
  variant = "primary",
  disabled,
  type = "button",
}: {
  mr: string;
  en: string;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const cls = {
    primary: "bg-forest-700 text-white active:bg-forest-900 disabled:bg-gray-400",
    secondary: "bg-white text-forest-800 border-2 border-forest-700 active:bg-forest-50 disabled:opacity-50",
    danger: "bg-white text-danger-600 border-2 border-danger-600 active:bg-danger-50",
  }[variant];
  const inner = (
    <>
      <span className="block text-xl font-extrabold leading-tight">{mr}</span>
      <span className="block text-sm font-semibold opacity-85">{en}</span>
    </>
  );
  const base = `block w-full min-h-16 rounded-2xl px-5 py-3 text-center shadow-sm ${cls}`;
  if (href) return <Link href={href} className={base}>{inner}</Link>;
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={base}>
      {inner}
    </button>
  );
}
