# Makefile for tomatime

run:
	go run cmd/main.go

build:
	go build -o bin/tomatime cmd/main.go

migrate-up:
	go run db/migrate.go $(DB) up

migrate-down:
	go run db/migrate.go $(DB) down

migrate-reset:
	go run db/migrate.go $(DB) reset

web:
	cd ui && npm run dev

# Build the Vite/React UI and place it where internal/ui embeds it (dist/).
# The built assets are gitignored; only the placeholder index.html is committed
# so a fresh checkout still satisfies the go:embed directive.
build-web:
	cd ui && npm install && npm run build
	rm -rf ./internal/ui/dist/assets
	cp -R ./ui/dist/. ./internal/ui/dist/
	rm -rf ./ui/dist
