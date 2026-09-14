package middlewares

import (
	"io/fs"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"

	pkgCtx "github.com/vukyn/kuery/ctx"
	pkgRecover "github.com/vukyn/kuery/recover"

	"github.com/gofiber/fiber/v2"
	"github.com/sarulabs/di/v2"
)

// ─────────────────────────────────────────────────────────────────────────────
// Part 1 — the runtime property: the container is released exactly once, on
// every way a request can end.
// ─────────────────────────────────────────────────────────────────────────────

// releaseProbeName is the DI definition the lifetime tests resolve on every
// request. Its only job is to own a Close function, because a Close COUNTER is the
// only way a test can see a DOUBLE release: sarulabs/di's second Delete on an
// already-closed container returns nil and changes no observable state — it just
// runs every registered Close a second time. tomatime's real Close funcs are all
// debug log lines, so a leftover `defer ctn.Delete()` in a handler is invisible to
// an error check and invisible to IsClosed(), and visible only here.
const releaseProbeName = "release-probe"

// releaseHarnessOptions configures the harness.
//
//   - skipResolve mounts the probe middleware WITHOUT building the probe object,
//     which is the "request that resolves nothing at all" case — /assets,
//     /tomatime.svg and the SPA catch-all never touch the container.
//   - recoverOutsideDi mounts pkgRecover OUTSIDE (before) DiContainerMiddleware
//     instead of inside it. Both orders are exercised because the release is a
//     `defer`, and a defer runs both on a normal return AND while a panic unwinds
//     — so the container lifetime must not depend on where recover sits. That
//     independence is what lets internal/server choose the recover position on
//     other grounds (catching a panic raised by the DI middleware itself).
type releaseHarnessOptions struct {
	skipResolve      bool
	recoverOutsideDi bool
}

// releaseHarness mounts the real DiContainerMiddleware in front of one route per
// way a request can end. It records every request's sub-container plus how many
// times a Close ran, so both halves of "released exactly once" are assertable.
//
// The mutex is not decoration: app.Test serves each request on another goroutine,
// so the probe middleware and the Close callback both write from there while the
// test reads from here.
type releaseHarness struct {
	app          *fiber.App
	appContainer di.Container

	mutex      sync.Mutex
	containers []di.Container
	closeCalls int
}

func newReleaseHarness(t *testing.T, options releaseHarnessOptions) *releaseHarness {
	t.Helper()

	harness := &releaseHarness{containers: make([]di.Container, 0, 8)}

	builder, err := di.NewBuilder()
	if err != nil {
		t.Fatalf("di builder: %v", err)
	}
	if err := builder.Add(di.Def{
		Name:  releaseProbeName,
		Scope: di.Request,
		Build: func(ctn di.Container) (any, error) { return new(int), nil },
		Close: func(obj any) error {
			harness.mutex.Lock()
			defer harness.mutex.Unlock()
			harness.closeCalls++
			return nil
		},
	}); err != nil {
		t.Fatalf("add release probe definition: %v", err)
	}
	harness.appContainer = builder.Build()
	t.Cleanup(func() {
		// Only if an assertion did not already close it — a second delete would run
		// the probe Closes again and make the counter lie for any later reader.
		if !harness.appContainer.IsClosed() {
			_ = harness.appContainer.DeleteWithSubContainers()
		}
	})

	app := fiber.New()
	if options.recoverOutsideDi {
		app.Use(pkgRecover.NewFiberRecover())
		app.Use(DiContainerMiddleware(harness.appContainer))
	} else {
		app.Use(DiContainerMiddleware(harness.appContainer))
		app.Use(pkgRecover.NewFiberRecover())
	}
	app.Use(func(c *fiber.Ctx) error {
		container := pkgCtx.GetDiContainerRequestFromFiberCtx(c)
		harness.mutex.Lock()
		harness.containers = append(harness.containers, container)
		harness.mutex.Unlock()
		if !options.skipResolve {
			// Build the probe INSIDE this container so a Close is registered against
			// it — di only closes objects it actually built.
			if _, err := container.SafeGet(releaseProbeName); err != nil {
				return err
			}
		}
		return c.Next()
	})

	// One route per ending. Registration order is match order in Fiber, so the SPA
	// catch-all stays last. Nothing is registered for POST, which is how the
	// no-handler case below short-circuits inside the router.
	app.Get("/api/v1/items", func(c *fiber.Ctx) error { return c.SendStatus(http.StatusOK) })
	app.Get("/error", func(c *fiber.Ctx) error { return fiber.NewError(http.StatusTeapot, "handler failed") })
	app.Get("/panic", func(c *fiber.Ctx) error { panic("handler exploded") })
	app.Get("/*", func(c *fiber.Ctx) error { return c.SendString("spa") })

	harness.app = app
	return harness
}

