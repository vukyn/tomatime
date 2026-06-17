# 🍅 tomatime

A Pomodoro timer that pairs focus sessions with a simple task list, so you can
plan what to work on and actually get deep work done.

**Live:** https://tomatimea.netlify.app

## Features

- **Pomodoro timer** — work / short-break / long-break sessions with start,
  pause, and reset.
- **Task list** — add, edit, complete, and delete tasks. Click a task to make
  it the active focus for the current session.
- **Stays put** — tasks and progress persist in the browser (localStorage); no
  account, no sign-up.
- **Desktop notifications** — get nudged when a session ends, even when the tab
  is in the background.
- **Clay theme** — a warm claymorphic interface.

## Tech

Frontend is a client-only single-page app — React 19, Vite 7, Chakra UI 3,
TypeScript. All state lives in the browser; there is no backend dependency,
which is why it deploys to Netlify as a static site.

The repo also carries a Go (Fiber + Bun/SQLite, clean-architecture) service
skeleton under the platform template, kept for a future backend. It is **not**
required to run or deploy the app today.

## Run locally

```bash
cd ui
npm install
npm run dev      # Vite dev server
npm run build    # production build → ui/dist
```

## Deploy (Netlify)

Deployment is configured in [`netlify.toml`](./netlify.toml): base `ui`, build
`npm run build`, publish `ui/dist`, with an SPA rewrite so client-side routes
resolve. Connect the repo in Netlify and it deploys from `main` automatically —
no extra config.

## Backend skeleton (optional)

The Go service is a scaffold (example `item` domain, no real persistence wired
to the UI yet). See `CLAUDE.md` for the architecture contract and extension
points (real domains, MongoDB, authentication).

```bash
go mod tidy
make migrate-up DB=sqlite   # create SQLite db + run migrations
make run                    # Fiber server on APP_PORT (default 8080)
```

## License

See [LICENSE](./LICENSE).
