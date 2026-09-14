package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/vukyn/tomatime/internal/config"
	"github.com/vukyn/tomatime/internal/constants"

	"github.com/gofiber/fiber/v2"
)

// TestFiberConfigSetsTransportLimits pins that every transport limit is actually
// set. fasthttp applies none of its own, so a zero here is not "a sensible
// framework default" — it is "no limit at all", which is the finding.
func TestFiberConfigSetsTransportLimits(t *testing.T) {
	got := NewServer(new(config.Config)).fiberConfig()

	if got.ReadTimeout <= 0 {
		t.Errorf("ReadTimeout = %v — unset means no slowloris bound at all", got.ReadTimeout)
	}
	if got.WriteTimeout <= 0 {
		t.Errorf("WriteTimeout = %v — unset means a slow reader can hold a response open forever", got.WriteTimeout)
	}
	if got.IdleTimeout <= 0 {
		t.Errorf("IdleTimeout = %v — unset means idle keep-alive connections are never reclaimed", got.IdleTimeout)
	}
	if got.BodyLimit <= 0 {
		t.Errorf("BodyLimit = %d — unset falls back to whatever fiber defaults to this release", got.BodyLimit)
	}

	if got.ReadTimeout != constants.RequestReadTimeout {
		t.Errorf("ReadTimeout = %v, want %v", got.ReadTimeout, constants.RequestReadTimeout)
	}
	if got.WriteTimeout != constants.RequestWriteTimeout {
		t.Errorf("WriteTimeout = %v, want %v", got.WriteTimeout, constants.RequestWriteTimeout)
	}
	if got.IdleTimeout != constants.RequestIdleTimeout {
		t.Errorf("IdleTimeout = %v, want %v", got.IdleTimeout, constants.RequestIdleTimeout)
	}
	if got.BodyLimit != constants.RequestBodyLimitBytes {
		t.Errorf("BodyLimit = %d, want %d", got.BodyLimit, constants.RequestBodyLimitBytes)
	}

	// Tighter than fiber's own 4 MiB default, which is the point of stating it.
	if got.BodyLimit >= 4*1024*1024 {
		t.Errorf("BodyLimit = %d — no tighter than fiber's default, so declaring it buys nothing", got.BodyLimit)
	}
}

// TestBodyLimitRejectsAnOversizedBody proves BodyLimit is enforced by the server
// and not merely present in a struct.
//
// The assertion is "the handler is never reached", not a status code, because
// fasthttp enforces the limit while READING the request: an oversized body fails
// the connection outright ("body size exceeds the given limit") instead of
// producing a 413 response. Reaching-the-handler is the property that actually
// matters — it is what decides whether an oversized body is ever materialised —
// and it stays true whichever way a future fiber chooses to report the refusal.
func TestBodyLimitRejectsAnOversizedBody(t *testing.T) {
	handlerCalls := 0
	app := fiber.New(NewServer(new(config.Config)).fiberConfig())
	app.Post("/api/v1/items", func(c *fiber.Ctx) error {
		handlerCalls++
		return c.SendStatus(http.StatusOK)
	})

	send := func(size int) (int, error) {
		t.Helper()
		request := httptest.NewRequest(http.MethodPost, "/api/v1/items", strings.NewReader(strings.Repeat("a", size)))
		request.Header.Set("Content-Type", "application/json")
		response, err := app.Test(request)
		if err != nil {
			return 0, err
		}
		defer func() { _ = response.Body.Close() }()
		return response.StatusCode, nil
	}

	// A realistic body must still get through — a limit that rejects everything
	// would pass a "rejects oversized bodies" test while breaking the API.
	status, err := send(1024)
	if err != nil {
		t.Fatalf("a 1 KiB body failed outright (%v) — the limit is too tight to serve real requests", err)
	}
	if status != http.StatusOK {
		t.Fatalf("a 1 KiB body was rejected with %d — the limit is too tight to serve real requests", status)
	}
	if handlerCalls != 1 {
		t.Fatalf("the handler ran %d times for a valid request, want 1", handlerCalls)
	}

	status, err = send(constants.RequestBodyLimitBytes + 4096)
	if err == nil && status != http.StatusRequestEntityTooLarge {
		t.Fatalf("an oversized body answered %d with no error — BodyLimit is not being enforced", status)
	}
	if handlerCalls != 1 {
		t.Fatalf("an oversized body REACHED the handler (calls=%d, want still 1) — BodyLimit is not being enforced", handlerCalls)
	}
}

// TestFiberConfigAlwaysEnablesIPValidation is the one that protects the rate
// limiter, and it is separate from the limiter's own tests on purpose.
//
// ⚠️ EnableIPValidation must be true UNCONDITIONALLY, including when ProxyHeader is
// empty. Without it fiber returns the named header verbatim with no socket
// fallback, so an absent header yields an EMPTY client IP (every caller lands in
// one bucket) and junk rotated through the header mints unlimited fresh buckets (a
// limiter bypass). Tying the flag to "ProxyHeader is set" would mean that merely
// configuring APP_PROXY_HEADER later silently reintroduces both holes — which is
// why this asserts against a config with ProxyHeader unset.
func TestFiberConfigAlwaysEnablesIPValidation(t *testing.T) {
	for _, proxyHeader := range []string{"", "X-Forwarded-For", "Fly-Client-IP"} {
		cfg := new(config.Config)
		cfg.App.ProxyHeader = proxyHeader

		got := NewServer(cfg).fiberConfig()
		if !got.EnableIPValidation {
			t.Errorf("EnableIPValidation = false with ProxyHeader=%q — a client-controlled IP is not a rate-limit key", proxyHeader)
		}
		if got.ProxyHeader != proxyHeader {
			t.Errorf("ProxyHeader = %q, want %q — it must come from config, never be hard-coded", got.ProxyHeader, proxyHeader)
		}
	}
}

// TestProxyHeaderDefaultsToEmpty pins the default. A ProxyHeader that no proxy
// actually overwrites is a header the CLIENT sets, so guessing a provider's header
// for a service with no deploy target would hand every caller its own rate-limit
// bucket.
func TestProxyHeaderDefaultsToEmpty(t *testing.T) {
	if got := NewServer(new(config.Config)).fiberConfig().ProxyHeader; got != "" {
		t.Fatalf("ProxyHeader defaults to %q, want empty — there is no proxy in front of this service to trust", got)
	}
}
