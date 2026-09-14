# Memory Index

- [gobuild platform-service UI embed](gobuild-platform-service-ui-embed.md) — preset now scaffolds internal/web go:embed standard + empty .gitkeep; smoke-build proven; git add -f caveat for gitkeep
- [di.Container is a struct, not an interface](di-container-is-a-struct-not-interface.md) — zero value nil-derefs in SubContainer(); decides recover-vs-DI mount order (the platform preset's stated reason is a non sequitur)
- [Mutate the wiring, not just the resolver](mutate-the-wiring-not-just-the-resolver.md) — every test set Max explicitly, so bypassing the resolver passed; only an UNSET config separates ours from fiber's default
- [Silent-write check needs a producer](silent-write-check-needs-a-producer.md) — `select created_by` proves nothing with no auth wired; a non-compiling wrong-import mutant is one `go mod tidy` from silent
