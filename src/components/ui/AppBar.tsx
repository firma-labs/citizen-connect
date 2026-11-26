"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { listApps, subscribe } from "@/lib/client/db";
import { canGoBackInApp } from "@/lib/client/nav";
import { officeSummary, useOfficeApplications } from "@/lib/client/office";
import { useIsStaff } from "@/lib/client/session";
import { onSyncState } from "@/lib/client/sync";
import { LOCALES, useI18n, type MessageKey } from "@/lib/i18n";
import { Icon, type IconName } from "./Icon";

/**
 * Top bar: title on the left; connection state and language on the right
 * (top-right for left-to-right scripts, per USWDS / DWP language guidance).
 * On wide screens it also carries the main navigation.
 */
export function AppBar({
  title,
  back,
  publicPage: publicOnly,
}: {
  title?: MessageKey;
  back?: string;
  publicPage?: boolean;
}) {
  const { t } = useI18n();
  // Public pages (citizen status) still give staff their navigation.
  const staff = useIsStaff();
  const publicPage = publicOnly && !staff;
  return (
    <header
      className="sticky top-0 z-20 border-b border-rule bg-surface/90 backdrop-blur-md"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* Skip link (WCAG 2.4.1, GIGW): hidden until reached with the keyboard. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-[var(--radius-button)] focus:bg-primary focus:px-4 focus:py-3 focus:font-semibold focus:text-on-primary"
      >
        {t("a11y.skip")}
      </a>
      {/* Wraps onto two lines when the text size is large, instead of pushing controls off screen. */}
      <div className="mx-auto flex min-h-[4.25rem] max-w-6xl flex-wrap items-center gap-x-2.5 gap-y-1 px-3 py-1.5 sm:px-4">
        {back ? (
          <BackLink fallback={back} />
        ) : publicPage ? (
          <Avatar />
        ) : (
          <Link href="/" aria-label={t("app.name")} className="rounded-full">
            <Avatar />
          </Link>
        )}
        <div className="min-w-[5rem] flex-1 basis-0">
          <p className="truncate text-[1.08rem] font-semibold leading-tight tracking-tight">
            {t(title ?? "app.name")}
          </p>
          <p className="truncate text-[0.78rem] leading-snug text-ink-3">
            {t("app.office")}
          </p>
        </div>
        {!publicPage && <DesktopNav />}
        <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
          {!publicPage && <Connection />}
          <LanguageMenu />
          {/* Settings sits in the top bar: the bottom bar holds the five working screens. */}
          {!publicPage && (
            <Link
              href="/settings"
              aria-label={t("nav.settings")}
              title={t("nav.settings")}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-2 transition-colors hover:bg-ink/5"
            >
              <Icon name="gear" size={22} />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * Back arrow: returns to the screen you came from (Queue, Applications, Home…)
 * when there is one in this tab; otherwise, e.g. opened from a link or a fresh
 * launch, goes to `fallback`, the screen's parent.
 */
function BackLink({ fallback }: { fallback: string }) {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <Link
      href={fallback}
      aria-label={t("back")}
      title={t("back")}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || !canGoBackInApp()) return;
        e.preventDefault();
        router.back();
      }}
      className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-ink transition-colors hover:bg-ink/5 active:bg-ink/10"
    >
      <Icon name="back" size={26} />
    </Link>
  );
}

const NAV: { href: string; key: MessageKey; icon: IconName }[] = [
  { href: "/", key: "nav.home", icon: "home" },
  { href: "/queue", key: "nav.queue", icon: "list" },
  { href: "/applications", key: "nav.applications", icon: "folder" },
  { href: "/dashboard", key: "nav.dashboard", icon: "chart" },
];

