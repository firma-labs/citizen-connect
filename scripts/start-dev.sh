#!/usr/bin/env bash
#
# Citizen Connect — local dev startup.
# Runs each stage in order and stops at the first one that fails.
#
#   ./scripts/start-dev.sh              Next.js dev on :4000 + tailscale serve (tailnet only)
#   ./scripts/start-dev.sh --supabase   also start local Supabase (Docker) and use it as the store
#   ./scripts/start-dev.sh --funnel     expose on the public internet via tailscale funnel
#   ./scripts/start-dev.sh --prod       production build + `next start` (service worker caches fully)
#   ./scripts/start-dev.sh --no-tailscale
#
# Phone URL: https://<this-machine>.<tailnet>.ts.net:8443
#   - `serve` (default): the phone must be signed in to the same tailnet (Tailscale app).
#   - `--funnel`: reachable from any phone. This pilot has no login — mock letters only.
# HTTPS port 8443 is used so this never clobbers another project's serve/funnel on 443.
#
# The Next.js server runs in the foreground; Ctrl+C stops it and removes the
# tailscale config this script added. Local Supabase keeps running (stop it with
# `npx supabase stop`).

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_PORT="${APP_PORT:-4000}"
TS_HTTPS_PORT="${TS_HTTPS_PORT:-8443}"

USE_SUPABASE=0
USE_FUNNEL=0
USE_TAILSCALE=1
PROD=0
for arg in "$@"; do
  case "$arg" in
    --supabase) USE_SUPABASE=1 ;;
    --funnel) USE_FUNNEL=1 ;;
    --no-tailscale) USE_TAILSCALE=0 ;;
    --prod) PROD=1 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg (see --help)"; exit 2 ;;
  esac
done

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

step_num=0
log_stage() { step_num=$((step_num + 1)); echo -e "\n${YELLOW}==> [Stage ${step_num}] $1${NC}"; }
log_ok() { echo -e "${GREEN}✔ $1${NC}"; }
log_info() { echo "  $1"; }
fail_and_stop() {
  echo -e "${RED}✘ Stage ${step_num} failed: $1${NC}"
  echo -e "${RED}Stopping startup sequence. Fix the issue above before re-running.${NC}"
  exit 1
}

# tailscale CLI prints a client/daemon version-mismatch warning on every call; hide it.
ts() { tailscale "$@" 2> >(grep -v 'client version' >&2); }

# --- Stage: repo + dependencies ----------------------------------------------
log_stage "Entering repo and checking dependencies"
cd "$REPO_ROOT" || fail_and_stop "could not cd into $REPO_ROOT"
command -v node >/dev/null || fail_and_stop "node not found"
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm install || fail_and_stop "npm install failed"
fi
log_ok "in $(pwd), node $(node -v)"

if [ ! -f .env.local ] && ! grep -qE "^ANTHROPIC_API_KEY=.+" .env 2>/dev/null; then
  log_info "no ANTHROPIC_API_KEY in .env / .env.local — AI runs in mock mode, store is local files (.data/). See .env.example."
fi

