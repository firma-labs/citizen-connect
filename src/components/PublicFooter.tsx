"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

/** Footer for the citizen-facing pages (GIGW / UX4G): who runs the service and the required notices. */
export function PublicFooter() {
  const { t } = useI18n();
  return (
    <footer className="mt-12 border-t border-rule pt-5 text-[0.9rem] text-ink-3">
      <p className="font-semibold text-ink-2">{t("footer.office")}</p>
      <p className="mt-0.5">{t("footer.contact")}</p>
      <nav aria-label={t("footer.nav")} className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/privacy" className="underline underline-offset-4 hover:text-ink">
          {t("footer.privacy")}
        </Link>
        <Link href="/terms" className="underline underline-offset-4 hover:text-ink">
          {t("footer.terms")}
        </Link>
        <Link href="/accessibility" className="underline underline-offset-4 hover:text-ink">
          {t("footer.accessibility")}
        </Link>
      </nav>
    </footer>
  );
}
