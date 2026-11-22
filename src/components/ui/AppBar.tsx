"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { listApps, subscribe } from "@/lib/client/db";
import { onSyncState } from "@/lib/client/sync";
import { LOCALES, useI18n, type MessageKey } from "@/lib/i18n";
import { Icon, type IconName } from "./Icon";

/**
 * Top bar: title on the left; connection state and language on the right
 * (top-right for left-to-right scripts, per USWDS / DWP language guidance).
 * On wide screens it also carries the main navigation.
 */
export function AppBar({ title, back, publicPage }: { title?: MessageKey; back?: string; publicPage?: boolean }) {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-20 border-b border-rule bg-surface/95 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-3 sm:px-4">
        {back ? (
          <Link href={back} aria-label={t("back")} className="grid h-12 w-12 place-items-center rounded-full text-ink hover:bg-paper">
            <Icon name="back" size={26} />
          </Link>
        ) : publicPage ? (
          <span className="grid h-10 w-10 place-items-center rounded-full bg-indigo-700 text-[1.05rem] font-bold text-white" aria-hidden>
            ज
          </span>
        ) : (
          <Link href="/" className="grid h-10 w-10 place-items-center rounded-full bg-indigo-700 text-[1.05rem] font-bold text-white" aria-label={t("app.name")}>
            ज
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[1.1rem] font-bold leading-tight">{t(title ?? "app.name")}</p>
          <p className="truncate text-[0.8rem] leading-tight text-ink-3">{t("app.office")}</p>
        </div>
        {!publicPage && <DesktopNav />}
        {!publicPage && <Connection />}
        <LanguageMenu />
      </div>
    </header>
  );
}

const NAV: { href: string; key: MessageKey; icon: IconName }[] = [
  { href: "/", key: "nav.home", icon: "home" },
  { href: "/capture", key: "nav.scan", icon: "camera" },
  { href: "/queue", key: "nav.queue", icon: "list" },
  { href: "/settings", key: "nav.settings", icon: "settings" },
];

function DesktopNav() {
  const { t } = useI18n();
  const path = usePathname();
  return (
    <nav className="mr-2 hidden items-center gap-1 lg:flex" aria-label="Main">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          aria-current={path === n.href ? "page" : undefined}
          className={`flex h-11 items-center gap-2 rounded-full px-4 font-semibold ${path === n.href ? "bg-indigo-50 text-indigo-800" : "text-ink-2 hover:bg-paper"}`}
        >
          <Icon name={n.icon} size={20} />
          {t(n.key)}
        </Link>
      ))}
    </nav>
  );
}

/** Bottom tab bar for phones; hidden on wide screens where the app bar holds navigation. */
export function BottomNav() {
  const { t } = useI18n();
  const path = usePathname();
  const [toCheck, setToCheck] = useState(0);
  useEffect(() => {
    const refresh = () =>
      listApps()
        .then((a) => setToCheck(a.filter((x) => x.server_status === "read" || x.server_status === "read_failed").length))
        .catch(() => {});
    refresh();
    return subscribe(refresh);
  }, []);
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-surface lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {NAV.map((n) => {
          const active = path === n.href;
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-16 flex-col items-center justify-center gap-0.5 text-[0.78rem] font-semibold ${active ? "text-indigo-800" : "text-ink-3"}`}
              >
                {active && <span className="absolute inset-x-6 top-0 h-[3px] rounded-b bg-indigo-700" aria-hidden />}
                <Icon name={n.icon} size={24} />
                {t(n.key)}
                {n.href === "/queue" && toCheck > 0 && (
                  <span className="absolute right-[calc(50%-1.6rem)] top-2 min-w-5 rounded-full bg-marigold-500 px-1.5 text-center text-[0.72rem] font-bold leading-5 text-ink">
                    {toCheck}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Connection() {
  const { t } = useI18n();
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

  const label = !online ? t("conn.offline") : pending ? t("conn.pending", { n: pending }) : syncing ? t("conn.syncing") : t("conn.online");
  return (
    <Link
      href="/queue"
      title={label}
      className={`flex h-10 items-center gap-1.5 rounded-full px-3 text-[0.85rem] font-semibold ${online ? (pending ? "bg-marigold-50 text-marigold-700" : "text-ink-2") : "bg-ink text-white"}`}
    >
      {online ? (
        <span className={`h-2.5 w-2.5 rounded-full ${pending || syncing ? "animate-pulse bg-marigold-500" : "bg-indigo-600"}`} aria-hidden />
      ) : (
        <Icon name="offline" size={18} />
      )}
      <span className={online && !pending ? "sr-only sm:not-sr-only" : ""}>{label}</span>
    </Link>
  );
}

function LanguageMenu() {
  const { t, locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const current = LOCALES.find((l) => l.code === locale)!;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t("lang.label")}: ${current.name}`}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center gap-1.5 rounded-full px-3 font-semibold text-ink ring-1 ring-rule-strong hover:bg-paper"
      >
        <Icon name="globe" size={18} />
        <span className="text-[0.92rem]">{current.name}</span>
      </button>
      {open && (
        <ul role="menu" className="absolute right-0 top-12 z-30 w-44 overflow-hidden rounded-[var(--radius-control)] border border-rule bg-surface py-1 shadow-lg">
          {LOCALES.map((l) => (
            <li key={l.code} role="none">
              <button
                role="menuitemradio"
                aria-checked={l.code === locale}
                lang={l.tag}
                onClick={() => {
                  setLocale(l.code);
                  setOpen(false);
                }}
                className={`flex h-12 w-full items-center justify-between px-4 text-left text-[1rem] ${l.code === locale ? "font-bold text-indigo-800" : "text-ink hover:bg-paper"}`}
              >
                {l.name}
                {l.code === locale && <Icon name="check" size={20} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Page body width: narrow for reading and forms, wide for side-by-side work. */
export function Screen({ children, wide, padBottom = true }: { children: React.ReactNode; wide?: boolean; padBottom?: boolean }) {
  return (
    <main className={`mx-auto w-full flex-1 px-4 pt-5 ${wide ? "max-w-6xl" : "max-w-2xl"} ${padBottom ? "pb-32 lg:pb-12" : ""}`}>{children}</main>
  );
}