# --- Stage: Supabase (optional) ------------------------------------------------
if [ "$USE_SUPABASE" = 1 ]; then
  log_stage "Starting local Supabase (Docker)"
  command -v docker >/dev/null || fail_and_stop "docker not found — install Docker Desktop"
  if ! docker info >/dev/null 2>&1; then
    log_info "Docker daemon not running — launching Docker Desktop"
    open -a Docker 2>/dev/null || true
    for _ in $(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 2; done
    docker info >/dev/null 2>&1 || fail_and_stop "Docker daemon did not start within 120s"
  fi
  log_ok "docker running"

  # `start` is a no-op when already running and applies supabase/migrations on first start.
  npx supabase start || fail_and_stop "npx supabase start failed"
  SB_ENV="$(npx supabase status -o env 2>/dev/null)" || fail_and_stop "npx supabase status failed"
  SB_URL="$(printf '%s\n' "$SB_ENV" | sed -n 's/^API_URL="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')"
  SB_KEY="$(printf '%s\n' "$SB_ENV" | sed -n 's/^SERVICE_ROLE_KEY="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')"
  [ -n "$SB_URL" ] && [ -n "$SB_KEY" ] || fail_and_stop "could not read API_URL / SERVICE_ROLE_KEY from supabase status"
  export STORE=supabase SUPABASE_URL="$SB_URL" SUPABASE_SERVICE_ROLE_KEY="$SB_KEY"
  STUDIO_URL="$(printf '%s\n' "$SB_ENV" | sed -n 's/^STUDIO_URL="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')"
  log_ok "supabase at $SB_URL (studio: ${STUDIO_URL:-n/a}) — store=supabase"
fi

# --- Stage: free the app port --------------------------------------------------
# Only processes listening on APP_PORT are stopped — other projects' dev servers are left alone.
log_stage "Freeing port $APP_PORT"
PORT_PIDS="$(lsof -ti "tcp:$APP_PORT" -sTCP:LISTEN || true)"
if [ -n "$PORT_PIDS" ]; then
  echo "$PORT_PIDS" | xargs kill 2>/dev/null || true
  sleep 1
  STILL="$(lsof -ti "tcp:$APP_PORT" -sTCP:LISTEN || true)"
  [ -n "$STILL" ] && { echo "$STILL" | xargs kill -9 2>/dev/null || true; sleep 1; }
  [ -n "$(lsof -ti "tcp:$APP_PORT" -sTCP:LISTEN || true)" ] && fail_and_stop "port $APP_PORT still in use"
  log_ok "stopped pid(s) $(echo "$PORT_PIDS" | xargs) on port $APP_PORT"
else
  log_ok "port $APP_PORT is free"
fi

# --- Stage: tailscale ------------------------------------------------------------
TS_URL=""
cleanup() {
  if [ "$USE_TAILSCALE" = 1 ] && [ -n "$TS_URL" ]; then
    echo -e "\n${YELLOW}Removing tailscale config for :$TS_HTTPS_PORT${NC}"
    if [ "$USE_FUNNEL" = 1 ]; then ts funnel --https="$TS_HTTPS_PORT" off >/dev/null 2>&1 || true; fi
    ts serve --https="$TS_HTTPS_PORT" off >/dev/null 2>&1 || true
  fi
}

ts_is_serving() {
  ts serve status --json 2>/dev/null | tr -d ' \n' \
    | grep -Eq "\"Proxy\":\"http://(localhost|127\.0\.0\.1):$APP_PORT\"" || return 1
  if [ "$USE_FUNNEL" = 1 ]; then ts serve status --json 2>/dev/null | grep -q '"AllowFunnel"' || return 1; fi
}

if [ "$USE_TAILSCALE" = 1 ]; then
  MODE=$([ "$USE_FUNNEL" = 1 ] && echo funnel || echo serve)
  log_stage "Exposing localhost:$APP_PORT with tailscale $MODE on https port $TS_HTTPS_PORT"
  command -v tailscale >/dev/null || fail_and_stop "tailscale CLI not found (brew install tailscale, or the Tailscale app)"
  ts status >/dev/null 2>&1 || fail_and_stop "tailscale is not connected — open the Tailscale app and sign in"
  TS_HOST="$(ts status --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).Self.DNSName.replace(/\.$/,""))}catch{}})')"
  [ -n "$TS_HOST" ] || fail_and_stop "could not determine this machine's tailnet DNS name (is MagicDNS on?)"

  # Always replace this port's config instead of trusting an old one.
  ts serve --https="$TS_HTTPS_PORT" off >/dev/null 2>&1 || true
  ts funnel --https="$TS_HTTPS_PORT" off >/dev/null 2>&1 || true
  if ! ts "$MODE" --bg --https="$TS_HTTPS_PORT" "http://localhost:$APP_PORT" >/tmp/citizen-connect-tailscale.log 2>&1; then
    cat /tmp/citizen-connect-tailscale.log
    fail_and_stop "tailscale $MODE failed (HTTPS certificates must be enabled for the tailnet)"
  fi
  for _ in $(seq 1 20); do ts_is_serving && break; sleep 0.5; done
  ts_is_serving || { cat /tmp/citizen-connect-tailscale.log; fail_and_stop "tailscale $MODE config did not become active"; }
  TS_URL="https://$TS_HOST:$TS_HTTPS_PORT"
  trap cleanup EXIT
  export ALLOWED_DEV_ORIGINS="$TS_HOST" PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-$TS_URL}"
  log_ok "tailscale $MODE → $TS_URL"
  [ "$USE_FUNNEL" = 1 ] && echo -e "${YELLOW}  Public internet exposure — mock letters only, no login in this pilot build.${NC}"
fi

# --- Stage: Next.js ----------------------------------------------------------------
print_banner() {
  echo -e "\n${GREEN}${BOLD}Citizen Connect is starting${NC}"
  echo "  Local:  http://localhost:$APP_PORT"
  if [ -n "$TS_URL" ]; then
    echo -e "  Phone:  ${BOLD}$TS_URL${NC}   (open in Chrome on Android / Safari on iPhone)"
    node -e 'require("qrcode").toString(process.argv[1],{type:"terminal",small:true},(e,s)=>{if(!e)console.log(s)})' "$TS_URL" 2>/dev/null || true
  fi
  echo "  Health: http://localhost:$APP_PORT/api/health"
  echo "  Ctrl+C to stop."
}

if [ "$PROD" = 1 ]; then
  log_stage "Production build"
  rm -rf .next || fail_and_stop "failed to remove .next"
  npm run build || fail_and_stop "npm run build failed"
  log_ok "build succeeded"
  log_stage "Starting next start on :$APP_PORT"
  print_banner
  npx next start -p "$APP_PORT"
else
  log_stage "Starting next dev on :$APP_PORT"
  print_banner
  npx next dev -p "$APP_PORT"
fi
