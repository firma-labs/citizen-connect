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
  received: number;
  resolved: number;
  resolved_pct: number;
  avg_days_to_resolve: number | null;
  resolved_on_spot: number;
  /** Resolved within the department's response time, % of resolved. */
  within_time_pct: number;
  departments: { code: string; received: number; resolved: number; rate: number }[];
}

/**
 * Sample figures for PoC demos, shown (labelled "Sample") until the pilot has
 * enough real applications; then the landing page shows the live ones.
 */
export const SAMPLE_FIGURES: ResolutionFigures = {
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
