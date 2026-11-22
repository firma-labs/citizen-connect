import type { ReaderOutput, ReasonerOutput } from "@/lib/types";

export interface PageImage {
  index: number;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  base64: string;
}

/** PRD §7.1 — Reader: page images → text + raw fields. */
export interface Reader {
  readonly id: string;
  read(pages: PageImage[]): Promise<ReaderOutput>;
}

/** PRD §7.1 — Reasoner: text + fields → summary, category, department, priority. */
export interface Reasoner {
  readonly id: string;
  reason(input: ReaderOutput): Promise<ReasonerOutput>;
}
