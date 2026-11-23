"use client";

import { LegalPage } from "@/components/LegalPage";

/** Accessibility statement (GIGW 3.0, WCAG 2.1 AA). Draft until the office issues the final text. */
export default function AccessibilityPage() {
  return (
    <LegalPage
      title="a11y.title"
      sections={[
        ["a11y.aim.h", "a11y.aim.p"],
        ["a11y.works.h", "a11y.works.p"],
        ["a11y.limits.h", "a11y.limits.p"],
        ["a11y.contact.h", "a11y.contact.p"],
      ]}
    />
  );
}
