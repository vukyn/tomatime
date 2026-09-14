package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/vukyn/tomatime/internal/config"
	"github.com/vukyn/tomatime/internal/constants"

	"github.com/gofiber/fiber/v2"
)

// newLimitedApp registers a route through the REAL apiGroup, on top of the REAL
// fiber config.
//
// It goes through s.apiGroup rather than mounting s.apiRateLimiter() by hand for a
// specific reason: mounting the limiter itself would keep every test below green
// even if Start() stopped applying it to /api/v1, which is the finding rather than
// a detail. The limiter and the IP handling in fiberConfig are likewise one change
// and are exercised together here, because a limiter keyed on a client-controlled
// IP is not a limiter.
func newLimitedApp(t *testing.T, cfg *config.Config) *fiber.App {
	t.Helper()
	server := NewServer(cfg)
	app := fiber.New(server.fiberConfig())
	server.apiGroup(app).Get("/items", func(c *fiber.Ctx) error { return c.SendStatus(http.StatusOK) })
	return app
}

// TestApiGroupAppliesTheRateLimiter states the wiring as its own assertion, so the
// failure message names the cause rather than leaving it to be inferred from a
// budget test.
func TestApiGroupAppliesTheRateLimiter(t *testing.T) {
	app := newLimitedApp(t, smallBudgetConfig(""))
	for range 3 {
		_ = status(t, app, "")
	}
	if got := status(t, app, ""); got != http.StatusTooManyRequests {
		t.Fatalf("a route registered through apiGroup answered %d after its budget was spent, want 429 — /api/v1 is not rate limited", got)
	}
}

// get issues one request, optionally carrying a forwarded-for value.
func get(t *testing.T, app *fiber.App, forwardedFor string) *http.Response {
	t.Helper()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/items", nil)
	if forwardedFor != "" {
		request.Header.Set("X-Forwarded-For", forwardedFor)
	}
	response, err := app.Test(request)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	return response
}

func status(t *testing.T, app *fiber.App, forwardedFor string) int {
	t.Helper()
	response := get(t, app, forwardedFor)
	defer func() { _ = response.Body.Close() }()
	return response.StatusCode
}

// smallBudgetConfig keeps the tests fast: a budget of 3 over a long window, so
// nothing depends on wall-clock timing.
func smallBudgetConfig(proxyHeader string) *config.Config {
	cfg := new(config.Config)
	cfg.App.ProxyHeader = proxyHeader
	cfg.RateLimit.Max = 3
	cfg.RateLimit.WindowSeconds = 300
	return cfg
}

// TestRateLimiterBlocksAfterTheBudget is the base property: the API group is
// bounded at all. Before this change nothing rate limited the unauthenticated CRUD
// routes.
func TestRateLimiterBlocksAfterTheBudget(t *testing.T) {
	app := newLimitedApp(t, smallBudgetConfig(""))

	for attempt := 1; attempt <= 3; attempt++ {
		if got := status(t, app, ""); got != http.StatusOK {
			t.Fatalf("request %d within budget = %d, want 200", attempt, got)
		}
	}
	if got := status(t, app, ""); got != http.StatusTooManyRequests {
		t.Fatalf("request 4 (over budget) = %d, want 429", got)
	}
}

// TestRateLimiter429UsesTheApiErrorEnvelope asserts the BODY, not just the status:
// the throttled response is something the frontend renders, so its shape is a
// contract. A default fiber limiter answers with an empty body.
func TestRateLimiter429UsesTheApiErrorEnvelope(t *testing.T) {
	app := newLimitedApp(t, smallBudgetConfig(""))
	for range 3 {
		_ = status(t, app, "")
	}

	response := get(t, app, "")
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429", response.StatusCode)
	}

	var body struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("the 429 body is not the JSON envelope every other error uses: %v", err)
	}
	if body.Code != http.StatusTooManyRequests {
		t.Errorf("body code = %d, want %d", body.Code, http.StatusTooManyRequests)
	}
	if body.Message == "" {
		t.Error("body message is empty — a throttled client gets no explanation")
	}
}

// TestRateLimiterBucketsPerCallerBehindAProxy is the FIRST of the two mutations
// that prove the ProxyHeader wiring, and it is the one that fails if ProxyHeader is
// dropped: with it unset, fiber reads the socket address, and app.Test always
// reports 0.0.0.0 — so every caller lands in ONE bucket and the second address is
// throttled by the first address's traffic.
func TestRateLimiterBucketsPerCallerBehindAProxy(t *testing.T) {
	app := newLimitedApp(t, smallBudgetConfig("X-Forwarded-For"))

	for attempt := 1; attempt <= 3; attempt++ {
		if got := status(t, app, "203.0.113.10"); got != http.StatusOK {
			t.Fatalf("caller A request %d = %d, want 200", attempt, got)
		}
	}
	if got := status(t, app, "203.0.113.10"); got != http.StatusTooManyRequests {
		t.Fatalf("caller A over budget = %d, want 429", got)
	}

	// A DIFFERENT caller must still have its own budget. Without ProxyHeader both
	// share the socket address and this is a 429.
	if got := status(t, app, "198.51.100.7"); got != http.StatusOK {
		t.Fatalf("caller B first request = %d, want 200 — callers are sharing one bucket, so the limiter is keyed on the proxy rather than the client", got)
	}
}

