package constants

import "time"

// Transport-level limits for the Fiber server. fasthttp applies NO timeouts by
// default, so without these every one of them is effectively infinite: a client
// that opens a connection and dribbles one header byte per minute holds a
// connection and its handler goroutine for as long as it likes, at a cost to the
// attacker of one socket. These are the cheapest possible bound on that.
//
// The numbers are picked for what this service actually serves — small JSON DTOs
// and an embedded SPA shell, no uploads, no streaming, no long-polling. Anything
// legitimate finishes in milliseconds, so these are three orders of magnitude of
// headroom, not a tuning knob.
const (
	// RequestReadTimeout bounds reading the request line, headers AND body. This
	// is the slowloris bound. 15s is far more than a few hundred bytes of JSON
	// needs even on a bad mobile connection.
	//
	// ⚠️ It bounds the whole read, so it is also the ceiling on how long a large
	// upload may take. If this service ever accepts file uploads, this value has
	// to be reconsidered alongside RequestBodyLimitBytes — do not raise one
	// without the other.
	RequestReadTimeout = 15 * time.Second

	// RequestWriteTimeout bounds writing the response — the defence against a
	// client that opens a request and then reads the answer one byte at a time.
	// The largest response is the SPA shell plus its JSON; 15s is ample.
	//
	// ⚠️ This is a hard ceiling on response duration, so it would have to change
	// before adding any streaming or server-sent-events endpoint.
	RequestWriteTimeout = 15 * time.Second

	// RequestIdleTimeout bounds how long an idle keep-alive connection is kept.
	// Browsers hold keep-alive sockets open after a page load, so this cannot be
	// aggressive without forcing reconnects; 60s is the usual middle ground and
	// still reclaims connections from clients that simply vanish.
	RequestIdleTimeout = 60 * time.Second

	// RequestBodyLimitBytes is the largest request body accepted. Fiber's own
	// default is 4 MiB; this is deliberately tighter because the largest
	// legitimate body this API takes is a CreateRequest/UpdateRequest — a name and
	// a description, a few hundred bytes. 1 MiB leaves roughly three orders of
	// magnitude of headroom while quartering the memory a single unauthenticated
	// request can pin.
	//
	// Stated as a constant rather than left to the framework so that it is
	// greppable from Go: the number a client has to size against must not be
	// "whatever fiber defaults to this release".
	RequestBodyLimitBytes = 1 * 1024 * 1024
)

// Rate-limit defaults for the /api/v1 group.
const (
	// DefaultRateLimitMax is the request budget per client address per window.
	// The limiter is mounted on the API group only, so page loads, /assets and
	// the SPA catch-all do not spend it — this is a bound on API calls alone, and
	// 60/minute is well above what a person driving the UI generates.
	//
	// ⚠️ Fiber's limiter counts responses of ANY status, including 4xx
	// (SkipFailedRequests defaults to false). A client looping a request the
	// handler rejects early still burns its budget, which is intended here.
	DefaultRateLimitMax = 60

	// DefaultRateLimitWindow is the fixed window the budget refills over.
	DefaultRateLimitWindow = time.Minute
)
