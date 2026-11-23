"use client";

import { LegalPage } from "@/components/LegalPage";

/** Terms of use for the citizen status page. Draft until the office issues the final text. */
export default function TermsPage() {
  return (
    <LegalPage
      title="terms.title"
      sections={[
        ["terms.service.h", "terms.service.p"],
        ["terms.status.h", "terms.status.p"],
        ["terms.use.h", "terms.use.p"],
        ["terms.availability.h", "terms.availability.p"],
      ]}
    />
  );
}
