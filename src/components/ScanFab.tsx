"use client";

import Link from "@/components/ui/Link";
import { useI18n } from "@/lib/i18n";
import { Icon } from "./ui/Icon";

/**
 * Material 3 extended floating action button for the app's main action.
 * Scanning is an action, not a place, so it floats over the lists (Queue,
 * Applications) instead of taking a tab; Home has its own large Scan button.
 */
export function ScanFab() {
  const { t } = useI18n();
  return (
    <Link
      href="/capture"
      aria-label={t("home.scan.label")}
      className="fixed right-4 z-10 inline-flex h-14 items-center gap-2.5 rounded-[16px] bg-primary px-5 font-semibold text-on-primary shadow-[var(--elevation-3)] transition-colors hover:bg-primary-hover bottom-[calc(68px+16px+env(safe-area-inset-bottom))] lg:bottom-6 lg:right-6"
    >
      <Icon name="camera" size={22} />
      {t("nav.scan")}
    </Link>
  );
}
