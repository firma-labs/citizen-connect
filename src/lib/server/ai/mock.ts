import type { ReaderOutput, ReasonerOutput } from "@/lib/types";
import type { DashboardStats } from "@/lib/dashboard";
import type { Briefer, Briefing, BriefingInput, PageImage, Reader, Reasoner } from "./types";

// Deterministic stand-in so the whole flow (capture → token → verify → SMS)
// can be exercised on a phone without AI credentials. Returns a plausible
// Marathi wildlife-damage letter with one deliberately low-confidence field.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class MockReader implements Reader {
  readonly id = "mock";
  async read(pages: PageImage[]): Promise<ReaderOutput> {
    await sleep(2500);
    return {
      language: "mr",
      pages: pages.map((p, i) => ({
        page_number: i + 1,
        page_type: i === 0 ? "letter" : "enclosure",
        transcription:
          i === 0
            ? "प्रति,\nमा. वनमंत्री महोदय,\nमहाराष्ट्र राज्य.\n\nविषय : बिबट्याच्या हल्ल्यात मृत झालेल्या गाईची नुकसान भरपाई मिळणेबाबत.\n\nमहोदय,\nमी सुरेश बाबुराव पाटील, रा. मनोर, ता. पालघर, जि. पालघर येथील रहिवासी आहे. दिनांक १२/१०/२०२६ रोजी रात्री बिबट्याने माझ्या गोठ्यातील गाईवर हल्ला करून तिला ठार केले. वन विभागाकडे दि. १५/१०/२०२६ रोजी अर्ज केला, परंतु अद्याप पंचनामा झालेला नाही.\nतरी कृपया नुकसान भरपाई मिळावी ही विनंती.\n\nआपला विश्वासू,\nसुरेश बा. पाटील\nमो. ९८२२०?४५६७"
            : "(सोबत: वन विभागाकडे केलेल्या अर्जाची प्रत, दि. १५/१०/२०२६)",
      })),
      fields: {
        applicant_name_original: "सुरेश बाबुराव पाटील",
        applicant_name_roman: "Suresh Baburao Patil",
        mobile: "९८२२०?४५६७",
        address: "मु. पो. मनोर, ता. पालघर, जि. पालघर",
        locality: "मनोर",
        taluka: "पालघर",
        district: "पालघर",
        letter_date: "2026-11-18",
        subject: "बिबट्याच्या हल्ल्यात मृत झालेल्या गाईची नुकसान भरपाई मिळणेबाबत",
        prior_follow_ups: ["वन विभागाकडे अर्ज, दि. १५/१०/२०२६"],
        attachments: pages.length > 1 ? ["वन विभागाकडे केलेल्या अर्जाची प्रत"] : [],
        signatories: ["सुरेश बा. पाटील"],
      },
      confidence: {
        applicant_name: "high",
        mobile: "low",
        address: "high",
        locality: "medium",
        taluka: "high",
        district: "high",
        letter_date: "medium",
        subject: "high",
      },
      unclear: [{ page_number: 1, field: "mobile", text: "९८२२०?४५६७" }],
    };
  }
}

export class MockReasoner implements Reasoner {
  readonly id = "mock";
  async reason(): Promise<ReasonerOutput> {
    await sleep(800);
    return {
      summary_en:
        "Suresh Baburao Patil of Manor, Palghar taluka, reports that a leopard killed his cow on 12 Oct 2026. He applied to the Forest Department on 15 Oct but no panchnama has been done yet. He requests wildlife-damage compensation.",
      summary_local:
        "मनोर, ता. पालघर येथील सुरेश बाबुराव पाटील यांच्या गाईचा दि. १२/१०/२०२६ रोजी बिबट्याच्या हल्ल्यात मृत्यू झाला. १५/१०/२०२६ रोजी वन विभागाकडे अर्ज करूनही पंचनामा झालेला नाही. नुकसान भरपाईची मागणी.",
      category: "wildlife_damage",
      department: "FOR",
      secondary_departments: [],
      priority: "high",
      priority_reason: "Loss of livelihood (cattle) and an earlier application with no response.",
      confidence: { category: "high", department: "high" },
    };
  }
}

/** Template briefing from the figures, for running without an AI key. */
export class MockBriefer implements Briefer {
  readonly id = "mock";
  async brief({ stats, attention }: BriefingInput): Promise<Briefing> {
    await sleep(600);
    const s = stats as DashboardStats;
    const lag = s.departments.filter((d) => d.overdue > 0).slice(0, 3).map((d) => `${d.code} (${d.overdue})`).join(", ") || "none";
    const items = attention.slice(0, 3).map((a) => `${a.token} · ${a.department}`).join("; ") || "none";
    return {
      en: [
        `• ${s.received} applications received; ${s.resolved} resolved (${s.resolved_pct}% of those routed).`,
        `• ${s.open} open, of which ${s.overdue} are past the department's response time.`,
        `• Departments with overdue applications: ${lag}.`,
        `• Needs attention: ${items}.`,
        `• Suggestion: ask lagging departments for a status note before the next Darbar.`,
      ].join("\n"),
      mr: [
        `• एकूण ${s.received} अर्ज आले; त्यांपैकी ${s.resolved} निकाली (पाठवलेल्यांपैकी ${s.resolved_pct}%).`,
        `• ${s.open} अर्ज प्रलंबित, त्यांपैकी ${s.overdue} मुदत उलटून गेलेले.`,
        `• मुदत उलटलेले अर्ज असलेले विभाग: ${lag}.`,
        `• लक्ष देण्याजोगे: ${items}.`,
        `• सूचना: पुढील दरबारापूर्वी मागे असलेल्या विभागांकडून स्थिती अहवाल मागवावा.`,
      ].join("\n"),
    };
  }
}

