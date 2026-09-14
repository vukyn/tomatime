package config

import (
	"github.com/joho/godotenv"
	"github.com/kelseyhightower/envconfig"
)

type Config struct {
	App struct {
		Name string `envconfig:"APP_NAME"`
		Port int    `envconfig:"APP_PORT"`
		Env  string `envconfig:"APP_ENV"`
		// ProxyHeader names the header carrying the real client address when the
		// service runs behind a proxy (a load balancer, fly-proxy, a CDN). It is
		// what c.IP() reads, and therefore what the rate limiter buckets on.
		//
		// Empty is the correct default here: tomatime's Go service has no deploy
		// target today, so there is no proxy in front and the socket address IS
		// the client address. Hard-coding a provider's header would be worse than
		// leaving it unset — see the note in internal/server on why this must
		// never be guessed.
		ProxyHeader string `envconfig:"APP_PROXY_HEADER"`
	}
	Logger struct {
		Mode  string `envconfig:"LOGGER_MODE"`
		Level string `envconfig:"LOGGER_LEVEL"`
	}
	Graceful struct {
		Verbose               bool `envconfig:"GRACEFUL_VERBOSE"`
		StepDelay             int  `envconfig:"GRACEFUL_STEP_DELAY"`
		ServerShutdownTimeout int  `envconfig:"GRACEFUL_SERVER_SHUTDOWN_TIMEOUT"`
	}
	// CORS holds the browser origins allowed to call the API, as a comma-separated
	// list. ⚠️ Left empty the server falls back to the local development origins,
	// never to a wildcard — fiber's cors middleware treats an empty AllowOrigins as
	// unset and substitutes "*", so an unset variable must be intercepted before it
	// reaches fiber. See internal/server.corsAllowOrigins.
	CORS struct {
		AllowOrigins string `envconfig:"CORS_ALLOW_ORIGINS"`
	}
	// RateLimit bounds how many API requests one client address may make per
	// window. ⚠️ Zero means "use the default", never "disabled" — and the default
	// is resolved in internal/server rather than handed to fiber, because fiber's
	// limiter silently substitutes its own Max of 5 for any non-positive value,
	// which would look like a working limiter while being ~12x tighter than
	// intended.
	RateLimit struct {
		Max           int `envconfig:"RATE_LIMIT_MAX"`
		WindowSeconds int `envconfig:"RATE_LIMIT_WINDOW_SECONDS"`
	}
}

func LoadConfig(envFiles ...string) (*Config, error) {
	// .env is optional — absent in deploy (fly.io etc.) where config is supplied
	// via real environment variables. A missing file is not fatal; envconfig reads
	// the OS environment below regardless.
	_ = godotenv.Load(envFiles...)

	cfg := new(Config)
	if err := envconfig.Process("", cfg); err != nil {
		return nil, err
	}

	return cfg, nil
}
