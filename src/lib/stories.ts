// Sample citizen stories for the public landing page (PoC demos). Like the
// sample letters, they are fictional and always shown with a "Sample" label;
// replace them with real feedback (with consent) once the pilot collects it.
// The text lives in messages/*.json under story.<id>.

import type { MessageKey } from "./i18n";

export type StoryArt = "water" | "crop" | "pension" | "wildlife";

export interface SampleStory {
  id: string;
  art: StoryArt;
  /** Days from the Darbar to resolution, as told in the story. */
  days: number;
  name: MessageKey;
  place: MessageKey;
  issue: MessageKey;
  quote: MessageKey;
}

const story = (id: string, art: StoryArt, days: number): SampleStory => ({
  id,
  art,
  days,
  name: `story.${id}.name` as MessageKey,
  place: `story.${id}.place` as MessageKey,
  issue: `story.${id}.issue` as MessageKey,
  quote: `story.${id}.quote` as MessageKey,
});

export const SAMPLE_STORIES: SampleStory[] = [
  story("water", "water", 12),
  story("crop", "crop", 18),
  story("pension", "pension", 26),
  story("leopard", "wildlife", 6),
];

/** Resolution figures as the public landing page shows them. */
export interface ResolutionFigures {
  /** "pilot": since the first application; "12m": the past 12 months. */
  period: "pilot" | "12m";
  /** First month counted, "YYYY-MM". */
  since: string;
  updated_at: string | null;
  received: number;
  resolved: number;
  resolved_pct: number;
  avg_days_to_resolve: number | null;
  resolved_on_spot: number;
  /** Resolved within the department's response time, % of resolved. */
  within_time_pct: number;
  departments: { code: string; received: number; resolved: number; rate: number }[];
  /** Applications received and resolved per month ("YYYY-MM"), oldest first. */
  monthly: { month: string; received: number; resolved: number }[];
}

/** The 12 months ending with the current one (India time), oldest first, as "YYYY-MM". */
function last12Months(now = new Date()): string[] {
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" })
    .format(now)
    .split("-")
    .map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (11 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

// A believable year: steady intake, resolutions catching up. Sums match the totals below.
const SAMPLE_RECEIVED = [82, 90, 96, 104, 99, 108, 112, 110, 105, 113, 115, 114];
const SAMPLE_RESOLVED = [38, 52, 60, 70, 72, 80, 84, 86, 82, 88, 90, 84];

/**
 * Sample figures for PoC demos, shown (labelled "Sample") until the pilot has
 * enough real applications; then the landing page shows the live ones.
 */
export function sampleFigures(now = new Date()): ResolutionFigures {
  const months = last12Months(now);
  return {
    ...SAMPLE_TOTALS,
    since: months[0],
    monthly: months.map((month, i) => ({ month, received: SAMPLE_RECEIVED[i], resolved: SAMPLE_RESOLVED[i] })),
  };
}

const SAMPLE_TOTALS: Omit<ResolutionFigures, "since" | "monthly"> = {
  period: "12m",
  updated_at: null,
  received: 1248,
  resolved: 886,
  resolved_pct: 71,
  avg_days_to_resolve: 13,
  resolved_on_spot: 142,
  within_time_pct: 84,
  departments: [
    { code: "NMMC", received: 412, resolved: 321, rate: 78 },
    { code: "REV", received: 286, resolved: 197, rate: 69 },
    { code: "FOR", received: 194, resolved: 157, rate: 81 },
    { code: "ZP", received: 158, resolved: 101, rate: 64 },
  ],
};
