---
name: tomatime-scan-baseline
description: tomatime security baseline — UI exists and ships to Netlify (platform CLAUDE.md says otherwise), Go backend undeployed, DI leak confirmed real
metadata:
  type: project
---

Baseline as of scan 2026-09-14 (repo HEAD `10783c5`).

**Two platform-`CLAUDE.md` claims about tomatime are wrong — verify, don't inherit:**

1. "tomatime has no UI yet" is **false**. `ui/` is a full Vite 7 + React 19 + Chakra v3 app
   (26 files under `ui/src`, pomodoro feature). It **is deployed** — `netlify.toml` builds
   `base = "ui"` -> `publish = "dist"`. So npm audit is in scope and its prod findings are
   internet-facing. The `[[tomatime-clay-pomodoro-ui]]` workspace note was the accurate one.
2. There is **no `fly.toml`** — the Go backend is deployed nowhere. Netlify publishes the
   static SPA only. That is what keeps the unauthenticated `/api/v1/items` CRUD at Medium
   rather than High; re-check `ls fly.toml` before reusing that reasoning.

**The UI never calls the backend.** Zero `fetch(` / `axios` / `/api/` hits in `ui/src` — it
is client-state only. The Go service and the SPA are effectively two unrelated deliverables
sharing one repo.

**DI container leak: CONFIRMED still present**, not stale doc. 5 handler defers in
`internal/domains/item/handlers/http/handler.go` (lines 15/37/59/76/98) are real code, not
comments, and `internal/middlewares/middleware.go:25-33` does **not** release. The stale
comment at `middleware.go:24` really does instruct the old wrong rule. No
`container_ownership_test.go`. Repos+usecases are `di.Request` scope, so every leaked
sub-container retains two live objects for the process lifetime. See
[[di-container-leak-per-service]].

**Clean floor (re-verify, don't assume):** govulncheck 0 reachable · gosec 5x G104 only
(unhandled `tx.Rollback()`) · gitleaks clean on history AND `--no-git` worktree · `.env`
never committed, gitignored, mode 0600, holds no credentials (app/logger/graceful knobs
only) · all SQL is parameterized Bun, raw `Exec` is static DDL · kuery pin v1.60.0 resolves
200 and sits inside the live 5-tag window.

**Why:** the previous scan (2026-06-16) predated the entire UI — it found 10 low and nothing
else, because `ui/` and `netlify.toml` did not exist yet. A clean scan of an older, smaller
tomatime said nothing about this one.

**How to apply:** when scanning tomatime always run the nested-lockfile path
(`osv-scanner scan source -r .` picks up `ui/package-lock.json`; without `-r` it finds only
`go.mod` and exits 0 looking clean). Treat react-router prod advisories as internet-facing
because of Netlify. Its knowledge graph was last built 2026-06-20 and is stale against HEAD,
so graph-assisted triage is unavailable until someone permitted to build it does so.
