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

# Build the Vite/React UI and place it where internal/web embeds it (dist/).
# The built assets are gitignored; only the placeholder .gitkeep is committed so
# a fresh checkout still satisfies the go:embed directive.
build-web:
	cd ui && npm install && npm run build
	rm -rf ./internal/web/dist
	mv ./ui/dist ./internal/web/dist
	touch ./internal/web/dist/.gitkeep
