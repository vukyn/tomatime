package server

import (
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"strings"
	"time"

	iapp "github.com/vukyn/tomatime/internal/app"
	"github.com/vukyn/tomatime/internal/config"
	"github.com/vukyn/tomatime/internal/constants"
	itemHandlers "github.com/vukyn/tomatime/internal/domains/item/handlers/http"
	"github.com/vukyn/tomatime/internal/middlewares"
	"github.com/vukyn/tomatime/internal/web"

	"github.com/gofiber/contrib/fiberzerolog"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/filesystem"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	pkgErr "github.com/vukyn/kuery/http/errors"
	pkgHttp "github.com/vukyn/kuery/http/fiber"
	"github.com/vukyn/kuery/log"
	pkgRecover "github.com/vukyn/kuery/recover"

	"github.com/sarulabs/di/v2"
)

type Server struct {
	app *fiber.App
	cfg *config.Config
}

func NewServer(cfg *config.Config) *Server {
	return &Server{
		cfg: cfg,
	}
}

func (s *Server) Start() {
	log.New().Info("Starting server")

	s.app = fiber.New(s.fiberConfig())

	s.mountMiddlewares(s.app, iapp.App)

	itemHandlers.SetupItemRoutes(s.apiGroup(s.app))

	// Web UI — the embedded Vite/React SPA. Registered AFTER all /api/v1 routes
	// so the catch-all never shadows the API.
	s.webRoutes()

	// Start the server.
	go func() {
		if err := s.app.Listen(fmt.Sprintf(":%d", s.cfg.App.Port)); err != nil {
			log.New().Errorf("Failed to start server: %v", err)
			os.Exit(1)
		}
	}()
}

func (s *Server) Stop() error {
	return s.app.Shutdown()
}

// fiberConfig builds the server's transport-level configuration. It is a method
// rather than an inline literal so the tests exercise the same construction
// Start() actually mounts.
func (s *Server) fiberConfig() fiber.Config {
	return fiber.Config{
		AppName: s.cfg.App.Name,

		// fasthttp applies no timeouts of its own, so leaving these unset makes
		// every one of them infinite. See internal/constants/http.go for why each
		// number is what it is.
		ReadTimeout:  constants.RequestReadTimeout,
		WriteTimeout: constants.RequestWriteTimeout,
		IdleTimeout:  constants.RequestIdleTimeout,
		BodyLimit:    constants.RequestBodyLimitBytes,

		// ProxyHeader makes c.IP() read the caller's address out of the named
		// header instead of the socket, for deployments that sit behind a proxy.
		// Empty here, and derived from config rather than hard-coded: this service
		// has no deploy target, so there is no proxy whose header could be
		// trusted. Setting one speculatively would be strictly worse than leaving
		// it off — a ProxyHeader that no proxy overwrites is a header the CLIENT
		// controls, which hands every caller the ability to pick its own
		// rate-limit bucket.
		ProxyHeader: s.cfg.App.ProxyHeader,

		// ⚠️ REQUIRED whenever ProxyHeader may be set. Without it fiber returns the
		// header VERBATIM with no socket fallback: an absent header yields an EMPTY
		// client IP — collapsing the per-IP limiter into a single global bucket, so
		// one caller's traffic throttles everyone — and junk rotated through the
		// header mints an unlimited supply of fresh buckets, which is a limiter
		// bypass. With it, an absent or malformed value falls back to the socket's
		// remote address.
		//
		// Set unconditionally, not only when ProxyHeader is non-empty, so that
		// configuring APP_PROXY_HEADER later cannot reintroduce the hole.
		EnableIPValidation: true,
	}
}

// mountMiddlewares registers the global middleware chain, in order. Extracted from
// Start() so the ordering — which is the security-relevant part — is testable.
//
// # Order, and why it is this one
//
// cors -> access log -> recover -> di container -> routes
//
// Two properties have to hold at once, and they pull in different directions:
//
//  1. A panic must be RECOVERED rather than killing the process. fasthttp does not
//     recover panics, so anything not covered by pkgRecover takes the whole server
//     down.
//  2. The request DI container must be RELEASED on every path, panics included.
//
// Property 2 holds in either order, because the release is a `defer` and Go runs
// deferred functions while a panic unwinds as well as on a normal return. Both
// orders are pinned by TestDiContainerMiddlewareReleasesRequestContainer, so it is
// property 1 that decides.
//
// And property 1 does NOT hold in either order. With the DI middleware outermost
// (the order this service shipped with), a panic raised INSIDE the DI middleware —
// before or during its own body — is caught by nothing and kills the process. That
// is not theoretical: di.Container is a struct whose zero value has a nil core, and
// Container.SubContainer() dereferences it immediately, so a DiContainerMiddleware
// handed an unbuilt container nil-panics on the very first request. Mounting
// pkgRecover OUTSIDE it turns that into a 500.
//
// The access log stays OUTSIDE recover on purpose. fiberzerolog logs after c.Next()
// returns and has no defer of its own, so a panic that unwound past it would never
// be logged; with recover inside, the panic is converted to a 500 first and the
// request still appears in the access log — which is exactly when you want it to.
func (s *Server) mountMiddlewares(app *fiber.App, appContainer di.Container) {
	app.Use(s.corsMiddleware())

	zerologLogger := log.New().Zerolog()
	app.Use(fiberzerolog.New(fiberzerolog.Config{
		Logger: &zerologLogger,
	}))

	// Recover from panics — mounted ahead of the DI middleware so a panic raised
	// by the DI middleware itself is caught too. See the ordering note above.
	app.Use(pkgRecover.NewFiberRecover())

	// Inject a request-scoped DI container into the Fiber ctx. It also RELEASES
	// that container; see middlewares.DiContainerMiddleware.
	app.Use(middlewares.DiContainerMiddleware(appContainer))
}

