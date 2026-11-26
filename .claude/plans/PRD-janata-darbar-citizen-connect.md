# PRD — Citizen Connect (Janata Darbar Digital Platform)

| | |
|---|---|
| Technical delivery | Mr. Deepak Shettigar — Principal Consultant, AI and Software Delivery (architecture, build, AI set-up and tuning, deployment, test support) |
| Project co-ordination | Mr. Jeevan Jadhav — requirements and co-ordination with the Guardian Minister's office |
| Product Owner | Mr. Sonal Dattatraya Valavi (ACF) — priorities, sign-off, leads acceptance testing and the go/no-go recommendation |
| Client | Office of the Hon'ble Guardian Minister and Forest Minister, Government of Maharashtra. The Janata Darbar is the Guardian Minister's initiative. |
| Status | Aligned with the client proposal deck · pre-contract |
| Date | 2026-11-25 |
| Related | Proposal deck (Claude Slides artifact), intake prototype (claude.ai artifact) |

---

## 1. Problem

The Guardian Minister holds a monthly Janata Darbar in Palghar, plus regular sessions in Navi Mumbai. An average Darbar receives 350–450 applications (Guardian Minister's office); press reports cite peaks of 610 and 741.

How it works today:

1. **Submission.** Citizens bring written applications, in three copies.
2. **Registration.** From 7 a.m., each application gets a Janata Darbar stamp with a date-wise token number.
3. **Hearing.** The Minister hears each case. Many are resolved on the spot, with officials present or by a direct phone call.
4. **Routing.** If not resolved, the applicant gets a confirmed meeting slot with the official concerned.
5. **Follow-up.** Status is chased by calls, letters and return visits.

What breaks: once a copy leaves the hall, tracking depends on memory and phone calls; departments receive hand-carried copies that sometimes miss key details (mobile, address); staff stamp, copy and sort hundreds of letters by hand; the Minister's office has no aggregate view of volumes, pendency or aging.

## 2. Phasing

| Phase | What | Gate |
|---|---|---|
| **Phase 1 · Proof of concept (PoC), 8 weeks** | Prove AI intake is feasible and usable on 100 past applications | **Go/no-go:** acceptance test results decide the investment in Phases 2 and 3 |
| Phase 2 · Production build (after go) | AWS Mumbai with India-only AI, real sign-in, admin, live WhatsApp/SMS, department desks, live Darbars | Scoped below; planned and priced after go/no-go |
| Phase 3 · Scale | Other districts, ministries and agencies as tenants; citizen self-service; Marathi voice line; Aaple Sarkar and e-Office links | Indicative |

This PRD specifies Phase 1 in full. Phase 2 is scoped (section 13) only to make clear what Phase 1 leaves out.

## 3. Phase 1 goal and success criteria

**Goal:** build a PoC web app, for mobile and laptop, to complete a technical and usability feasibility study of AI-enabled application intake.

| Criterion | Target | How it is measured |
|---|---|---|
| AI extraction accuracy | **> 90%** | Share of intake-form fields the reviewer accepts without correction in the verification screen |
| Generative AI quality | **> 75%** | Share of reviewed case briefs (Minister's summary) marked acceptable, in each supported language |
| Recommendation accuracy | **> 75%** | Share of reviewed cases where the suggested department is marked correct |

See section 9 for the test data and method.

## 4. Users and personas (Phase 1)

| Persona | Where | Needs |
|---|---|---|
| Staff (single test account) | Darbar counter on an Android phone; office on a laptop | Photograph pages, confirm what the AI read, issue the token, work the queue, update applications, see the dashboard and briefing |
| Applicant | Anywhere | Check status by token number and phone number; no sign-in |

Department officers and the Minister's office get their own logins in Phase 2.

## 5. Phase 1 scope

### 5.1 In scope

1. Responsive web app for Android phones and laptops (installable PWA).
2. Camera capture of the application and supporting documents (usually 2–10 pages).
3. AI auto-fill of the intake form from all scanned pages.
4. Offline capture in low-network areas; sync when the network returns.
5. Marathi, Hindi and English for screens, AI reading and AI-written text.
6. Token numbers in date-wise serial order, as on today's Darbar stamp.
7. Token notification on WhatsApp, to **test numbers only**.
8. Applications linked by mobile number, so a repeat visitor's earlier cases show.
9. AI case summary for each application, shown to the Minister at the hearing; and a pre-Darbar briefing across all cases (open cases and trends), in Marathi and English.
10. AI recommendation of the department to assign the case to.
11. Data masking in the AI layer, for DPDP Act readiness.
12. Two personas: staff view and applicant view.
13. Design aligned with UX4G (ux4g.gov.in) and Google Material Design.

### 5.2 Out of scope (all scoped in Phase 2)

- Administration modules to onboard staff, departments and officers.
- Production sign-in by WhatsApp, SMS or email OTP; the PoC uses a single test staff account.
- Live WhatsApp, SMS or email notifications to applicants; any PoC messages go to test numbers only.
- Bulk page scanning with an automatic document feeder (ADF).
- Delivering the Minister's briefing by WhatsApp, SMS or email.
- Speech-to-text for recording outcomes (Phase 2).

### 5.3 Items held for negotiation

If the price is negotiated down (floor: ₹4,50,000), these can move to Phase 2, in this order: WhatsApp token notification; applicant view; Minister's briefing. Keep the AI department recommendation, which is one of the three acceptance targets.

## 6. Phase 1 modules

**Staff view**
- **Sign in** with a phone number, using one test account.
- **Home:** scan an application and issue its token.
- **Status check** by token number and phone number.
- **Queue:** verify the AI-filled application and its supporting documents.
- **Applications:** update details, name a follow-up owner, send to the next department, track and record closure.
- **Dashboard:** statistics and aging, by Darbar location, subject and department.
- **Minister's pre-Darbar briefing:** open cases and trends, AI-written in Marathi and English (distinct from the per-case summary).

**Applicant view**
- No sign-in or identity management.
- Check application status by token number and phone number.

## 7. The flow

```
Application scan → Token number generation → AI reading and verification → Hearing → Routing → Tracking and follow-up
```

1. **Application scan.** Staff photograph each page in the phone browser; edges are cropped automatically. Pages queue locally if offline.
2. **Token number generation.** Generated instantly, with a QR code the citizen can photograph. The counter never waits for the AI.
3. **AI reading and verification.** AI reads the letter; staff check and save it. A WhatsApp message with the token then goes to the applicant's mobile (PoC: test numbers only).
4. **Hearing.** The Minister sees the summary in English and Marathi; staff type in the outcome and notes. Phase 2 adds speech-to-text.
5. **Routing.** The case lands on the department's desk with a deadline.
6. **Tracking and follow-up.** Status, reminders, dashboard and the Minister's briefing.

Principles: AI suggests, people decide (every field and every routing is confirmed by staff before a message is sent); works when signal drops; one owner and one deadline per case.

## 8. AI requirements

### 8.1 Architecture — two interfaces

The code exposes two internal interfaces so engines can be swapped by configuration, not rewrite:

- **Reader:** page images → text + raw fields
- **Reasoner:** text + fields → summary, category, department, priority

### 8.2 Model choice

- **Phase 1 (PoC): Claude Opus 5 via the Anthropic API.** It is the model the PoC must prove, because it is also available on Amazon Bedrock's India geographic profile (`in.anthropic.claude-opus-5`, routing only between Mumbai and Hyderabad) for Phase 2. The Anthropic API itself is global by default, so page images are processed outside India during the PoC; this is covered by the client's written approval and the data processing terms in the SoW.
- **If accuracy falls short,** other models are tried. This may extend the timeline but not the cost. Candidates: Claude Sonnet 5 (also on the India profile, $2/$10 per million tokens vs Opus 5 at $5/$25); Sarvam document parsing only with zero retention written into the agreement (its default retention is 45 days).
- **Not chosen:** Claude Opus 5.5 is cheaper ($4/$20) and newer, but on Bedrock it is reachable from Mumbai only through the Global profile (no India-only profile at launch). Proving the PoC on 5.5 and running production on Opus 5 would weaken the go/no-go. Recheck at go/no-go.
- **No side-by-side model round** in acceptance testing: without an answer key there is nothing to machine-score a second model against, and a second human-reviewed round is not practical for the client's team.

**Background evidence (Hindi, not Marathi).** A 2026 Devanagari OCR benchmark on 300 real printed scans scored Gemini 2.5 Flash 86.3 and Claude Opus 4.7 82.2 (chrF++). No Marathi results were published. Typical failures are look-alike characters (ba↔va, gha↔dha, ma↔bha, da↔dha), which matter most for names, villages and Devanagari digits in mobile numbers.

### 8.3 Guardrails

- Never guess a name, number or address that cannot be read: return null and list it under `unclear`.
- Devanagari digits converted to ASCII in the mobile field only.
- Confidence per field (high/medium/low); low-confidence fields highlighted for staff.
- No application is saved on AI output alone; human confirmation is mandatory.
- Data masking in the AI layer for personal data in generated text (summary, briefing, recommendation).

### 8.4 AI usage and cost control

Opus 5 page images use the high-resolution tier (up to 4,784 tokens per image). Estimate: about 43k input and 6k output tokens per application per full run (about 6 pages plus summary, briefing and recommendation calls), roughly $0.37 or ₹33; about ₹3,300–4,100 per full run of 100 applications.

Controls: tune on a 20-application subset and run all 100 only for formal test runs; use the Batch API (50% cheaper) for test runs; downscale page photos where typed text stays readable. Expected PoC AI usage with these controls: ₹15,000–25,000. The fixed fee absorbs AI, hosting and database usage; keep full runs to about 10.

## 9. Acceptance testing

- **Test data:** 100 past applications — 80 Marathi typed, 15 English typed, 5 Marathi handwritten — with written approval to use them for testing. All test records are deleted when testing ends.
- **Method:** there is **no answer key prepared in advance**. The AI processes all 100. The Product Owner's team checks them in the verification screen during the two test weeks (weeks 7 and 8). Every correction is logged automatically.
- **Minimum sample:** at least **30 applications reviewed in full, including all 5 handwritten**, so the percentages are meaningful. More is better; any further review is spot-checks at the team's discretion.
- **Scoring:**
  - Extraction accuracy = fields accepted without correction ÷ fields reviewed, across the applications reviewed in full.
  - Generative AI quality = case briefs marked acceptable ÷ case briefs reviewed, reported per language.
  - Recommendation accuracy = departments marked correct ÷ recommendations reviewed.
  - Handwritten letters are reported separately so they don't mask the typed result.
- **Test owners:** Primary: Mr. Sonal Dattatraya Valavi. Secondary: Mr. Jeevan Jadhav and Mr. Deepak Shettigar.

Product requirement that follows: the verification screen must record, per field, whether the reviewer accepted or edited the AI value, and capture "acceptable / not acceptable" on the case brief and the recommendation. The test report is generated from these logs.

## 10. Reference data

**Department list:** taken from the departments on the state grievance portal (grievances.maharashtra.gov.in/en/dashboard) and confirmed by the Product Owner, with the local offices each maps to (for example municipal corporation, police, forest, MIDC, electricity, education). The portal lists Mantralaya-level departments, so the local-office mapping must come from the Product Owner.

**Draft categories:** Water supply · Roads & drainage · Housing / property · Land records · Pension & welfare · Ration card · Electricity · Police complaint · Wildlife damage compensation · Forest land / forest rights · Health · Education · Employment · Other

**Draft departments (code · name · SLA days)** — to be replaced by the confirmed list:

| Code | Department | SLA |
|---|---|---|
| NMMC | Navi Mumbai Municipal Corporation | 15 |
| TMC | Thane Municipal Corporation | 15 |
| CIDCO | CIDCO | 30 |
| REV | Revenue – Tahsildar / Collector | 21 |
| POL | Police | 7 |
| FOR | Forest Department | 30 |
| TRB | Tribal Development | 30 |
| ZP | Zilla Parishad, Palghar | 21 |
| MSEDCL | MSEDCL – Electricity | 15 |
| FCS | Food & Civil Supplies | 15 |
| PWD | Public Works Department | 30 |
| HLT | Public Health | 7 |
| OTH | Guardian Minister's office – other | 15 |

## 11. Architecture

### 11.1 Phase 1 (PoC) stack

| Layer | Choice | Why |
|---|---|---|
| Web app | Next.js installable web app (PWA) | Phone and laptop browsers, offline support |
| Database | PostgreSQL on Supabase, Mumbai region (ap-south-1), multi-tenant design | Data stored in India; other ministries can be added as tenants |
| Hosting | Vercel, functions in Mumbai (bom1) | Fast to set up and change during a PoC; processing in India. Functions default to iad1, so set the region in `vercel.json` or project settings |
| AI | Claude Opus 5, Anthropic API | Document reading, summary generation and case assignment recommendations |
| Messaging | WhatsApp Cloud API (Meta for Developers) | Token messages to test numbers only |
| Design | UX4G and Google Material Design | Government of India UX standard, with familiar Android patterns |
| Languages | Marathi, Hindi and English | Screen labels, AI reading and AI-generated text |

Plans: Vercel Pro ($20/month, one deploying seat) and Supabase Pro ($25/month including one Micro project) — about $90 (≈ ₹8,000) for two months.

### 11.2 Camera and capture decisions

- **Use the phone's own camera via a file input** (`<input type="file" accept="image/*" capture="environment">`), not a live `getUserMedia` preview: full-resolution photos, no browser camera permission prompt, and it avoids iOS standalone-PWA camera bugs.
- A live camera view with edge guides is optional, behind a flag.
- Target Android + Chrome. If an iPhone is used, use Safari directly, not an installed home-screen app.
- Open the app link in Chrome, not inside WhatsApp's or Gmail's in-app browser.
- Handle: permission denied (recovery screen), app backgrounded mid-capture, screen lock.

### 11.3 Phase 2 target — AWS Mumbai

| Layer | Service |
|---|---|
| Edge | CloudFront with web application firewall |
| Web app and API | Next.js on App Runner or ECS (same codebase as the PoC) |
| Login and roles | Amazon Cognito |
| Case database | Amazon RDS PostgreSQL |
| Page images | Amazon S3, encrypted with KMS |
| Reminders and jobs | EventBridge and SQS |
| Monitoring and audit | CloudWatch and CloudTrail |
| AI | Claude on Amazon Bedrock, India geographic inference |
| SMS and WhatsApp | AWS End User Messaging with TRAI DLT templates; WhatsApp Cloud API |
| Speech to text | Outcomes and notes, in supported languages |
| Phase 3 | Aaple Sarkar and e-Office links |

Everything stays portable (plain PostgreSQL, S3-compatible storage, AI behind one internal service), so the application can move to the State Data Centre or NIC without a rewrite if directed.

## 12. Non-functional requirements

- **Offline:** capture and queue without connectivity; sync automatically; no data loss on app close.
- **Performance:** token within 2 seconds of capture; AI read returned within 30 seconds for a 3-page letter.
- **Language:** citizen-facing text in Marathi and English; staff UI in Marathi with English labels.
- **Accessibility:** large touch targets, readable at arm's length in daylight.
- **Test devices:** an Android phone and laptops with a recent Chrome browser.

## 13. Phase 2 scope (after go)

**Platform and security**
- Hosting in AWS Mumbai, with India-only AI processing.
- Real sign-in by OTP over WhatsApp, SMS or email, with roles.
- Admin modules: staff users, departments, officers, Darbar locations.
- GIGW 3.0 security audit; DPDP notice, consent, retention and breach process.

**Applicant communication**
- Live WhatsApp and SMS: token, status updates and closure.
- WhatsApp Business and TRAI DLT accounts, registered by the owning entity.
- Satisfaction check at closure: resolved, yes or no.
- Applicant identity kept across visits and number changes.

**Case handling at scale**
- Department desks for nodal officers, with deadlines and reminders.
- Follow-up by the internal team and volunteers.
- Relevant laws, GRs and state policies surfaced for each case.
- Speech-to-text for recording outcomes and notes, in supported languages.
- ADF bulk scanning, live Darbar rollout and staff training.

## 14. Privacy, security and compliance

- **DPDP Act and Rules 2025** (notified November 2025; core obligations from 13 May 2027). Build to them now: purpose limitation, notice in Marathi and English, retention and erasure schedule, grievance contact, breach response.
- **Phase 1 data handling:** test data stored in India (Supabase Mumbai, Vercel bom1); page images sent to the Anthropic API for reading (outside India); masking in the AI layer; test-only access; written approval; all records deleted after testing.
- **Phase 2 data residency:** all citizen data in ap-south-1/ap-south-2; no AI call on real data uses a global inference profile.
- **Roles:** the Guardian Minister's office, or the government body it designates, is the Data Fiduciary; the technical delivery acts as its Data Processor under the SoW's data processing terms.
- **Access and audit:** least privilege per department (Phase 2); every status change and every edit to an AI-extracted field is logged with user and timestamp.
- **GIGW 3.0** security audit before production use.

## 15. Phase 1 milestones (8 weeks)

| Week | Milestone | Payment |
|---|---|---|
| On SoW signing | — | Advance |
| 1 | Kick-off and design: UX4G screens and test data | |
| 2–3 | PoC set-up and AI intake: camera, offline sync, extraction | End of week 3: AI intake demonstrated |
| 4–5 | Staff and applicant views: queue, applications, dashboard, briefing, WhatsApp | |
| 6 | AI tuning and internal testing: 100 applications loaded and dry-run | End of week 6: build ready for testing |
| 7–8 | User acceptance testing, led by the Product Owner's team | |
| End of week 8 | Report and go/no-go: results against targets; test data deleted | Final payment |

Commercial terms (fee, amounts, inclusions) are in the proposal deck and the SoW, not this PRD.

## 16. Assumptions and dependencies

**Assumptions**
- Phase 1 is a feasibility study: one test staff account, and no real applicant is contacted.
- WhatsApp messages go only to registered test numbers.
- Testing uses an Android phone and laptops with a recent Chrome browser.
- Claude Opus 5 is the starting model; if accuracy falls short, other models are tried, which may extend the timeline but not the cost.

**Dependencies (client)**
- Acceptance-test support from the Product Owner's team.
- 100 past applications, with written approval to use them for testing.
- Review of AI-filled applications in the verification screen during the two test weeks: at least 30 in full, including all 5 handwritten.
- The PoC's department list, taken from the state grievance portal and confirmed by the Product Owner, with local offices mapped.
- WhatsApp test numbers and an Android test phone.
- A signed Statement of Work, including confidentiality and data processing terms for the test data.

## 17. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| AI accuracy below target | High | Staff verify every field; other models tried if needed, extending time, not cost |
| Personal data in real test applications | High | Data stored in India (Mumbai region); masking in the AI layer, test-only access, written approval, all records deleted after testing |
| Handwritten Marathi reads poorly | Medium | 5% of the test set; scored separately; staff correct in the queue |
| Test time not available | Medium | Test weeks fixed at kick-off; secondary owners prepare each run |
| Too few applications reviewed for meaningful scores | Medium | Minimum of 30 reviewed in full agreed at kick-off |
| AI usage exceeds what the fixed fee absorbs | Medium | Tune on a subset; Batch API for test runs; cap of about 10 full runs |
| Weak network at test locations | Medium | Offline capture on the phone; sync when the network returns |
| Scope creep | Medium | Fixed Phase 1 scope; new requests logged for Phase 2 |

## 18. Open questions

1. Which government body is the legal owner of the platform — the Guardian Minister's office, or a body it designates such as the District Collectorate? That body signs the SoW's data processing terms as Data Fiduciary and, in Phase 2, holds the TRAI DLT entity, the WhatsApp Business account and the AWS account.
2. Who confirms the department list and the local-office mapping, and the SLA days per department?
3. Is there an existing grievance system whose token format must be matched?
4. Which AWS account for Phase 2 — new, or an existing government account? Who holds root?
5. Who are the named desk officers per department for Phase 2 UAT?
6. Does the owning office have Bhashini access, and is there a production document OCR API behind it?