// TestRateLimiterFoldsMalformedProxyHeadersOntoOneBucket is the SECOND mutation,
// and it is the one that fails if EnableIPValidation is dropped. Neither test fails
// if you only write the other.
//
// Without validation fiber returns the header VERBATIM, so every junk value becomes
// a key of its own and an attacker rotating the header has an unlimited supply of
// fresh budgets — a complete bypass. With it, an unparseable value falls back to
// the socket address, so all of these share one bucket and the budget still runs
// out.
func TestRateLimiterFoldsMalformedProxyHeadersOntoOneBucket(t *testing.T) {
	app := newLimitedApp(t, smallBudgetConfig("X-Forwarded-For"))

	blocked := false
	for attempt := range 12 {
		// A different unparseable value every time.
		junk := "not-an-ip-" + strconv.Itoa(attempt)
		if status(t, app, junk) == http.StatusTooManyRequests {
			blocked = true
			break
		}
	}
	if !blocked {
		t.Fatal("12 requests with 12 DIFFERENT malformed X-Forwarded-For values were all allowed — each junk value minted its own bucket, so the limiter is bypassable by rotating the header. EnableIPValidation must be set whenever ProxyHeader is.")
	}
}

// TestRateLimitDefaultsAreNotFibersOwn pins that a zero config means OUR default,
// not "disabled" and not fiber's.
//
// ⚠️ This is the trap the resolver exists for: fiber's limiter silently
// substitutes its own Max (5) and Expiration (1 minute) for any non-positive
// value. So an unset RATE_LIMIT_MAX does not disable the limiter and does not
// error — it quietly makes it 5, which is ~12x tighter than intended and looks
// exactly like a working limiter.
func TestRateLimitDefaultsAreNotFibersOwn(t *testing.T) {
	const fiberOwnDefaultMax = 5

	for label, cfg := range map[string]*config.Config{
		"unset":    new(config.Config),
		"zero":     configWithRateLimit(0, 0),
		"negative": configWithRateLimit(-1, -1),
	} {
		if got := rateLimitMax(cfg); got != constants.DefaultRateLimitMax {
			t.Errorf("rateLimitMax(%s) = %d, want %d", label, got, constants.DefaultRateLimitMax)
		}
		if got := rateLimitMax(cfg); got == fiberOwnDefaultMax {
			t.Errorf("rateLimitMax(%s) = %d — that is fiber's own default leaking through, not a decision", label, got)
		}
		if got := rateLimitWindow(cfg); got != constants.DefaultRateLimitWindow {
			t.Errorf("rateLimitWindow(%s) = %v, want %v", label, got, constants.DefaultRateLimitWindow)
		}
	}
}

// TestMountedLimiterUsesOurDefaultNotFibers is the INTEGRATION half of the default
// resolution, and it exists because the unit test above cannot see the bug it
// guards against.
//
// Every other limiter test here sets RateLimit.Max explicitly, so all of them stay
// green if apiRateLimiter stops calling rateLimitMax and hands fiber the raw config
// value instead (verified: that mutation passes the whole rest of this file). Only
// an UNSET config distinguishes the two — and on an unset config the raw value is
// 0, which fiber silently turns into its own Max of 5 rather than into our 60.
//
// So this drives the mounted limiter with a completely empty config: request 6 must
// still be allowed, and the budget must run out exactly at our default.
func TestMountedLimiterUsesOurDefaultNotFibersOnAnUnsetConfig(t *testing.T) {
	const fiberOwnDefaultMax = 5
	app := newLimitedApp(t, new(config.Config))

	for attempt := 1; attempt <= constants.DefaultRateLimitMax; attempt++ {
		got := status(t, app, "")
		if got == http.StatusTooManyRequests && attempt <= fiberOwnDefaultMax+1 {
			t.Fatalf("request %d was throttled on an UNSET config — fiber's own default of %d is in force, so the resolved default never reached the limiter", attempt, fiberOwnDefaultMax)
		}
		if got != http.StatusOK {
			t.Fatalf("request %d of the default budget (%d) = %d, want 200", attempt, constants.DefaultRateLimitMax, got)
		}
	}
	if got := status(t, app, ""); got != http.StatusTooManyRequests {
		t.Fatalf("request %d = %d, want 429 — an unset config must mean OUR default, not 'unlimited'", constants.DefaultRateLimitMax+1, got)
	}
}

func TestRateLimitUsesConfiguredValues(t *testing.T) {
	cfg := configWithRateLimit(250, 30)
	if got := rateLimitMax(cfg); got != 250 {
		t.Errorf("rateLimitMax = %d, want 250", got)
	}
	if got := rateLimitWindow(cfg); got != 30*time.Second {
		t.Errorf("rateLimitWindow = %v, want 30s", got)
	}
}

// TestRateLimiterHonoursTheConfiguredBudget proves the resolved values reach the
// mounted handler, rather than only the resolver being correct.
func TestRateLimiterHonoursTheConfiguredBudget(t *testing.T) {
	cfg := configWithRateLimit(7, 300)
	app := newLimitedApp(t, cfg)

	for attempt := 1; attempt <= 7; attempt++ {
		if got := status(t, app, ""); got != http.StatusOK {
			t.Fatalf("request %d of a budget of 7 = %d, want 200 — the configured Max did not reach the limiter", attempt, got)
		}
	}
	if got := status(t, app, ""); got != http.StatusTooManyRequests {
		t.Fatalf("request 8 = %d, want 429", got)
	}
}

func configWithRateLimit(max, windowSeconds int) *config.Config {
	cfg := new(config.Config)
	cfg.RateLimit.Max = max
	cfg.RateLimit.WindowSeconds = windowSeconds
	return cfg
}