// defaultCORSAllowOrigins is the local development fallback: the Vite dev server
// plus the API's own port.
//
// TODO: set CORS_ALLOW_ORIGINS to this service's real browser origin(s) before
// deploying it anywhere.
const defaultCORSAllowOrigins = "http://localhost:5173,http://localhost:8080"

// corsMiddleware builds the CORS handler mounted by mountMiddlewares. A method so
// the test exercises the same construction the server actually mounts.
func (s *Server) corsMiddleware() fiber.Handler {
	return cors.New(cors.Config{
		AllowOrigins: corsAllowOrigins(s.cfg),
	})
}

// corsAllowOrigins resolves the browser origins allowed to call the API.
//
// This replaced a bare cors.New(), whose fiber default is AllowOrigins: "*" — on
// an API whose CRUD routes are unauthenticated, that let any web page a visitor
// happened to open read and write items from the visitor's browser.
//
// ⚠️ The interception is the point. Fiber restores its "*" default whenever
// AllowOrigins is empty (cors.go), so simply forwarding the config value would
// mean an unset or blank CORS_ALLOW_ORIGINS silently reopens the API to every
// origin — a wildcard produced by omission rather than by decision. Everything
// funnels through an explicit local-development fallback instead, and "*" is not
// reachable from any input.
func corsAllowOrigins(cfg *config.Config) string {
	if origins := strings.TrimSpace(cfg.CORS.AllowOrigins); origins != "" {
		return origins
	}
	return defaultCORSAllowOrigins
}

// apiGroup builds the /api/v1 router, rate limited as a group.
//
// Extracted so a test can prove the limiter is actually MOUNTED, not merely
// constructible: a test that mounts apiRateLimiter() itself would stay green if
// this group stopped applying it, which is the whole finding.
//
// The SPA, /assets and /tomatime.svg are deliberately left outside: throttling a
// page load is not the goal, and static assets would burn a caller's API budget.
func (s *Server) apiGroup(app *fiber.App) fiber.Router {
	return app.Group("/api/v1", s.apiRateLimiter())
}

// apiRateLimiter bounds how many API requests one client address may make per
// window. A method so the test mounts the same handler Start() does.
//
// ⚠️ This is the first thing in the service to key on c.IP(), which is why
// fiberConfig sets EnableIPValidation in the same change: a limiter keyed on a
// client-controlled IP is not a limiter. The two belong together and must not be
// separated.
func (s *Server) apiRateLimiter() fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        rateLimitMax(s.cfg),
		Expiration: rateLimitWindow(s.cfg),
		LimitReached: func(c *fiber.Ctx) error {
			// Answer in the same envelope as every other error, so a client does
			// not have to special-case the throttled response.
			return pkgHttp.Err(c, pkgErr.TooManyRequests("too many requests, please slow down"))
		},
	})
}

// rateLimitMax resolves the per-window request budget.
//
// ⚠️ Resolved here rather than handed to fiber, for the same reason as the CORS
// fallback: fiber's limiter silently substitutes its OWN defaults for a
// non-positive Max (5) and Expiration (1 minute). An unset RATE_LIMIT_MAX would
// therefore not disable the limiter — it would quietly make it 12x tighter than
// intended and look like it was working.
func rateLimitMax(cfg *config.Config) int {
	if cfg.RateLimit.Max > 0 {
		return cfg.RateLimit.Max
	}
	return constants.DefaultRateLimitMax
}

// rateLimitWindow resolves the fixed window the budget refills over. Same
// non-positive-means-default rule as rateLimitMax.
func rateLimitWindow(cfg *config.Config) time.Duration {
	if cfg.RateLimit.WindowSeconds > 0 {
		return time.Duration(cfg.RateLimit.WindowSeconds) * time.Second
	}
	return constants.DefaultRateLimitWindow
}

// webRoutes serves the embedded SPA. Hashed asset files are served from
// /assets; root-level static files (e.g. /tomatime.svg) are served by exact
// match BEFORE the SPA catch-all so the browser receives the real asset and not
// index.html. Any other non-API path renders the SPA shell for client routing.
func (s *Server) webRoutes() {
	// The built UI is embedded in the binary (internal/web) — served from that FS
	// rather than a working-directory-relative path, so the binary is self-contained.
	dist := web.FS()

	// Hashed JS/CSS bundles.
	s.app.Use("/assets", filesystem.New(filesystem.Config{
		Root:       http.FS(dist),
		PathPrefix: "assets",
	}))

	// Root-level static file (favicon). Exact route so it doesn't fall through
	// to the SPA catch-all and return HTML.
	s.app.Get("/tomatime.svg", func(c *fiber.Ctx) error {
		c.Type("svg")
		return sendEmbeddedFile(c, dist, "tomatime.svg")
	})

	// SPA catch-all — serve index.html for every remaining GET so deep links
	// resolve client-side.
	s.app.Get("/*", func(c *fiber.Ctx) error {
		c.Type("html")
		return sendEmbeddedFile(c, dist, "index.html")
	})
}

func sendEmbeddedFile(c *fiber.Ctx, dist fs.FS, name string) error {
	data, err := fs.ReadFile(dist, name)
	if err != nil {
		return fiber.ErrNotFound
	}
	return c.Send(data)
}
