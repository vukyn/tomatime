// Package ui embeds the built Vite/React single-page app so the Go binary can
// serve the frontend without external files.
//
// The committed tree here is a placeholder (index.html only) that keeps
// `go:embed` and `go build` happy before the UI is built. Running
// `make build-web` replaces this directory with the real Vite `dist` output;
// the placeholder index.html is restored automatically afterwards so the embed
// directive always has something to point at.
package ui

import "embed"

// Assets holds the built SPA (index.html + assets/*). The `all:` prefix ensures
// hashed asset files (which Vite emits) are included.
//
//go:embed all:dist
var Assets embed.FS
