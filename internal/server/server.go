package server

import (
	"fmt"
	"io/fs"
	"net/http"
	"os"

	iapp "github.com/vukyn/tomatime/internal/app"
	"github.com/vukyn/tomatime/internal/config"
	itemHandlers "github.com/vukyn/tomatime/internal/domains/item/handlers/http"
	"github.com/vukyn/tomatime/internal/middlewares"
	"github.com/vukyn/tomatime/internal/ui"

	"github.com/gofiber/contrib/fiberzerolog"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/filesystem"
	"github.com/vukyn/kuery/log"
	pkgRecover "github.com/vukyn/kuery/recover"
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

	s.app = fiber.New(fiber.Config{
		AppName: s.cfg.App.Name,
	})

	// Middlewares
	s.app.Use(cors.New())
	zerologLogger := log.New().Zerolog()
	s.app.Use(fiberzerolog.New(fiberzerolog.Config{
		Logger: &zerologLogger,
	}))

	// Inject a request-scoped DI container into the Fiber ctx.
	s.app.Use(middlewares.DiContainerMiddleware(iapp.App))

	// Recover from panics.
	s.app.Use(pkgRecover.NewFiberRecover())

	// api/v1
	apiV1 := s.app.Group("/api/v1")
	itemHandlers.SetupItemRoutes(apiV1)

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

// webRoutes serves the embedded SPA. Hashed asset files are served from
// /assets; root-level static files (e.g. /tomatime.svg) are served by exact
// match BEFORE the SPA catch-all so the browser receives the real asset and not
// index.html. Any other non-API path renders the SPA shell for client routing.
func (s *Server) webRoutes() {
	dist, err := fs.Sub(ui.Assets, "dist")
	if err != nil {
		log.New().Errorf("Failed to mount embedded UI: %v", err)
		return
	}

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
