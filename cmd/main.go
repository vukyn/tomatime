package main

import (
	"context"
	"time"

	"github.com/vukyn/tomatime/internal/app"
	"github.com/vukyn/tomatime/internal/server"

	"github.com/vukyn/kuery/graceful"
	"github.com/vukyn/kuery/log"
)

func init() {
	app.Init()
}

func main() {
	// start server
	server := server.NewServer(app.Config)
	server.Start()

	// graceful shutdown
	shutdown := func(ctx context.Context) error {
		log.New().Info("Shutting down server")
		if err := server.Stop(); err != nil {
			log.New().Errorf("Failed to stop server: %v", err)
			return err
		}
		log.New().Debug("Server stopped")

		if err := app.App.DeleteWithSubContainers(); err != nil {
			log.New().Errorf("Failed to delete app: %v", err)
			return err
		}
		log.New().Debug("App deleted")
		return nil
	}

	// The returned error is deliberately discarded, and the assignment is explicit
	// so that is visibly a decision rather than an oversight (gosec G104). The only
	// error this can return wraps the shutdown callback's, and the callback above
	// already logs every failure it returns — handling it here would just log the
	// same thing twice, at a point where the process is exiting regardless.
	_ = graceful.ShutdownWithCallback(
		shutdown,
		&graceful.ShutdownOptions{
			Signals:   graceful.DefaultSignals,
			Verbose:   app.Config.Graceful.Verbose,
			StepDelay: time.Duration(app.Config.Graceful.StepDelay) * time.Millisecond,
			Timeout:   time.Duration(app.Config.Graceful.ServerShutdownTimeout) * time.Millisecond,
			Logger:    log.New(),
		},
	) // ---> blocks here until a shutdown signal arrives
}
