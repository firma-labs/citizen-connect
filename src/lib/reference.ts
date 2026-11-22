// Reference data from PRD §8. Shared by client and server.

export const VENUES = [
  { code: "NM", name: "Navi Mumbai", mr: "नवी मुंबई" },
  { code: "TH", name: "Thane", mr: "ठाणे" },
  { code: "PG", name: "Palghar", mr: "पालघर" },
] as const;
export type VenueCode = (typeof VENUES)[number]["code"];

export const CATEGORIES = [
  { code: "water_supply", en: "Water supply", mr: "पाणीपुरवठा" },
  { code: "roads_drainage", en: "Roads & drainage", mr: "रस्ते व गटारे" },
  { code: "housing_property", en: "Housing / property", mr: "घरकुल / मालमत्ता" },
  { code: "land_records", en: "Land records", mr: "जमीन अभिलेख" },
  { code: "pension_welfare", en: "Pension & welfare", mr: "निवृत्तीवेतन व कल्याण" },
  { code: "ration_card", en: "Ration card", mr: "शिधापत्रिका" },
  { code: "electricity", en: "Electricity", mr: "वीज" },
  { code: "police_complaint", en: "Police complaint", mr: "पोलीस तक्रार" },
  { code: "wildlife_damage", en: "Wildlife damage compensation", mr: "वन्यजीव नुकसान भरपाई" },
  { code: "forest_rights", en: "Forest land / forest rights", mr: "वनजमीन / वनहक्क" },
  { code: "health", en: "Health", mr: "आरोग्य" },
  { code: "education", en: "Education", mr: "शिक्षण" },
  { code: "employment", en: "Employment", mr: "रोजगार" },
  { code: "other", en: "Other", mr: "इतर" },
] as const;
export type CategoryCode = (typeof CATEGORIES)[number]["code"];
export const CATEGORY_CODES = CATEGORIES.map((c) => c.code) as [CategoryCode, ...CategoryCode[]];

export const DEPARTMENTS = [
  { code: "NMMC", name: "Navi Mumbai Municipal Corporation", mr: "नवी मुंबई महानगरपालिका", sla: 15 },
  { code: "TMC", name: "Thane Municipal Corporation", mr: "ठाणे महानगरपालिका", sla: 15 },
  { code: "CIDCO", name: "CIDCO", mr: "सिडको", sla: 30 },
  { code: "REV", name: "Revenue – Tahsildar / Collector", mr: "महसूल – तहसीलदार / जिल्हाधिकारी", sla: 21 },
  { code: "POL", name: "Police", mr: "पोलीस", sla: 7 },
  { code: "FOR", name: "Forest Department", mr: "वन विभाग", sla: 30 },
  { code: "TRB", name: "Tribal Development", mr: "आदिवासी विकास", sla: 30 },
  { code: "ZP", name: "Zilla Parishad, Palghar", mr: "जिल्हा परिषद, पालघर", sla: 21 },
  { code: "MSEDCL", name: "MSEDCL – Electricity", mr: "महावितरण", sla: 15 },
  { code: "FCS", name: "Food & Civil Supplies", mr: "अन्न व नागरी पुरवठा", sla: 15 },
  { code: "PWD", name: "Public Works Department", mr: "सार्वजनिक बांधकाम विभाग", sla: 30 },
  { code: "HLT", name: "Public Health", mr: "सार्वजनिक आरोग्य", sla: 7 },
  { code: "OTH", name: "Minister's office – other", mr: "मंत्री कार्यालय – इतर", sla: 15 },
] as const;
export type DepartmentCode = (typeof DEPARTMENTS)[number]["code"];
export const DEPARTMENT_CODES = DEPARTMENTS.map((d) => d.code) as [DepartmentCode, ...DepartmentCode[]];

export const PRIORITIES = [
  { code: "urgent", en: "Urgent", mr: "तातडीचे" },
  { code: "high", en: "High", mr: "उच्च" },
  { code: "normal", en: "Normal", mr: "सामान्य" },
  { code: "low", en: "Low", mr: "कमी" },
] as const;
export type PriorityCode = (typeof PRIORITIES)[number]["code"];

export const LANGUAGES = [
  { code: "mr", en: "Marathi", mr: "मराठी" },
  { code: "hi", en: "Hindi", mr: "हिंदी" },
  { code: "en", en: "English", mr: "इंग्रजी" },
  { code: "other", en: "Other", mr: "इतर" },
] as const;
export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const PAGE_TYPES = [
  { code: "letter", en: "Letter", mr: "अर्ज" },
  { code: "enclosure", en: "Enclosure", mr: "सोबतचे कागद" },
  { code: "id_document", en: "ID document", mr: "ओळखपत्र" },
  { code: "photo", en: "Photo", mr: "छायाचित्र" },
  { code: "envelope", en: "Envelope", mr: "लिफाफा" },
  { code: "other", en: "Other", mr: "इतर" },
] as const;

export const dept = (code: string | null | undefined) => DEPARTMENTS.find((d) => d.code === code);
export const category = (code: string | null | undefined) => CATEGORIES.find((c) => c.code === code);
export const venue = (code: string | null | undefined) => VENUES.find((v) => v.code === code);
