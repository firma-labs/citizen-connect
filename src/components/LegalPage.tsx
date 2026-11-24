"use client";

import Link from "@/components/ui/Link";
import { AppBar, Screen } from "@/components/ui/AppBar";
import { Notice } from "@/components/ui/Notice";
import { PublicFooter } from "@/components/PublicFooter";
import { useI18n, type MessageKey } from "@/lib/i18n";

/** A short public notice page (privacy, terms, accessibility), written in all three languages. */
export function LegalPage({ title, sections }: { title: MessageKey; sections: [MessageKey, MessageKey][] }) {
  const { t } = useI18n();
  return (
    <>
      <AppBar publicPage />
      <Screen>
        <h1 className="text-[1.7rem] font-bold tracking-tight">{t(title)}</h1>
        <Notice tone="attention" className="mt-4">
          {t("legal.draft")}
        </Notice>
        <div className="mt-6 space-y-6">
          {sections.map(([h, p]) => (
            <section key={h}>
              <h2 className="text-[1.1rem] font-bold">{t(h)}</h2>
              <p className="mt-1 text-ink-2">{t(p)}</p>
            </section>
          ))}
        </div>
        <p className="mt-8">
          <Link href="/track" className="font-semibold text-primary underline underline-offset-4">
            {t("legal.back")}
          </Link>
        </p>
        <PublicFooter />
      </Screen>
    </>
  );
}
