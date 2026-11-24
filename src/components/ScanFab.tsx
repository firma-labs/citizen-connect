"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { Icon } from "./ui/Icon";

/**
 * Material 3 floating action button for the app's main action: icon only,
 * in the softer tonal colours so it sits lightly over the lists (Queue,
 * Applications). Scanning is an action, not a place, so it floats instead of
 * taking a tab; Home has its own large Scan button. The label stays for
 * screen readers and as a tooltip.
 */
export function ScanFab() {
  const { t } = useI18n();
  return (
    <Link
      href="/capture"
      aria-label={t("home.scan.label")}
      title={t("home.scan.label")}
      className="fixed right-4 z-10 grid h-14 w-14 place-items-center rounded-[16px] bg-primary-container text-on-primary-container shadow-[var(--elevation-1)] transition-[background-color,box-shadow] hover:bg-primary-container-hover hover:shadow-[var(--elevation-3)] bottom-[calc(68px+16px+env(safe-area-inset-bottom))] lg:bottom-6 lg:right-6"
    >
      <Icon name="camera" size={24} />
    </Link>
  );
}
