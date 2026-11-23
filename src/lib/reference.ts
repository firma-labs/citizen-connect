// Reference data from PRD §8. Shared by client and server.
// Codes and SLAs live here; their labels live in messages/<lang>.json under
// "ref.*" so they are translated and reviewed with the rest of the UI text.

import { translate, type MessageKey } from "./i18n/core";

/** Labels of a reference item in every UI language (`name` = English, used in AI prompts and the API). */
const label = (key: MessageKey) => {
  const en = translate("en", key);
  return { name: en, en, mr: translate("mr", key), hi: translate("hi", key) };
};

export const VENUES = [
  { code: "NM", ...label("ref.venue.NM") },
  { code: "TH", ...label("ref.venue.TH") },
  { code: "PG", ...label("ref.venue.PG") },
] as const;
export type VenueCode = (typeof VENUES)[number]["code"];

export const CATEGORIES = [
  { code: "water_supply", ...label("ref.category.water_supply") },
  { code: "roads_drainage", ...label("ref.category.roads_drainage") },
  { code: "housing_property", ...label("ref.category.housing_property") },
  { code: "land_records", ...label("ref.category.land_records") },
  { code: "pension_welfare", ...label("ref.category.pension_welfare") },
  { code: "ration_card", ...label("ref.category.ration_card") },
  { code: "electricity", ...label("ref.category.electricity") },
  { code: "police_complaint", ...label("ref.category.police_complaint") },
  { code: "wildlife_damage", ...label("ref.category.wildlife_damage") },
  { code: "forest_rights", ...label("ref.category.forest_rights") },
  { code: "health", ...label("ref.category.health") },
  { code: "education", ...label("ref.category.education") },
  { code: "employment", ...label("ref.category.employment") },
  { code: "other", ...label("ref.category.other") },
] as const;
export type CategoryCode = (typeof CATEGORIES)[number]["code"];
export const CATEGORY_CODES = CATEGORIES.map((c) => c.code) as [CategoryCode, ...CategoryCode[]];

export const DEPARTMENTS = [
  { code: "NMMC", ...label("ref.department.NMMC"), sla: 15 },
  { code: "TMC", ...label("ref.department.TMC"), sla: 15 },
  { code: "CIDCO", ...label("ref.department.CIDCO"), sla: 30 },
  { code: "REV", ...label("ref.department.REV"), sla: 21 },
  { code: "POL", ...label("ref.department.POL"), sla: 7 },
  { code: "FOR", ...label("ref.department.FOR"), sla: 30 },
  { code: "TRB", ...label("ref.department.TRB"), sla: 30 },
  { code: "ZP", ...label("ref.department.ZP"), sla: 21 },
  { code: "MSEDCL", ...label("ref.department.MSEDCL"), sla: 15 },
  { code: "FCS", ...label("ref.department.FCS"), sla: 15 },
  { code: "PWD", ...label("ref.department.PWD"), sla: 30 },
  { code: "HLT", ...label("ref.department.HLT"), sla: 7 },
  { code: "OTH", ...label("ref.department.OTH"), sla: 15 },
] as const;
export type DepartmentCode = (typeof DEPARTMENTS)[number]["code"];
export const DEPARTMENT_CODES = DEPARTMENTS.map((d) => d.code) as [DepartmentCode, ...DepartmentCode[]];

export const PRIORITIES = [
  { code: "urgent", ...label("ref.priority.urgent") },
  { code: "high", ...label("ref.priority.high") },
  { code: "normal", ...label("ref.priority.normal") },
  { code: "low", ...label("ref.priority.low") },
] as const;
export type PriorityCode = (typeof PRIORITIES)[number]["code"];

export const LANGUAGES = [
  { code: "mr", ...label("ref.language.mr") },
  { code: "hi", ...label("ref.language.hi") },
  { code: "en", ...label("ref.language.en") },
  { code: "other", ...label("ref.language.other") },
] as const;
export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const PAGE_TYPES = [
  { code: "letter", ...label("ref.pageType.letter") },
  { code: "enclosure", ...label("ref.pageType.enclosure") },
  { code: "id_document", ...label("ref.pageType.id_document") },
  { code: "photo", ...label("ref.pageType.photo") },
  { code: "envelope", ...label("ref.pageType.envelope") },
  { code: "other", ...label("ref.pageType.other") },
] as const;

/** Label of a reference item in the UI language. */
export function refLabel(item: { en: string; mr: string; hi: string } | undefined, locale: "mr" | "en" | "hi"): string {
  return item ? item[locale] : "";
}

export const dept = (code: string | null | undefined) => DEPARTMENTS.find((d) => d.code === code);
export const category = (code: string | null | undefined) => CATEGORIES.find((c) => c.code === code);
export const venue = (code: string | null | undefined) => VENUES.find((v) => v.code === code);
