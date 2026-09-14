# CLAUDE.md

Guidance for Claude Code when working in this repository.

## The memory layer

@MEMORY.md

⚠️ **That import is the point of the file, not decoration.** `MEMORY.md` and
`memory/` are the distilled layer — one hard-won fact per file, with why it
matters — and they live **in the repository** because a machine's own Claude
memory directory is workspace-scoped and machine-local: this repo opened on
another machine, or outside the workspace the notes were written in, arrived with
none of them.

It is a **distillation, not the record.** This file and the repository's other
documents stay the authority; where a note disagrees with the file that owns the
subject, the repository wins and the note is what to fix. `MEMORY.md` carries the
rules the notes are written under — one line per note in the index, one fact per
file, say why rather than only what, and delete a wrong note rather than adding a
second one beside it.

## Overview

`tomatime` (module `github.com/vukyn/tomatime`) is a clean-architecture Go
service generated from the pet-platform `platform-service` preset. It uses
Fiber v2, Bun ORM over SQLite, `sarulabs/di/v2` for dependency injection, and
the shared `github.com/vukyn/kuery` library (logging, ctx helpers, HTTP
responses, graceful shutdown, panic recovery, Bun hooks, crypto/ULID).

## Commands

```bash
make run                    # go run cmd/main.go
make build                  # build binary to bin/
make migrate-up DB=sqlite   # run db/migrate.go sqlite up
make migrate-down DB=sqlite # rollback last migration
make migrate-reset DB=sqlite# rollback all migrations

make web                    # Vite dev server in ui/
make build-web              # build the React UI into internal/ui/dist (embedded)

go build ./...              # verify
go vet ./...
go test ./...              # no _test.go ship by default — add your own
```

Config is loaded from `.env` at the repo root via godotenv + envconfig. `.env` is
gitignored, so the security-relevant variables are listed here instead — all are
optional, and **every one of them falls back to a safe value rather than to "off"**:

| variable | default when unset | notes |
|---|---|---|
| `CORS_ALLOW_ORIGINS` | `http://localhost:5173,http://localhost:8080` | comma-separated allow-list. ⚠️ Never resolves to `*` — see below. |
| `APP_PROXY_HEADER` | empty (use the socket address) | the header `c.IP()` reads. Set it **only** if a proxy actually overwrites that header. |
| `RATE_LIMIT_MAX` | `60` | per-IP budget on `/api/v1`. ⚠️ `0` means "use the default", not "disabled". |
| `RATE_LIMIT_WINDOW_SECONDS` | `60` | the window the budget refills over. |

⚠️ **The fallbacks are load-bearing, not politeness.** Fiber substitutes its own
defaults for empty/non-positive values, and its defaults are wrong here: an empty
`AllowOrigins` becomes `*` (reopening an unauthenticated CRUD API to every origin),
and a non-positive limiter `Max` becomes `5`. Both are therefore resolved in
`internal/server` *before* fiber sees them, and pinned by tests that assert the
framework default is unreachable. Do not "simplify" a resolver into passing the
config value straight through.

## Architecture

Clean architecture, domain-driven layout. Entry: `cmd/main.go` ->
`internal/app` (`Init` builds the DI container, initializes the logger, forces
the DB singleton) -> `internal/server` (Fiber app + route registration).

### ⚠️ Middleware order is load-bearing

`internal/server.mountMiddlewares` mounts, in this order:

```
cors -> access log -> recover -> di container -> routes
```

**Recover sits OUTSIDE the DI middleware, and that is not interchangeable.**
`di.Container` is a struct whose zero value has a nil core, and `SubContainer()`
dereferences it on its first line — so `DiContainerMiddleware` handed an unbuilt
container (the state `iapp.App` is in until `app.Init()` runs) nil-panics on the
first request. fasthttp does not recover panics, so with recover mounted *inside*,
that panic kills the process. Reverting the order makes
`TestPanicInsideTheDiMiddlewareIsRecovered` crash the test binary outright.

The container release does **not** depend on this order — it is a `defer`, so it
runs while a panic unwinds too — and both orders are pinned by
`TestDiContainerMiddlewareReleasesRequestContainer`. The access log stays *outside*
recover on purpose: fiberzerolog logs after `c.Next()` with no defer of its own, so
a panic that unwound past it would never be logged.

The `/api/v1` group is rate limited (`apiGroup`); the SPA, `/assets` and
`/tomatime.svg` deliberately are not.

### Layer flow per domain (`internal/domains/<domain>/`)

```
handlers/http  ->  usecase  ->  repository  ->  entity (Bun model / DB)
models/            request + response DTOs with .Validate()
exceptions/        domain error types {Message, Code}
```

Rules (non-negotiable, mirror the platform):

- `entity/` holds Bun ORM models only — no business logic. Audit fields
  (`CreatedAt/By`, `UpdatedAt/By`, `DeletedAt/By` with `soft_delete,nullzero`);
  timestamps set in the `BeforeAppendModel` hook.
- `repository/` exposes an `IRepository` interface in `irepository.go` plus an
  impl over `*bun.DB`. Repos wrap `sql.ErrNoRows` into domain exceptions and
  return errors without logging.
