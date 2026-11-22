# Citizen Connect — Janata Darbar intake (pilot)

Next.js PWA for the pilot scope in `.claude/plans/PRD-janata-darbar-citizen-connect.md`:
scan pages in the phone browser → token + QR instantly → AI reads → staff verify → route + SMS → citizen tracks.

**Pilot rule:** mock or redacted letters only (PRD §9.1).

## Run

```bash
./scripts/start-dev.sh                 # next dev on :4000 + tailscale serve (tailnet only)
./scripts/start-dev.sh --funnel        # public URL via tailscale funnel (no login in this build)
./scripts/start-dev.sh --supabase      # also start local Supabase in Docker (ports 553xx) as the store
./scripts/start-dev.sh --prod          # production build + next start (full offline caching)
```

Phone URL: `https://<machine>.<tailnet>.ts.net:8443`. Port 8443 keeps it separate from any other
project exposed on 443. Use Chrome on Android; on iPhone use Safari (not the home-screen app).

## Configuration (`.env`, see `.env.example`)

| Engine (auto-selected) | When |
|---|---|
| `bedrock:in.anthropic.claude-opus-5`, `AWS_REGION=ap-south-1` | AWS credentials set (`AWS_BEARER_TOKEN_BEDROCK`, IAM keys or `AWS_PROFILE`) |
| `anthropic:claude-opus-5` | only `ANTHROPIC_API_KEY` set |
| `mock` | neither |

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