// requireStatus performs one request and fails unless the status matches, so a
// subtest proves it exercised the path it claims to (an unexpected 200 from the
// 404 probe would otherwise silently turn a short-circuit test into a handler
// test).
func (h *releaseHarness) requireStatus(t *testing.T, method, path string, want int) {
	t.Helper()
	response, err := h.app.Test(httptest.NewRequest(method, path, nil))
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode != want {
		t.Fatalf("%s %s = %d, want %d", method, path, response.StatusCode, want)
	}
}

// assertReleased is the whole property, in two halves. Every container the
// middleware created must be CLOSED (no leak), and Close must have run EXACTLY
// wantCloses times (no double release). wantCloses is normally the request count;
// it is 0 for the skipResolve harness, where nothing was ever built to close.
func (h *releaseHarness) assertReleased(t *testing.T, wantRequests, wantCloses int) {
	t.Helper()
	h.mutex.Lock()
	containers := slices.Clone(h.containers)
	closeCalls := h.closeCalls
	h.mutex.Unlock()

	if len(containers) != wantRequests {
		t.Fatalf("captured %d request containers, want %d", len(containers), wantRequests)
	}
	for index, container := range containers {
		if !container.IsClosed() {
			t.Fatalf("request %d's container is still OPEN: DiContainerMiddleware created it and must release it on every path, including the ones that never reach a handler", index)
		}
	}
	if closeCalls != wantCloses {
		t.Fatalf("Close ran %d times for %d requests, want %d — more than one per request means the container is being deleted twice (a leftover `defer ctn.Delete()` in a handler: di's second Delete returns nil but re-runs every Close)",
			closeCalls, wantRequests, wantCloses)
	}
}

// assertNoRetainedChildren proves the parent retains ZERO request sub-containers —
// the leak itself rather than a proxy for it, and without reflection.
//
// sarulabs/di does not export the children map, but Delete() reads it
// (containerSlayer.go): with any child present it does NOT close the container, it
// only sets deleteIfNoChild and returns nil. So "the app container closes on its
// first Delete" IS "its children map is empty". Destroys the app container, so this
// is the last thing a subtest does.
func (h *releaseHarness) assertNoRetainedChildren(t *testing.T) {
	t.Helper()
	if err := h.appContainer.Delete(); err != nil {
		t.Fatalf("delete app container: %v", err)
	}
	if !h.appContainer.IsClosed() {
		t.Fatal("the app container did NOT close on its first Delete, so it still retains request sub-containers — that is the leak: sarulabs/di holds every sub-container in its parent's children map until it is deleted, so each leaked one is retained for the life of the process")
	}
}

