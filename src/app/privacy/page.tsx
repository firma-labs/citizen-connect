"use client";

import { LegalPage } from "@/components/LegalPage";

/** Privacy notice (DPDP Act 2023, GIGW). Draft until the office issues the final text. */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="privacy.title"
      sections={[
        ["privacy.collect.h", "privacy.collect.p"],
        ["privacy.why.h", "privacy.why.p"],
        ["privacy.who.h", "privacy.who.p"],
        ["privacy.ai.h", "privacy.ai.p"],
        ["privacy.keep.h", "privacy.keep.p"],
        ["privacy.rights.h", "privacy.rights.p"],
        ["privacy.status.h", "privacy.status.p"],
      ]}
    />
  );
}
