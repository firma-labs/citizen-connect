---
name: fm-ship-dev-to-main
description: Commit pending changes on dev, open a PR to main, wait for checks, squash-merge, sync main back into dev, and verify the production Vercel deploy. Use when the user asks to "ship this", "release to production", "cut a release", or otherwise wants the dev→main release pipeline run end-to-end. (Adapted from firm-bz.)
argument-hint: "[autonomous|confirm]"
---

# Ship dev → main

Runs the full release pipeline for this repo: commit → push → PR → merge → sync → verify prod deploy.

This performs a squash-merge into `main`, which triggers a **production** deployment on Vercel
(citizen-connect-topaz.vercel.app — what officials see). Treat every step from the merge onward as a
real, hard-to-reverse action on shared state — not a routine local edit.

## Step 0 — Determine autonomy mode

The `argument-hint` accepts `autonomous` or `confirm`.

- If the user typed one of those with the command, use it directly — do not ask.
- If the user's own message plainly asks for the whole pipeline end to end (e.g. "create a PR from dev to main and ship it"), run it autonomously.
- Otherwise **ask the user** with AskUserQuestion before doing anything:
  - "Autonomous" — run all steps below without pausing. Only stop early if genuinely blocked (build fails, checks fail, merge conflicts).
  - "Confirm at each step" — pause before each numbered step below (commit, push, PR create, merge, dev sync, prod verify) and wait for explicit go-ahead.

## Step 1 — Review and commit

1. Run `git status` and `git diff --stat` to see everything pending — not just what you touched this session.
2. Never commit `.env*` (except `.env.example`), `.data/`, or anything that looks like a secret. Flag files whose purpose you're unsure of and ask before staging — even in autonomous mode. The `Claude outputs/` folder and the PRD (`.claude/plans/PRD-*.md`) are committed only when the user says so.
3. Confirm mode: show the commit message and file list, wait for approval. Autonomous mode: proceed, then list them in your report.
4. HEREDOC commit message ending with the Co-Authored-By line from the session's attribution reminder.

## Step 2 — Check, then push dev

There is no pre-push hook in this repo, so check before pushing:

```bash
npx tsc --noEmit && npm run lint && npm run i18n:check
```

Build (`npm run build`) in a scratch copy rather than the repo if the user's `next dev` is running from it
(port 4000) — a build writes to `.next/` too. Then `git push origin dev`. If a check fails, stop and report —
never bypass it.

## Step 3 — Create the PR

```bash
unset GH_TOKEN && gh pr create --repo firma-labs/citizen-connect --title "..." --body "..." --base main --head dev
```

`GH_TOKEN` may be set but invalid in this environment — always `unset` it first so `gh` falls back to the
valid keyring sign-in.

Write a real Summary + Test plan body, not a placeholder. End it with the PR attribution line from the
session's attribution reminder.

## Step 4 — Monitor PR checks

```bash
unset GH_TOKEN && gh pr checks <PR#> --repo firma-labs/citizen-connect --watch --interval 15
```

Run it in the background (the Vercel preview takes a few minutes) and let the harness notify you — no
sleep loops. If checks fail, stop and report — never merge a red PR.

## Step 5 — Squash-merge

**Confirm mode:** always pause here for explicit go-ahead — this is the step that ships to production.
**Autonomous mode:** proceed only if Step 4's checks are all green.

```bash
unset GH_TOKEN && gh pr merge <PR#> --repo firma-labs/citizen-connect --squash --delete-branch=false
```

Never delete `dev` — it is long-lived.

## Step 6 — Sync main back into dev

1. `git fetch origin`
2. `git diff --stat origin/main origin/dev` — if non-empty, the squash may not have captured everything on `dev`. Investigate before going on.
3. `git checkout dev && git merge origin/main -m "Merge main (PR #<N>) into dev"` (with the Co-Authored-By line).
4. `git push origin dev`
5. Re-run `git diff --stat origin/main origin/dev` — it must be empty.

## Step 7 — Verify the production deploy

The production deploy (from the merge to `main`) is separate from the PR's preview deploy — check it on its own.

1. Find the team and project with the Vercel tools `list_teams` / `list_projects` (project `citizen-connect`).
2. `list_deployments` for the project with `target: "production"`; pick the one whose `meta.githubCommitSha` matches the squash commit (`git log -1 origin/main`).
3. If it is `QUEUED`/`BUILDING`, wait for it without sleep-looping in Bash (background command or ScheduleWakeup at 60–120 s).
4. Report `READY` or `ERROR`. On `ERROR`, report and stop — no rollback or redeploy without asking.

## Reporting

Summarize: commit SHA, PR link, merge commit SHA, dev-sync status, final production deploy state. Never
fabricate any of these — if a step is still running when you report, say so.
