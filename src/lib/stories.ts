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
