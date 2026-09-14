package server

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/vukyn/tomatime/internal/config"

	"github.com/gofiber/fiber/v2"
)

// The API ships with unauthenticated CRUD routes, so the CORS allow-list is a real
// boundary rather than a formality: with the wildcard this replaced, any page a
// visitor opened could create, edit and delete items from the visitor's browser.
//
// Fiber's cors middleware substitutes its own default — AllowOrigins: "*" —
// whenever the field is empty, which means a blank CORS_ALLOW_ORIGINS would
// silently reopen the API to every origin. These tests pin the interception that
// prevents that.

func TestCORSAllowOriginsFallsBackToLocalOrigins(t *testing.T) {
	cases := map[string]string{
		"unset":           "",
		"whitespace only": "   ",
	}
	for label, configured := range cases {
		cfg := new(config.Config)
		cfg.CORS.AllowOrigins = configured

		got := corsAllowOrigins(cfg)
		if got == "*" {
			t.Errorf("corsAllowOrigins(%s) = %q — the wildcard default must never be reachable", label, got)
		}
		if got == "" {
			t.Errorf("corsAllowOrigins(%s) = %q — empty is not a safe answer either: fiber turns an empty AllowOrigins back into \"*\"", label, got)
		}
		if got != defaultCORSAllowOrigins {
			t.Errorf("corsAllowOrigins(%s) = %q, want %q", label, got, defaultCORSAllowOrigins)
		}
	}
}

func TestCORSAllowOriginsUsesConfiguredValue(t *testing.T) {
	cfg := new(config.Config)
	cfg.CORS.AllowOrigins = "https://app.example.com"

	if got := corsAllowOrigins(cfg); got != "https://app.example.com" {
		t.Errorf("corsAllowOrigins(configured) = %q, want the configured value", got)
	}
}

// TestCORSRejectsUnlistedOrigin mounts the very handler Start() mounts, so it fails
// if corsMiddleware is ever reduced back to a bare cors.New().
func TestCORSRejectsUnlistedOrigin(t *testing.T) {
	cfg := new(config.Config)
	cfg.CORS.AllowOrigins = "https://app.example.com"

	app := fiber.New()
	app.Use(NewServer(cfg).corsMiddleware())
	app.Get("/probe", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	probe := func(origin string) string {
		t.Helper()
		request := httptest.NewRequest(http.MethodGet, "/probe", nil)
		request.Header.Set("Origin", origin)
		response, err := app.Test(request)
		if err != nil {
			t.Fatalf("app.Test: %v", err)
		}
		defer func() { _ = response.Body.Close() }()
		return response.Header.Get("Access-Control-Allow-Origin")
	}

	if allowed := probe("https://evil.example"); allowed != "" {
		t.Errorf("unlisted origin was allowed: Access-Control-Allow-Origin = %q", allowed)
	}
	if allowed := probe("https://app.example.com"); allowed != "https://app.example.com" {
		t.Errorf("listed origin was not allowed: Access-Control-Allow-Origin = %q", allowed)
	}
}

// TestCORSWithUnsetConfigStillRejectsAnArbitraryOrigin is the regression test for
// the finding itself, end to end: build the server from a config with NOTHING set —
// the exact state a fresh deploy is in — and confirm an arbitrary origin is refused.
//
// This is the assertion that would have failed against the bare cors.New(), and it
// is deliberately separate from the unit test above: the unit test pins the
// resolver, this pins that the resolver is actually wired into the mounted handler.
func TestCORSWithUnsetConfigStillRejectsAnArbitraryOrigin(t *testing.T) {
	app := fiber.New()
	app.Use(NewServer(new(config.Config)).corsMiddleware())
	app.Get("/api/v1/items", func(c *fiber.Ctx) error { return c.SendString("ok") })

	request := httptest.NewRequest(http.MethodGet, "/api/v1/items", nil)
	request.Header.Set("Origin", "https://attacker.example")
	response, err := app.Test(request)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer func() { _ = response.Body.Close() }()

	if allowed := response.Header.Get("Access-Control-Allow-Origin"); allowed != "" {
		t.Fatalf("an arbitrary origin was allowed with NO CORS config set: Access-Control-Allow-Origin = %q — this is the bare cors.New() wildcard behaviour the fix removed", allowed)
	}
}
