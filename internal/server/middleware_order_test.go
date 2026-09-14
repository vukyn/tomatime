package server

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/vukyn/tomatime/internal/config"

	pkgCtx "github.com/vukyn/kuery/ctx"

	"github.com/gofiber/fiber/v2"
	"github.com/sarulabs/di/v2"
)

// These tests pin the middleware ORDER that mountMiddlewares establishes:
//
//	cors -> access log -> recover -> di container -> routes
//
// Two properties have to hold at once, and the scanner finding ("move recover
// above the DI middleware") is only half the story:
//
//  1. a panic is RECOVERED rather than killing the process, and
//  2. the request DI container is RELEASED, panic included.
//
// Property 2 holds in EITHER order, because the release is a `defer` and Go runs
// deferred functions while a panic unwinds as well as on a normal return — that is
// proven independently, under both orders, by
// TestDiContainerMiddlewareReleasesRequestContainer in internal/middlewares. So
// property 1 is what decides the order, and property 1 is NOT order-independent:
// only recover-outside catches a panic raised by the DI middleware itself.
//
// Both are asserted here so the ordering cannot be "tidied" back with the tests
// still green.

// TestPanicInsideTheDiMiddlewareIsRecovered is the test that distinguishes the two
// orders, and the reason the order changed.
//
// di.Container is a STRUCT, not an interface, and its zero value has a nil core;
// Container.SubContainer() dereferences that core on its first line. So a
// DiContainerMiddleware handed an unbuilt container nil-panics on the very first
// request — which is the shape of a boot-order regression, since iapp.App is
// exactly a zero di.Container until app.Init() has run.
//
// With recover mounted OUTSIDE the DI middleware this is a 500. With recover
// mounted inside it — the order this service shipped with — nothing catches it:
// fasthttp does not recover panics, so it takes the process down. That failure
// mode is why this test does not merely assert a status; if the order regresses,
// the panic escapes and the test binary itself dies, which is precisely the
// production consequence.
func TestPanicInsideTheDiMiddlewareIsRecovered(t *testing.T) {
	app := fiber.New()
	// A zero-value container: never built, nil core.
	NewServer(new(config.Config)).mountMiddlewares(app, di.Container{})
	app.Get("/api/v1/items", func(c *fiber.Ctx) error { return c.SendStatus(http.StatusOK) })

	response, err := app.Test(httptest.NewRequest(http.MethodGet, "/api/v1/items", nil))
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer func() { _ = response.Body.Close() }()

	if response.StatusCode != http.StatusInternalServerError {
		t.Fatalf("a panic raised by the DI middleware answered %d, want 500 — recover must be mounted OUTSIDE the DI middleware, or nothing catches it and fasthttp lets it kill the process", response.StatusCode)
	}
}

// TestHandlerPanicIsRecoveredAndReleasesTheContainer is the other half: moving
// recover outward must not cost property 2. A panicking handler has to be both
// answered with a 500 AND have its container released.
func TestHandlerPanicIsRecoveredAndReleasesTheContainer(t *testing.T) {
	const probeName = "release-probe"

	var (
		mutex      sync.Mutex
		closeCalls int
		captured   []di.Container
	)

	builder, err := di.NewBuilder()
	if err != nil {
		t.Fatalf("di builder: %v", err)
	}
	if err := builder.Add(di.Def{
		Name:  probeName,
		Scope: di.Request,
		Build: func(ctn di.Container) (any, error) { return new(int), nil },
		Close: func(obj any) error {
			mutex.Lock()
			defer mutex.Unlock()
			closeCalls++
			return nil
		},
	}); err != nil {
		t.Fatalf("add probe: %v", err)
	}
	appContainer := builder.Build()
	t.Cleanup(func() {
		if !appContainer.IsClosed() {
			_ = appContainer.DeleteWithSubContainers()
		}
	})

	app := fiber.New()
	NewServer(new(config.Config)).mountMiddlewares(app, appContainer)
	app.Use(func(c *fiber.Ctx) error {
		container := pkgCtx.GetDiContainerRequestFromFiberCtx(c)
		mutex.Lock()
		captured = append(captured, container)
		mutex.Unlock()
		if _, err := container.SafeGet(probeName); err != nil {
			return err
		}
		return c.Next()
	})
	app.Get("/api/v1/items", func(c *fiber.Ctx) error { panic("handler exploded") })

	response, err := app.Test(httptest.NewRequest(http.MethodGet, "/api/v1/items", nil))
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer func() { _ = response.Body.Close() }()

	if response.StatusCode != http.StatusInternalServerError {
		t.Fatalf("a panicking handler answered %d, want 500", response.StatusCode)
	}

	mutex.Lock()
	containers := append([]di.Container(nil), captured...)
	calls := closeCalls
	mutex.Unlock()

	if len(containers) != 1 {
		t.Fatalf("captured %d containers, want 1", len(containers))
	}
	if !containers[0].IsClosed() {
		t.Fatal("the request container is still OPEN after a recovered panic — moving recover outside the DI middleware means the panic now unwinds THROUGH the DI middleware's frame, and its release must still run on that path")
	}
	if calls != 1 {
		t.Fatalf("Close ran %d times, want exactly 1", calls)
	}

	// The parent must retain nothing: with any child present, Delete only sets
	// deleteIfNoChild and returns nil without closing. So "closes on its first
	// Delete" IS "the children map is empty".
	if err := appContainer.Delete(); err != nil {
		t.Fatalf("delete app container: %v", err)
	}
	if !appContainer.IsClosed() {
		t.Fatal("the app container still retains the request sub-container after a recovered panic — that is the leak")
	}
}

// TestNormalRequestIsUnaffectedByTheOrder is the boring control: the reordering
// must not break the ordinary path. Without it, a mountMiddlewares that somehow
// short-circuited everything would still pass both panic tests above.
func TestNormalRequestIsUnaffectedByTheOrder(t *testing.T) {
	builder, err := di.NewBuilder()
	if err != nil {
		t.Fatalf("di builder: %v", err)
	}
	appContainer := builder.Build()
	t.Cleanup(func() {
		if !appContainer.IsClosed() {
			_ = appContainer.DeleteWithSubContainers()
		}
	})

	reachedHandler := false
	app := fiber.New()
	NewServer(new(config.Config)).mountMiddlewares(app, appContainer)
	app.Get("/api/v1/items", func(c *fiber.Ctx) error {
		// The container must be resolvable from the locals, i.e. the DI
		// middleware still runs before the routes.
		if pkgCtx.GetDiContainerRequestFromFiberCtx(c).IsClosed() {
			return fiber.NewError(http.StatusInternalServerError, "container closed inside the handler")
		}
		reachedHandler = true
		return c.SendStatus(http.StatusOK)
	})

	response, err := app.Test(httptest.NewRequest(http.MethodGet, "/api/v1/items", nil))
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer func() { _ = response.Body.Close() }()

	if response.StatusCode != http.StatusOK {
		t.Fatalf("an ordinary request answered %d, want 200", response.StatusCode)
	}
	if !reachedHandler {
		t.Fatal("the handler never ran")
	}
}
