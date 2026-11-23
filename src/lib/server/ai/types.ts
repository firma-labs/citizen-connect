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

/** Facts the Minister's briefing is written from (no citizen names or numbers). */
export interface BriefingInput {
  stats: unknown;
  attention: { token: string; department: string; subject: string | null; days_open: number; overdue: boolean; priority: string }[];
}

export interface Briefing {
  en: string;
  mr: string;
}

/** PRD §4.1 #9 — short briefing for the Minister before a Darbar, in English and Marathi. */
export interface Briefer {
  readonly id: string;
  brief(input: BriefingInput): Promise<Briefing>;
}

/** PRD §7.1 — Reasoner: text + fields → summary, category, department, priority. */
export interface Reasoner {
  readonly id: string;
  reason(input: ReaderOutput): Promise<ReasonerOutput>;
}
