# CLAUDE.md

Guidance for Claude Code when working in this repository.

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

Config is loaded from `.env` at the repo root via godotenv + envconfig.

## Architecture

Clean architecture, domain-driven layout. Entry: `cmd/main.go` ->
`internal/app` (`Init` builds the DI container, initializes the logger, forces
the DB singleton) -> `internal/server` (Fiber app + route registration).

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
  `pkgCtx.GetDiContainerRequestFromFiberCtx(c)` then `defer ctn.Delete()`, build
  a `context.Context` with `pkgCtx.NewContextFromFiberCtx(c)`, call the usecase,
  and funnel responses through `pkgHttp.OK` / `pkgHttp.Err`.
- Only handlers/middleware log.

### Dependency injection (`internal/di/`)

`di.NewBuilder()` registers definitions in dependency order:
`config -> db -> middleware -> repositories -> usecases`. DI names are the
constants in `internal/constants/di.go` (`config`, `db`, `middleware`,
`item.repository`, `item.usecase`). Singletons are `di.App`-scoped; repos and
usecases are `di.Request`-scoped. `DiContainerMiddleware` creates a
request-scoped sub-container per request and stores it in Fiber locals.

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
