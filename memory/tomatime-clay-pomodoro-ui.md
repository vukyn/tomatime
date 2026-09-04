---
name: tomatime-clay-pomodoro-ui
description: "tomatime first UI shipped — clay-theme Pomodoro page (timer + tasks), client-state only, no backend domain; supersedes \"no UI / item placeholder\" notes"
metadata: 
  node_type: memory
  type: project
---

tomatime got its first frontend, MERGED to main (PR#1 squash af7d785, 2026-06-16). It's a **client-state-only** Pomodoro app — NO backend domain wired (timer + tasks live in React state/localStorage `tomatime.tasks.v1` + `tomatime.activeTask.v1`). The `item` domain is still the untouched template placeholder.

**Theme**: new default `clay` (Warm Claymorphism, tomato red) — own token set, does NOT inherit medioa2 cursor. Source of truth `demo/clay-pomodoro-design.html`. Custom Chakra `shadows.*` tokens (`clayRaised`/`clayPressed`/`claySoft`/`tomatoRaised`) in `ui/src/theme/index.ts` — the deliberate custom-CSS area.

**Stack/serve**: Vite7+React19+Router7+Chakra3+TS under `ui/`; `make build-web` → `internal/ui/dist` (go:embed `internal/ui/ui.go`) served by Fiber `webRoutes()` (/assets + root-file route before SPA catch-all). Built assets gitignored; placeholder `internal/ui/dist/index.html` committed so `go build` works pre-build. Feature: `ui/src/features/pomodoro/`.

**Features**: 3-tab timer (25/5/15) ring+spacebar+cycle rule(4th→long)+skip; timer context label (active task `name·🍅N` / no-task just "Time to focus", no count); todo CRUD; **click row → switch active todo** (drives timer + pomodoro target, persisted); collapsible create form ("+ Add task" trigger ↔ form with × close); full-screen timer layout (first-view `minH 100dvh`, `pt 4vh`, tasks below fold).

In mprocs.yaml (platform root, not git-tracked): `tomatime-{build-web,run,build-run,ui}`. No `.local` host (standalone, no SSO).

Related: [[gobuild-preset-system]] (scaffolded from platform-service preset), [[chakra-v3-gotchas]] + [[chakra-v3-gotchas]] (gotchas hit during port).
