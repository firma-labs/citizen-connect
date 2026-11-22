// Reference data from PRD §8. Shared by client and server.

export const VENUES = [
  { code: "NM", name: "Navi Mumbai", en: "Navi Mumbai", mr: "नवी मुंबई", hi: "नवी मुंबई" },
  { code: "TH", name: "Thane", en: "Thane", mr: "ठाणे", hi: "ठाणे" },
  { code: "PG", name: "Palghar", en: "Palghar", mr: "पालघर", hi: "पालघर" },
] as const;
export type VenueCode = (typeof VENUES)[number]["code"];

export const CATEGORIES = [
  { code: "water_supply", en: "Water supply", mr: "पाणीपुरवठा", hi: "जल आपूर्ति" },
  { code: "roads_drainage", en: "Roads & drainage", mr: "रस्ते व गटारे", hi: "सड़क और नाली" },
  { code: "housing_property", en: "Housing / property", mr: "घरकुल / मालमत्ता", hi: "आवास / संपत्ति" },
  { code: "land_records", en: "Land records", mr: "जमीन अभिलेख", hi: "भूमि अभिलेख" },
  { code: "pension_welfare", en: "Pension & welfare", mr: "निवृत्तीवेतन व कल्याण", hi: "पेंशन और कल्याण" },
  { code: "ration_card", en: "Ration card", mr: "शिधापत्रिका", hi: "राशन कार्ड" },
  { code: "electricity", en: "Electricity", mr: "वीज", hi: "बिजली" },
  { code: "police_complaint", en: "Police complaint", mr: "पोलीस तक्रार", hi: "पुलिस शिकायत" },
  { code: "wildlife_damage", en: "Wildlife damage compensation", mr: "वन्यजीव नुकसान भरपाई", hi: "वन्यजीव क्षति मुआवज़ा" },
  { code: "forest_rights", en: "Forest land / forest rights", mr: "वनजमीन / वनहक्क", hi: "वन भूमि / वन अधिकार" },
  { code: "health", en: "Health", mr: "आरोग्य", hi: "स्वास्थ्य" },
  { code: "education", en: "Education", mr: "शिक्षण", hi: "शिक्षा" },
  { code: "employment", en: "Employment", mr: "रोजगार", hi: "रोज़गार" },
  { code: "other", en: "Other", mr: "इतर", hi: "अन्य" },
] as const;
export type CategoryCode = (typeof CATEGORIES)[number]["code"];
export const CATEGORY_CODES = CATEGORIES.map((c) => c.code) as [CategoryCode, ...CategoryCode[]];

export const DEPARTMENTS = [
  { code: "NMMC", name: "Navi Mumbai Municipal Corporation", mr: "नवी मुंबई महानगरपालिका", hi: "नवी मुंबई महानगर पालिका", sla: 15 },
  { code: "TMC", name: "Thane Municipal Corporation", mr: "ठाणे महानगरपालिका", hi: "ठाणे महानगर पालिका", sla: 15 },
  { code: "CIDCO", name: "CIDCO", mr: "सिडको", hi: "सिडको", sla: 30 },
  { code: "REV", name: "Revenue – Tahsildar / Collector", mr: "महसूल – तहसीलदार / जिल्हाधिकारी", hi: "राजस्व – तहसीलदार / कलेक्टर", sla: 21 },
  { code: "POL", name: "Police", mr: "पोलीस", hi: "पुलिस", sla: 7 },
  { code: "FOR", name: "Forest Department", mr: "वन विभाग", hi: "वन विभाग", sla: 30 },
  { code: "TRB", name: "Tribal Development", mr: "आदिवासी विकास", hi: "आदिवासी विकास", sla: 30 },
  { code: "ZP", name: "Zilla Parishad, Palghar", mr: "जिल्हा परिषद, पालघर", hi: "ज़िला परिषद, पालघर", sla: 21 },
  { code: "MSEDCL", name: "MSEDCL – Electricity", mr: "महावितरण", hi: "महावितरण – बिजली", sla: 15 },
  { code: "FCS", name: "Food & Civil Supplies", mr: "अन्न व नागरी पुरवठा", hi: "खाद्य एवं नागरिक आपूर्ति", sla: 15 },
  { code: "PWD", name: "Public Works Department", mr: "सार्वजनिक बांधकाम विभाग", hi: "लोक निर्माण विभाग", sla: 30 },
  { code: "HLT", name: "Public Health", mr: "सार्वजनिक आरोग्य", hi: "सार्वजनिक स्वास्थ्य", sla: 7 },
  { code: "OTH", name: "Minister's office – other", mr: "मंत्री कार्यालय – इतर", hi: "मंत्री कार्यालय – अन्य", sla: 15 },
] as const;
export type DepartmentCode = (typeof DEPARTMENTS)[number]["code"];
export const DEPARTMENT_CODES = DEPARTMENTS.map((d) => d.code) as [DepartmentCode, ...DepartmentCode[]];

export const PRIORITIES = [
  { code: "urgent", en: "Urgent", mr: "तातडीचे", hi: "अति आवश्यक" },
  { code: "high", en: "High", mr: "उच्च", hi: "उच्च" },
  { code: "normal", en: "Normal", mr: "सामान्य", hi: "सामान्य" },
  { code: "low", en: "Low", mr: "कमी", hi: "निम्न" },
] as const;
export type PriorityCode = (typeof PRIORITIES)[number]["code"];

export const LANGUAGES = [
  { code: "mr", en: "Marathi", mr: "मराठी", hi: "मराठी" },
  { code: "hi", en: "Hindi", mr: "हिंदी", hi: "हिंदी" },
  { code: "en", en: "English", mr: "इंग्रजी", hi: "अंग्रेज़ी" },
  { code: "other", en: "Other", mr: "इतर", hi: "अन्य" },
] as const;
export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const PAGE_TYPES = [
  { code: "letter", en: "Letter", mr: "अर्ज", hi: "पत्र" },
  { code: "enclosure", en: "Enclosure", mr: "सोबतचे कागद", hi: "संलग्नक" },
  { code: "id_document", en: "ID document", mr: "ओळखपत्र", hi: "पहचान पत्र" },
  { code: "photo", en: "Photo", mr: "छायाचित्र", hi: "फ़ोटो" },
  { code: "envelope", en: "Envelope", mr: "लिफाफा", hi: "लिफ़ाफ़ा" },
  { code: "other", en: "Other", mr: "इतर", hi: "अन्य" },
] as const;

/** Label of a reference item in the UI language (departments use `name` for English). */
export function refLabel(item: { en?: string; name?: string; mr: string; hi: string } | undefined, locale: "mr" | "en" | "hi"): string {
  if (!item) return "";
  if (locale === "en") return item.en ?? item.name ?? item.mr;
  return item[locale];
}

export const dept = (code: string | null | undefined) => DEPARTMENTS.find((d) => d.code === code);
export const category = (code: string | null | undefined) => CATEGORIES.find((c) => c.code === code);
export const venue = (code: string | null | undefined) => VENUES.find((v) => v.code === code);
