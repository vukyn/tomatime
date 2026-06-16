# Frontend `ui/src` Structure (all services)

Feature + layer organization, React 19 + TypeScript + Vite + Chakra UI v3 + Zod.

```
src/
├── apis/          # API client functions — one file per domain, pure HTTP via apiClient (utils/axios), typed with @/types, URLs from API_ENDPOINTS; no business logic/state
├── assets/        # static files
├── components/    # feature components (e.g. ProtectedRoute.tsx) at root
│   └── ui/        # Chakra wrappers: "use client", forwardRef, extend Chakra props, named exports
├── consts/        # constants: `as const` objects, UPPER_SNAKE_CASE (endpoints.ts, values.ts)
├── hooks/         # custom hooks, use* naming, return object with values + functions, handle loading/error state
├── pages/         # one file per route; self-contained state, compose components, use hooks for logic, validate via @/validators
├── theme/         # index.ts: createSystem(defaultConfig, defineConfig({...})) — semantic tokens, light/dark, brand palette
├── types/         # interfaces per domain (auth.ts, user.ts, base.ts); names indicate Request/Response
├── utils/         # pure non-React helpers (axios.ts with interceptors + token management, cookies.ts, config.ts, time.ts)
├── validators/    # Zod schemas in index.ts; export schema + z.infer type; reuse common schemas (passwordSchema)
├── App.tsx        # all routes here; ProtectedRoute for authed routes; Navigate for redirects
└── main.tsx       # StrictMode + Provider + Toaster; keep minimal
```

## Rules

- **Path alias**: `@/` → `src/`. All internal imports use `@/`.
- **Barrel exports**: every folder has `index.ts` (`@/types`, `@/apis`, `@/utils`, `@/consts`, `@/validators`).
- **Import order**: 1) React + third-party, 2) internal `@/` imports.
- **Naming**: components PascalCase files; hooks `useX.ts`; utils/types/consts camelCase files. Variables/functions camelCase, constants UPPER_SNAKE_CASE, types/interfaces PascalCase. Named exports everywhere (no default except App).
- **"use client"** directive on components using hooks/browser APIs.
- Auth tokens stored in cookies (`utils/cookies.ts`); axios interceptors handle refresh.
- Prefer Chakra theming over CSS files; `index.css`/`App.css` minimal.

Chakra v3 syntax rules: see [chakra-v3.md](chakra-v3.md).