// TestDiContainerMiddlewareReleasesRequestContainer covers the ownership rule that
// replaced the item handlers' five `defer ctn.Delete()` calls: the middleware that
// CREATES the request sub-container releases it, on every path.
//
// The leaking paths were the cheap unauthenticated ones anyone can issue for free —
// /assets, /tomatime.svg, a 404, every SPA render — so the leak needed no
// privileges to trigger and grew for the life of the process.
func TestDiContainerMiddlewareReleasesRequestContainer(t *testing.T) {
	t.Run("a request that reaches its handler", func(t *testing.T) {
		harness := newReleaseHarness(t, releaseHarnessOptions{})
		harness.requireStatus(t, http.MethodGet, "/api/v1/items", http.StatusOK)
		harness.assertReleased(t, 1, 1)
		harness.assertNoRetainedChildren(t)
	})

	t.Run("a handler that returns an error", func(t *testing.T) {
		harness := newReleaseHarness(t, releaseHarnessOptions{})
		harness.requireStatus(t, http.MethodGet, "/error", http.StatusTeapot)
		harness.assertReleased(t, 1, 1)
		harness.assertNoRetainedChildren(t)
	})

	// The SPA catch-all: a handler that never touches the container at all. This
	// was the single biggest leaking path — every deep link a browser opens.
	t.Run("the SPA catch-all, whose handler never touches the container", func(t *testing.T) {
		harness := newReleaseHarness(t, releaseHarnessOptions{})
		harness.requireStatus(t, http.MethodGet, "/timer/settings", http.StatusOK)
		harness.assertReleased(t, 1, 1)
		harness.assertNoRetainedChildren(t)
	})

	// A request that matches NO handler: this middleware is mounted globally, ahead
	// of the routes, so it has already built a container by the time Fiber decides
	// there is nothing to run.
	//
	// The status is 405, not 404, and deliberately so: registering `GET /*` gives
	// EVERY path a GET route, so Fiber reports method-not-allowed rather than
	// not-found for any other verb — and a plain 404 is unreachable, in this
	// harness and in the real server, for exactly the same reason. Asserting 404
	// here would be asserting something the app never produces.
	t.Run("a 405 that matches no handler at all", func(t *testing.T) {
		harness := newReleaseHarness(t, releaseHarnessOptions{})
		harness.requireStatus(t, http.MethodPost, "/api/v1/nothing-here", http.StatusMethodNotAllowed)
		harness.assertReleased(t, 1, 1)
		harness.assertNoRetainedChildren(t)
	})

	// The /assets and /tomatime.svg shape: the middleware still builds a container
	// and nothing resolves anything from it. Nothing to Close, but the container
	// itself must still go.
	t.Run("a request that resolves nothing at all", func(t *testing.T) {
		harness := newReleaseHarness(t, releaseHarnessOptions{skipResolve: true})
		harness.requireStatus(t, http.MethodGet, "/assets/index-abc123.js", http.StatusOK)
		harness.assertReleased(t, 1, 0)
		harness.assertNoRetainedChildren(t)
	})

	// A defer runs while a panic unwinds, so this SHOULD hold — but "should" is the
	// reason to test it, and to test it under BOTH mount orders. If the release
	// were ever turned into a plain call after c.Next(), the recover-inside order
	// would still look green (recover converts the panic to a normal return before
	// this frame unwinds) while the recover-outside order leaked. Pinning both
	// makes the release provably independent of the recover position, which is what
	// lets internal/server pick that position for its own reasons.
	for _, order := range []struct {
		name             string
		recoverOutsideDi bool
	}{
		{"recover mounted inside the di middleware", false},
		{"recover mounted outside the di middleware", true},
	} {
		t.Run("a panic recovered with "+order.name, func(t *testing.T) {
			harness := newReleaseHarness(t, releaseHarnessOptions{recoverOutsideDi: order.recoverOutsideDi})
			harness.requireStatus(t, http.MethodGet, "/panic", http.StatusInternalServerError)
			harness.assertReleased(t, 1, 1)
			harness.assertNoRetainedChildren(t)
		})
	}

	// The regression test for the leak as it was: a flood of the cheapest possible
	// request — unauthenticated, no DB work — used to retain one sub-container
	// each, permanently, because no handler defer covered the SPA catch-all.
	t.Run("a flood of catch-all requests retains nothing", func(t *testing.T) {
		const requests = 500
		harness := newReleaseHarness(t, releaseHarnessOptions{})
		for range requests {
			harness.requireStatus(t, http.MethodGet, "/deep/link", http.StatusOK)
		}
		harness.assertReleased(t, requests, requests)
		harness.assertNoRetainedChildren(t)
	})

	// Every ending mixed in one process, which is the only shape that would catch a
	// release that works per-path but is somehow order-dependent.
	t.Run("every path in one process", func(t *testing.T) {
		harness := newReleaseHarness(t, releaseHarnessOptions{})

		requests := []struct {
			method string
			path   string
			want   int
		}{
			{http.MethodGet, "/api/v1/items", http.StatusOK},
			{http.MethodGet, "/error", http.StatusTeapot},
			{http.MethodGet, "/panic", http.StatusInternalServerError},
			{http.MethodPost, "/api/v1/nothing-here", http.StatusMethodNotAllowed},
			{http.MethodGet, "/spa/route", http.StatusOK},
		}
		for _, request := range requests {
			harness.requireStatus(t, request.method, request.path, request.want)
		}

		harness.assertReleased(t, len(requests), len(requests))
		harness.assertNoRetainedChildren(t)
	})
}