/** Pastel conic-gradient mark, as in the Janata Darbar prototype. */
function Avatar() {
  return (
    <span
      aria-hidden
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[1.05rem] font-bold text-ink shadow-[inset_0_0_0_2px_rgb(255_255_255/0.7)]"
      style={{
        background:
          "conic-gradient(from 200deg, #ffd7c2, #f6c1e0, #d6ccfd, #b4d6fb, #a9e2c6, #ffd7c2)",
      }}
    >
      ज
    </span>
  );
}

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
          className={`flex h-10 items-center gap-2 rounded-full px-4 font-medium transition-colors ${path === n.href ? "bg-primary-container font-semibold text-on-primary-container" : "text-ink-2 hover:bg-ink/5"}`}
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
  // Same office-wide number as the Home and Queue tiles.
  const { local, server } = useOfficeApplications();
  const toCheck = officeSummary(local, server).toCheck;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-surface/95 backdrop-blur-md lg:hidden"
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
                className={`relative flex h-[68px] flex-col items-center justify-center gap-1 px-0.5 text-center text-[min(0.74rem,14px)] font-medium leading-tight ${active ? "font-semibold text-ink" : "text-ink-3"}`}
              >
                <span
                  className={`grid h-8 w-full max-w-14 place-items-center rounded-full transition-colors ${active ? "bg-primary-container text-on-primary-container" : ""}`}
                >
                  <Icon name={n.icon} size={22} />
                </span>
                {t(n.key)}
                {n.href === "/queue" && toCheck > 0 && (
                  <span className="absolute right-[calc(50%-32px)] top-1.5 min-w-5 rounded-full bg-marigold-500 px-1.5 text-center text-[12px] font-bold leading-5 text-white ring-2 ring-white">
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
        .then((apps) =>
          setPending(apps.filter((a) => a.state === "queued").length),
        )
        .catch(() => {});
    refresh();
    const unsub = subscribe(refresh);
    return () => {
      off();
      unsub();
    };
  }, []);

  const label = !online
    ? t("conn.offline")
    : pending
      ? t("conn.pending", { n: pending })
      : syncing
        ? t("conn.syncing")
        : t("conn.online");
  return (
    <Link
      href="/queue"
      title={label}
      className={`flex h-10 items-center gap-1.5 rounded-full px-3 text-[0.85rem] font-medium ${online ? (pending ? "bg-marigold-50 text-marigold-700" : "text-ink-2") : "bg-ink text-white"}`}
    >
      {online ? (
        <span
          className={`h-2.5 w-2.5 rounded-full ring-4 ${pending || syncing ? "animate-pulse bg-marigold-500 ring-marigold-50" : "bg-mint-500 ring-mint-50"}`}
          aria-hidden
        />
      ) : (
        <Icon name="offline" size={18} />
      )}
      <span className={online && !pending ? "sr-only sm:not-sr-only" : ""}>
        {label}
      </span>
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
      if (
        e instanceof KeyboardEvent
          ? e.key === "Escape"
          : !ref.current?.contains(e.target as Node)
      )
        setOpen(false);
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
        className="flex h-10 items-center gap-1.5 rounded-full bg-surface-container px-3.5 font-medium text-ink transition-colors hover:bg-surface-container-high"
      >
        <Icon name="globe" size={18} />
        <span className="text-[0.92rem]">{current.name}</span>
      </button>
      {open && (
        <ul
          role="menu"
          className="absolute right-0 top-12 z-30 w-48 overflow-hidden rounded-[var(--radius-button)] bg-surface-container-low p-1.5 shadow-[var(--elevation-3)]"
        >
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
                className={`flex h-12 w-full items-center justify-between rounded-[var(--radius-control)] px-3.5 text-left text-[1rem] ${l.code === locale ? "bg-primary-container font-semibold text-on-primary-container" : "text-ink hover:bg-ink/5"}`}
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
export function Screen({
  children,
  wide,
  padBottom = true,
}: {
  children: React.ReactNode;
  wide?: boolean;
  padBottom?: boolean;
}) {
  return (
    <main
      id="main"
      tabIndex={-1}
      className={`mx-auto w-full flex-1 px-4 pt-5 outline-none ${wide ? "max-w-6xl" : "max-w-2xl"} ${padBottom ? "pb-32 lg:pb-12" : ""}`}
    >
      {children}
    </main>
  );
}
