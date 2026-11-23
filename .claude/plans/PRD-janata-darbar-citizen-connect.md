# PRD — Citizen Connect (Janata Darbar Digital Platform)

| | |
|---|---|
| Owner | Deepak (Firma Labs) — architecture and ~90% of build |
| Requirements liaison | Jeevan — fortnightly sessions with the ACF (Grade I) officer |
| Client | Office of the Hon’ble Guardian Minister and Forest Minister, Government of Maharashtra. The Janata Darbar is the Guardian Minister’s initiative. |
| Status | Draft for internal use · pre-contract |
| Date | 2026-11-22 |
| Related | Proposal deck (Claude Slides artifact), intake prototype (claude.ai artifact) |

---

## 1. Problem

The Guardian Minister, who is also Maharashtra’s Forest Minister, holds Janata Darbar sessions in Navi Mumbai, Thane and Palghar. Citizens arrive with paper applications, mostly handwritten or typed in Marathi, some in Hindi, a few in English. Today:

- Applications are collected as paper. There is no token, so the citizen leaves with nothing to quote later.
- Sorting and routing to departments happens manually, after the event.
- Nobody can answer "what happened to my application?" without finding the physical file.
- The Guardian Minister's office has no aggregate view: how many applications, on what subjects, from which talukas, how many still open.

## 2. Goal

Every citizen leaves the Darbar with a token number and an SMS. Every application is readable, routed and trackable within minutes of being handed over. The Guardian Minister's office can see the whole picture before the next Darbar.

### Success measures (Phase 1)

| Measure | Target |
|---|---|
| Time from counter to token issued | Under 90 seconds |
| Applications captured digitally at a live Darbar | 100% of those handed in |
| AI field accuracy (name, mobile) on real letters | ≥ 95% after staff verification step |
| Applications routed to a department same day | 100% |
| Citizen can check status by token | Yes, from day one |

## 3. Users

| User | Where | Needs |
|---|---|---|
| Citizen | Darbar venue, then anywhere | Hand over the letter, get a token, be able to check status later |
| Intake staff | Darbar counter, phone in hand | Photograph pages, confirm what the AI read, issue token fast |
| Department desk officer | Office, desktop | See applications routed to them, update status, close with a remark |
| Guardian Minister's office / ACF | Office, desktop or tablet | Dashboard: volumes, categories, ageing, departments lagging; briefing before each Darbar |

## 4. Scope — Phase 1

### 4.1 In scope

1. **Intake in the phone browser.** Installable web app, no app store. Multi-page capture, any paper size, works offline and syncs when the signal returns.
2. **AI reading.** Extract applicant name (original script + romanised), mobile, address, locality/taluka/district, date on letter, subject, English summary, summary in the letter's own language, category, suggested department, priority, prior follow-ups, attachments, signatories, per-page classification, full transcription, per-field confidence, and a list of words it could not read.
3. **Token.** Generated instantly on capture, with a QR code the citizen can photograph.
4. **Staff verification.** Every AI field is editable. Nothing is saved until a human confirms.
5. **SMS.** On save, an SMS with the token number goes to the applicant's mobile, in the letter's language.
6. **Routing.** To one primary department, with secondary departments flagged as "also concerns".
7. **Department desks.** Login, worklist, status updates, closing remarks, SLA clock.
8. **Citizen tracking.** Public page: enter token + mobile, see status.
9. **Minister's dashboard.** Volumes by category, department, taluka; ageing; AI briefing in English and Marathi before each Darbar.

### 4.2 Out of scope (Phase 2 candidates)

- WhatsApp status updates (foundation is built, channel not switched on)
- Marathi voice line / IVR; speech-to-text and text-to-speech
- Citizen self-service submission from home
- Integration with existing department systems (Aaple Sarkar, e-Office)
- Payment or benefit disbursement of any kind

## 5. The flow

```
Scan  →  Token  →  Read & verify  →  Hear  →  Route  →  Track
```

1. **Scan.** Staff photograph each page in the phone browser. Edges cropped automatically. Pages queue locally if offline.
2. **Token.** Generated instantly with a QR code the citizen can photograph. No waiting for the AI.
3. **Read & verify.** AI reads the pages; staff check and save. SMS with the token then goes to the applicant's mobile.
4. **Hear.** The Minister sees the summary in English and Marathi; on-the-spot outcomes are recorded.
5. **Route.** To the department, with the SLA clock started.
6. **Track.** Citizen checks by token; department updates status; dashboard aggregates.

