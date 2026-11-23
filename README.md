# Citizen Connect — Janata Darbar intake (pilot)

Next.js PWA for the pilot scope in `.claude/plans/PRD-janata-darbar-citizen-connect.md`:
scan pages in the phone browser → token + QR instantly → AI reads → staff verify → route + SMS → citizen tracks.

**Pilot rule:** mock or redacted letters only (PRD §9.1).

## Run

```bash
./scripts/start-dev.sh                 # dev server (hot reload) on :4000 + tailscale serve (tailnet only)
./scripts/start-dev.sh --prod          # production build + next start: fast, no on-demand compiling
                                       # or reloads — best for phone testing; restart after code changes
./scripts/start-dev.sh --funnel        # public URL via tailscale funnel (no login in this build)
./scripts/start-dev.sh --prod --funnel # flags combine
```

Phone URL: `https://<machine>.<tailnet>.ts.net:8443`. Port 8443 keeps it separate from any other
project exposed on 443. Use Chrome on Android; on iPhone use Safari (not the home-screen app).

## Configuration (`.env`, see `.env.example`)

The pilot calls the **Claude API directly** with `ANTHROPIC_API_KEY`, using Claude Opus 5
(`ANTHROPIC_MODEL` to change it). Without a key it uses the mock engine. Bedrock in Mumbai
(`bedrock:in.anthropic.claude-opus-5`, PRD §7.2) is the production path and is only used when set
explicitly via `AI_READER` / `AI_REASONER`.

Override per step with `AI_READER` / `AI_REASONER` (`mock`, `anthropic:<model>`, `bedrock:<model>`) for the
PRD §7.3 comparison runs. Data: JSON files in `.data/` on your machine; Vercel Blob when deployed on Vercel. SMS is logged only
(`SMS_PROVIDER=console`) until the TRAI DLT templates are approved.

## Deploy to Vercel (pilot demo, Preview)

Data on Vercel lives in a **Vercel Blob** store — the same JSON-per-application layout as `.data/` locally.
Your machine always keeps using `.data/`.

1. Import `firma-labs/citizen-connect` in Vercel (framework: Next.js).
2. **Storage → Create → Blob**: name `citizen-connect`, access **Private**, region **Mumbai (bom1)**;
   connect it to the **Preview** environment (Vercel adds the credentials itself). CLI equivalent:
   `vercel blob create-store citizen-connect --access private --region bom1 --environment preview`.
3. **Settings → Environment Variables (Preview)**: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL=claude-opus-5`,
   `DEMO_USERS`, `DEMO_PASSWORD`, `AUTH_SECRET` (e.g. `openssl rand -hex 32`); optionally
   `AI_DAILY_LIMIT_PER_USER` (20) and `AI_DAILY_LIMIT_TOTAL` (200).
4. **Settings → Functions → Region**: Mumbai (`bom1`), next to the Blob store.
5. Deploy a preview (push a branch, or `vercel deploy`), sign in, then scan → read → verify → track once.

Without sign-in settings the app stays locked on Vercel; without a connected Blob store, API calls return
an error saying so. Mock or redacted letters only (PRD §9.1).

## Layout

- `src/app/capture` — camera capture (phone camera app via file input; optional live view), auto-crop, token + QR
- `src/app/queue`, `src/app/verify` — sync status, AI result review with low-confidence highlights, save & route
- `src/app/track` — public status page (token + mobile)
- `src/lib/client` — IndexedDB offline queue, sync engine, image processing
- `src/lib/server/ai` — `Reader` / `Reasoner` interfaces + Claude (API/Bedrock) and mock engines
- `src/lib/server/store` — JSON store: local files (`.data/`) or Vercel Blob (on Vercel)
- `public/sw.js` — service worker (app shell offline)