- `usecase/` depends on the repository INTERFACE, never the concrete impl. IDs
  for new rows use `kuery/cryp.ULID()`.
- `handlers/http/` are thin: resolve the request-scoped container with
  `pkgCtx.GetDiContainerRequestFromFiberCtx(c)`, build a `context.Context` with
  `pkgCtx.NewContextFromFiberCtx(c)`, call the usecase, and funnel responses
  through `pkgHttp.OK` / `pkgHttp.Err`. ⚠️ Handlers must **NOT** call
  `ctn.Delete()` — they only borrow the container. See the DI section below.
- Only handlers/middleware log.

### Dependency injection (`internal/di/`)

`di.NewBuilder()` registers definitions in dependency order:
`config -> db -> middleware -> repositories -> usecases`. DI names are the
constants in `internal/constants/di.go` (`config`, `db`, `middleware`,
`item.repository`, `item.usecase`). Singletons are `di.App`-scoped; repos and
usecases are `di.Request`-scoped. `DiContainerMiddleware` creates a
request-scoped sub-container per request, stores it in Fiber locals, **and
releases it** with its own `defer`.

⚠️ **Whoever creates a sub-container owns its whole lifetime.** Handlers only
borrow it and must never call `ctn.Delete()`. This middleware is mounted
globally, ahead of the routes, so it has already built a container by the time
anything decides the request will not reach a handler — a rate-limit 429,
`/assets`, `/tomatime.svg`, a 405, every SPA catch-all render. `sarulabs/di`
holds every sub-container in its parent's `children` map until it is deleted, so
a handler-owned release leaks one container per such request for the life of the
process, and those paths are the cheap unauthenticated ones. A leftover handler
`defer` is not a visible failure either — di's second `Delete` returns nil, it
just runs every registered `Close` twice — so the rule is pinned by
`internal/middlewares/container_ownership_test.go` (a static scan of `internal/`
plus a runtime `Close` counter), not by review.

### Database

SQLite at `db/app.db` (Bun `sqlitedialect` + `sqliteshim` driver, no CGO).
Migrations are plain Go funcs in `db/history/sqlite/sqlite.go`, run by
`db/migrate.go`. Soft delete via `deleted_at`.

## Conventions

- Interfaces prefixed `I` (`IRepository`, `IUseCase`); files `snake_case.go`.
- `any`, not `interface{}`. No abbreviated variable names.
- `ctx context.Context` is the first parameter of repository/usecase methods.
- Import groups: stdlib | third-party | internal, with domain-prefixed aliases
  (`itemEntity`, `pkgCtx`, `pkgHttp`).
- `pkg/`-style reusable code belongs in `github.com/vukyn/kuery`, not a local
  package.

## Extension points (out of scope for the generated skeleton)

- **Tests** — the skeleton ships no `_test.go`. Add table-driven tests per
  domain (usecase against repository fakes; handlers via Fiber `app.Test`).
- **UI** — a Vite 7 + React 19 + Chakra UI 3 (TypeScript) app lives under `ui/`.
  Its default theme is "clay" (Warm Claymorphism, `ui/src/theme/index.ts`); the
  design source of truth is `demo/clay-pomodoro-design.html`. Frontend
  conventions: `docs/frontend-structure.md` + `docs/chakra-v3.md` (Chakra v3
  only). The single feature is the client-state Pomodoro page under
  `ui/src/features/pomodoro/` (timer + tasks persisted to localStorage — there
  is no backend task domain yet). `make build-web` builds the SPA into
  `internal/ui/dist`, which is `go:embed`-ed (`internal/ui/ui.go`) and served by
  Fiber in `internal/server/server.go` (/assets + root-file route + SPA
  catch-all). Built assets are gitignored; only a placeholder
  `internal/ui/dist/index.html` is committed so `go build` works pre-build.
- **MongoDB** — this preset is SQLite-only. A Mongo-backed variant would swap
  `internal/di/di_db.go` and the repository impls for the Mongo driver and drop
  the `db/` migration runner.
- **Authentication** — no auth middleware is wired (the example routes are
  open). To protect routes, add the `kuery/auth` middleware in
  `internal/middlewares` and apply it in `internal/server` route registration,
  as the platform's downstream services do.

## ⚠️ Known bug: `/sounds/*.mp3` returns HTML in production

The pomodoro alarm + click sounds do NOT play on the deployed app. `useTimer.ts` requests
`/sounds/alarm.mp3` and `/sounds/click.mp3`, the files ARE in the embedded bundle, but
`internal/server/server.go` mounts static only at `/assets` — so both fall into the
`GET /*` catch-all and come back as index.html at **status 200** (not 404, so logs look
healthy, and an `<audio>` fed HTML fails silently).

Audited 2026-08-10, NOT yet fixed — the plan, the exact fix and the platform-wide context
are in `docs/pwa-root-file-audit.md`. ⚠️ A `/:file` handler like gardener's does not cover
it: `/sounds/alarm.mp3` is two segments, so the directory needs its own mount.