Note the ordering: the token is issued **before** AI reading completes, so the counter never blocks on the model.

## 6. Camera and capture — decisions

- **Use the phone's own camera app via a file input** (`<input type="file" accept="image/*" capture="environment">`), not a live `getUserMedia` preview. Reasons: full-resolution photos, no browser camera permission prompt, and it avoids the known iOS standalone-PWA bugs where camera permission is re-prompted on every route change and the stream stops on navigation.
- **A live camera view with edge guides is optional**, behind a flag, for framing help only.
- **Target Android + Chrome.** If an iPhone is used, use Safari directly, not an installed home-screen app.
- **Open the app link in Chrome**, not inside WhatsApp's or Gmail's in-app browser.
- The app must handle: permission denied (recovery screen with instructions), app backgrounded mid-capture, and screen lock.

## 7. AI requirements

### 7.1 Architecture decision — two interfaces

The code exposes two internal interfaces so engines can be swapped by configuration, not rewrite:

- **Reader**: page images → text + raw fields
- **Reasoner**: text + fields → summary, category, department, priority

### 7.2 Engine choice

**Production default: Claude Opus 5 (or Sonnet 5) on Amazon Bedrock with India geographic cross-Region inference** (`in.anthropic.claude-opus-5`). Requests route only between ap-south-1 (Mumbai) and ap-south-2 (Hyderabad), so data stays in India.

**Claude Opus 5.5 is NOT a production option today.** On Bedrock it is reachable from Mumbai/Hyderabad only through the *global* inference profile, which routes worldwide with no residency constraint. Re-evaluate when AWS publishes an India geo profile for it.

### 7.3 Pilot comparison (weeks 1–3)

Run the same letter set through each and score:

| # | Setup | Routing | Purpose |
|---|---|---|---|
| 1 | Claude Opus 5 | India | Production candidate |
| 2 | Claude Sonnet 5 | India | Cheaper production candidate |
| 3 | Claude Opus 5.5 | Global | Upper bound (mock letters only) |
| 4 | Sarvam Vision (parse) → Claude | Sarvam API (India) | Indian reading engine |
| 5 | Sarvam Vision → Sarvam-105B | Sarvam API (India) | Fully Indian stack |
| 6 | Gemma 3 27B on Bedrock | In-AWS | Reference only; likely retiring Mar 2027 |

**Known evidence (Hindi, not Marathi).** A 2026 Devanagari OCR benchmark on 300 real printed scans scored Gemini 2.5 Flash 86.3 and Claude Opus 4.7 82.2 (chrF++), with most other systems collapsing (GPT-5.5 58.5, EasyOCR 58.3, DeepSeek-OCR 10.4). No Marathi results were published. Typical failures are look-alike characters (ba↔va, gha↔dha, ma↔bha, da↔dha) — which matters most for names, villages and Devanagari digits in mobile numbers.

**Decision rule.** If Claude's Marathi field accuracy is within a few points of Sarvam's, stay single-vendor on Bedrock. Only move to Sarvam if clearly better, and only with zero-retention written into the DPA — Sarvam's Document AI default retains uploads and results for 45 days.

### 7.4 Scoring method

- 40–50 letters: a mix of handwritten and typed, Marathi/Hindi/English, single and multi-page, with enclosures.
- Each letter tested twice: clean scan, and printed → photocopied → phone photo at an angle.
- A Marathi reader writes the answer key before any model runs.
- Score per field (1/0): language, applicant name (including matras), mobile, locality, taluka, district, category, department. Rate summaries 1–3. Record time per letter and cost per letter.
- **Gate to pass:** name and mobile correct on every clean letter, and on at least 3 of 4 degraded letters.

### 7.5 Guardrails

- Never guess a name, number or address that cannot be read — return null and list it under `unclear`.
- Devanagari digits converted to ASCII in the mobile field only.
- Confidence per field (high/medium/low); low-confidence fields highlighted for staff.
- No application is saved on AI output alone — human confirmation is mandatory.

## 8. Reference data

