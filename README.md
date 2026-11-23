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
./scripts/start-dev.sh --supabase      # also start local Supabase in Docker (ports 553xx) as the store
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
PRD §7.3 comparison runs. Store: local files in `.data/` unless Supabase env vars are set. SMS is logged only
(`SMS_PROVIDER=console`) until the TRAI DLT templates are approved.

## Layout

- `src/app/capture` — camera capture (phone camera app via file input; optional live view), auto-crop, token + QR
- `src/app/queue`, `src/app/verify` — sync status, AI result review with low-confidence highlights, save & route
- `src/app/track` — public status page (token + mobile)
- `src/lib/client` — IndexedDB offline queue, sync engine, image processing
- `src/lib/server/ai` — `Reader` / `Reasoner` interfaces + Claude (API/Bedrock) and mock engines
- `src/lib/server/store` — local-file and Supabase stores; `supabase/migrations` — schema
- `public/sw.js` — service worker (app shell offline)