// ─────────────────────────────────────────────────────────────────────────────
// Part 2 — the static property: nothing but the creator releases a container.
// ─────────────────────────────────────────────────────────────────────────────

// ⚠️ KNOWN GAP, stated so nobody reads more into the suite than it proves:
// nothing here distinguishes DeleteWithSubContainers from a plain Delete.
// Delete only degrades when the container HAS a child, and a tomatime request
// container never does — no handler calls SubContainer on it. Swapping the
// middleware to request.Delete() therefore leaves every test above green
// (verified). DeleteWithSubContainers stays because it is the unconditional
// release the ownership rule needs, and it becomes load-bearing the moment
// anything nests a sub-container; it is a rule this suite cannot enforce, not a
// rule it enforces silently.

// ownershipScanRoot is the tree this invariant scans: everything under internal/,
// reached relative to this package's directory.
const ownershipScanRoot = ".."

// ownershipMinScannedFiles guards against a path typo making the walk vacuous —
// the one way this test could pass while proving nothing. tomatime has ~23
// scannable files under internal/ and only grows, so this floor is deliberately
// low; raise it if you like, but never let it reach zero.
const ownershipMinScannedFiles = 15

// ownershipAllowedFiles are the files permitted to release a di container: whoever
// CREATES a sub-container owns it.
//
//   - middlewares/middleware.go — DiContainerMiddleware creates the request
//     sub-container and releases it with its own defer.
//
// Add an entry ONLY for another genuine creator, with a comment saying why. A
// startup one-off that opens its own sub-container outside any request qualifies
// (an idempotent seed bootstrap in internal/app is the usual example). A handler
// never does: it only borrows the container from the Fiber locals.
//
// cmd/main.go's shutdown teardown of the APP container is outside internal/, so it
// is not scanned and needs no entry.
var ownershipAllowedFiles = map[string]bool{
	filepath.Join("middlewares", "middleware.go"): true,
}

// forbiddenReleaseCalls are the ways a borrower could release a container it does
// not own. `ctn` is the name handlers bind the request container to.
var forbiddenReleaseCalls = []string{
	"ctn.Delete()",
	"ctn.DeleteWithSubContainers()",
}

// TestNoHandlerReleasesRequestContainer pins the container-ownership rule
// STATICALLY, because the runtime test above structurally cannot see a violation
// in a real handler: that test mounts stub routes, so a `defer ctn.Delete()` living
// in internal/domains/item/handlers/http never executes inside it and the
// "Close ran exactly once" assertion still passes.
//
// A handler that releases a container it does not own is invisible every other way
// too. The compiler is happy — `ctn` is in scope and used. sarulabs/di's second
// Delete returns nil, so there is no error. The only runtime symptom is every
// registered Close running twice, and the Request-scoped Close hooks here are debug
// log lines.
func TestNoHandlerReleasesRequestContainer(t *testing.T) {
	root, err := filepath.Abs(ownershipScanRoot)
	if err != nil {
		t.Fatalf("resolve scan root: %v", err)
	}

	scanned := 0
	violations := make([]string, 0)

	err = filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return nil
		}
		if !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}

		relative, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		if ownershipAllowedFiles[relative] {
			return nil
		}

		content, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		scanned++

		for number, line := range strings.Split(string(content), "\n") {
			trimmed := strings.TrimSpace(line)
			if strings.HasPrefix(trimmed, "//") {
				// A comment may legitimately quote the forbidden call while
				// explaining the rule.
				continue
			}
			for _, call := range forbiddenReleaseCalls {
				if strings.Contains(trimmed, call) {
					violations = append(violations, relative+":"+strconv.Itoa(number+1)+": "+trimmed)
				}
			}
		}
		return nil
	})
	if err != nil {
		t.Fatalf("walk %s: %v", root, err)
	}

	if scanned < ownershipMinScannedFiles {
		t.Fatalf("scanned only %d .go files under %s, want at least %d — the invariant is not actually looking at the codebase", scanned, root, ownershipMinScannedFiles)
	}

	if len(violations) > 0 {
		t.Fatalf("%d file(s) release a di container they do not own:\n\t%s\n\nDiContainerMiddleware creates the request sub-container and releases it on every path; a handler only borrows it. A second Delete returns nil but re-runs every registered Close, so this is invisible at runtime — remove the call.",
			len(violations), strings.Join(violations, "\n\t"))
	}
}