**Categories:** Water supply · Roads & drainage · Housing / property · Land records · Pension & welfare · Ration card · Electricity · Police complaint · Wildlife damage compensation · Forest land / forest rights · Health · Education · Employment · Other

**Departments (code · name · SLA days):**

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

## 9. Architecture

### 9.1 Pilot (weeks 1–3)

Next.js on Vercel + Supabase. **Mock or redacted letters only** — this stack is outside India and must never hold real citizen data.

### 9.2 Production (from week 4) — AWS Mumbai

| Layer | Service |
|---|---|
| App | Next.js PWA, one codebase for phones, desks and dashboard |
| Auth | Amazon Cognito — mobile OTP for staff, roles for departments |
| Data | RDS PostgreSQL (encrypted), S3 with KMS for page images |
| AI | Claude on Bedrock, India cross-Region inference |
| SMS | AWS End User Messaging, TRAI DLT-registered templates |
| Async | EventBridge + SQS for AI reading, SMS dispatch, SLA timers |
| Edge | CloudFront + WAF |
| Audit | CloudWatch + CloudTrail |

**Week 1 action:** file the TRAI DLT template registration immediately — approval has the longest lead time of anything in the plan.

## 10. Non-functional requirements

- **Offline:** capture and queue without connectivity; sync automatically; no data loss on app close.
- **Performance:** token within 2 seconds of capture; AI read returned within 30 seconds for a 3-page letter.
- **Language:** all citizen-facing text in Marathi and English; staff UI in Marathi with English labels.
- **Accessibility:** large touch targets, readable at arm's length in bright daylight (outdoor venues).
- **Availability:** the Darbar is a fixed-date event — the system must be verified working the day before each session.

## 11. Privacy, security, compliance

- **DPDP Act and Rules 2025** (notified 13 Nov 2025; core obligations from 13 May 2027). Build to them now: purpose limitation, notice at the counter in Marathi, retention schedule, breach process, consent record.
- **Data residency:** all citizen data in ap-south-1/ap-south-2. No AI call on real data may use a global inference profile.
- **GIGW 3.0** security audit required before production use.
- **Access:** least privilege per department; a desk sees only its own applications.
- **Audit:** every status change and every edit to an AI-extracted field is logged with user and timestamp.
- **Printed notice** at the intake counter explaining what is collected and why.
- **Procurement:** Maharashtra requires e-tendering above ₹3 lakh. One contract for this plan must go through e-tender or GeM before any payment, including the pilot milestone. Never split the plan to avoid tendering.

## 12. Milestones (12 weeks)

| Weeks | Milestone | Gate |
|---|---|---|
| 1–3 | Pilot: scan, AI reading, token on Vercel + Supabase, using sample letters | **Go/no-go on AI accuracy** |
| 4–5 | AWS Mumbai foundation: environments, Cognito, messaging layer, design sign-off | Dev environment ready |
| 6–9 | Build: routing, department desks, tracker, dashboard. Weekly demos | Feature complete |
| 10–11 | Hardening: security review, DPDP notice, UAT with two departments | UAT signed off |
| 12 | Live Darbar alongside paper, then go-live + 30-day support | In production |

TRAI DLT registration filed week 1. The live Darbar week depends on the Darbar calendar.

## 13. Open questions

1. Can the Guardian Minister's office provide 40–50 real (anonymised) past applications for the pilot answer key?
2. Who signs off the department list and SLA days?
3. Does the owning office have Bhashini access, and is there a production document OCR API behind it?
4. Which government body is the legal owner of the platform — the Guardian Minister's office, or a body it designates such as the District Collectorate? That body signs the DPA as Data Fiduciary and holds the TRAI DLT entity and the AWS account.
5. Which AWS account — new, or an existing government account? Who holds root?
6. Is there an existing grievance system whose token format must be matched?
7. Who are the named desk officers per department for UAT?
8. Confirm in the owning office's AWS account: is Gemma 3 27B marked Active or Legacy in ap-south-1?

## 14. Assumptions

- Staff use their own smartphones or a few department phones, recent Chrome, mobile data.
- Venue has usable mobile signal; offline capture covers drop-outs.
- Two departments will participate in UAT.
- Deepak is available for ~90% of the technical work; at lower availability the plan stretches to ~16 weeks.
- Cloud, AI and SMS billed at actuals, estimated ₹10,000–20,000/month from go-live.
