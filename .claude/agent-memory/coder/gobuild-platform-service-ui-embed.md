---
name: gobuild-platform-service-ui-embed
description: gobuild platform-service preset scaffolds a COMPLETE buildable Vite+React19+Chakra-v3 UI embedded via internal/web go:embed; make build-web→go build→serve proven end-to-end
metadata:
  type: project
---

The gobuild `platform-service` preset (`/Users/vuky10/vukyn/repo/pet-platform/gobuild/templates/platform-service/`) now emits the platform UI-embed STANDARD out of the box (was UI-less before).

**Why:** isme/medioa2/rainy converged on go:embed via `internal/web` + route-level code splitting; new services scaffolded from gobuild must match it so they don't carry the old runtime-serve/committed-bundle shape.

**How to apply / what's in the preset now:**
- `internal/web/web.go` (`//go:embed all:dist`, `FS()` returns `fs.Sub(embedded,"dist")`), `internal/web/web_test.go` (`TestEmbedRoot`), and `internal/web/dist/.gitkeep` (EMPTY 0-byte — survives `//go:embed all:templates`+WalkDir and renders empty since renderer parses non-.tmpl files as empty templates).
- `internal/server/server.go.tmpl`: `web.FS()` → `html.NewFileSystem(http.FS(uiFS))`, `/assets` http.FS sub, `favicon.svg` via `filesystem.SendFile`, SPA catch-all `c.Render("index", {APIBaseURL})`.
- Added `Vite.BaseURL` (`VITE_API_BASE_URL`) to config struct + env template (server render needs it).
- go.mod adds `github.com/gofiber/template/html/v2 v2.1.3`; scaffolder's `go mod tidy` resolves indirect `gofiber/template`.
- Makefile `web`/`build-web` (→ internal/web/dist + touch .gitkeep); .gitignore `internal/web/dist/*` + `!.gitkeep`.
- `ui/` is now a COMPLETE, BUILDABLE Vite 7 + React 19 + TS + Chakra v3 project (mirrors isme's minimal shape, SAME pinned versions): `package.json.tmpl` (name=`{{.ProjectName}}-ui`), `index.html.tmpl`, `tsconfig.json/.app/.node.tmpl`, `eslint.config.js.tmpl`, `vite.config.ts.tmpl` (manualChunks react-router guard + chakra/icons/axios), `src/main.tsx.tmpl` (`ChakraProvider value={defaultSystem}` — minimal, not isme's full provider/contexts), `src/index.css.tmpl`, `src/App.tsx.tmpl` (React.lazy+Suspense, single `/`→Home), `src/pages/Home.tsx.tmpl`, `public/favicon.svg` (static, generic go-blue layers glyph — NOT isme aurora).
- **index.html ↔ server APIBaseURL contract (critical gotcha):** the server's `c.Render("index", {APIBaseURL})` uses the gofiber html engine which substitutes `{{.APIBaseURL}}` at SERVE time. But gobuild renders every template (incl. non-.tmpl) through text/template with `missingkey=error`, so a literal `{{.APIBaseURL}}` in the .tmpl FAILS scaffolding. ESCAPE it as `{{ "{{.APIBaseURL}}" }}` so the rendered index.html carries the literal token. vite build leaves the inline-script string untouched → token survives into `internal/web/dist/index.html` → engine substitutes at serve (empty VITE_API_BASE_URL → `API_BASE_URL: ""`). Same `{{ "..." }}` escape needed for ANY future serve-time html-engine token in scaffolded files.

**Verification proven END-TO-END (2026-06-20):** scaffolded throwaway service → `make build-web` (npm install + `tsc -b && vite build`) SUCCEEDS, emits `internal/web/dist/{index.html, assets/* (react-router + @chakra-ui + Home lazy chunks split), favicon.svg}` → `go build/vet/test ./...` all pass (web embed test sees real bundle) → ran the binary, curl-equivalent (python urllib; a hook redirects raw curl/wget — use python/Go HTTP client to probe) confirmed: `GET /`→200 html with injected `API_BASE_URL: ""` + title=ProjectName + /assets refs, `GET /favicon.svg`→200 image/svg+xml, `GET /assets/*.css|.js`→200 correct ctype. Golden tests regenerated via `go test . -update` (7 pass). **git add -f caveat:** golden `.gitignore` fixture self-ignores siblings (`.env`, `todo`, `db/app.db`, now also `ui/dist/`, `node_modules/`, `internal/web/dist/*`) → committer must `git add -f testdata/golden` so golden `.env`/`todo`/dist `.gitkeep` land. Supersedes the "platform-service is UI-less / pattern-carrier only" notes in [[gobuild-preset-system]].
