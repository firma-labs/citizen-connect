// Sample letters for demos and testing (PRD §9.1: mock letters only). The same
// fictional letters as the "Janata Darbar intake" mock, photographed on a
// table, so they also exercise page straightening and clean-up.

import type { MessageKey } from "./i18n";

export interface SampleLetter {
  id: string;
  pages: string[];
  title: MessageKey;
  meta: MessageKey;
}

export const SAMPLE_LETTERS: SampleLetter[] = [
  { id: "water", pages: ["/samples/water-supply.jpg"], title: "samples.water", meta: "samples.meta.water" },
  { id: "crop", pages: ["/samples/crop-damage.jpg"], title: "samples.crop", meta: "samples.meta.crop" },
  { id: "pension", pages: ["/samples/pension.jpg"], title: "samples.pension", meta: "samples.meta.pension" },
  {
    id: "leopard",
    pages: ["/samples/leopard-1.jpg", "/samples/leopard-2.jpg", "/samples/leopard-3.jpg"],
    title: "samples.leopard",
    meta: "samples.meta.leopard",
  },
];
