# WhereTF — Development Directives

## Stack

Next.js (App Router) + React, PostgreSQL, Tailwind v4. Storage grid rendered as SVG within React components; DOM overlays for tooltips and detail panels. Multi-user, multi-tenant (users belong to orgs). AI integration (OpenAI) deferred — build core storage and item management first.

## Dev Commands

From `web/`:
- `npm run dev:mem` — in-memory MongoDB + next dev
- `npm test` — Vitest (196 tests)
- `npm run exercise` — 22 handler-level scenarios (fast, free, deterministic)
- `npm run exercise:agent` — agent-level scenarios (requires OPENAI_API_KEY)
- `npm run exercise:captures` — replay downvoted user captures as regression tests

## Architecture

Three-layer data access — no exceptions:

- **Schema** (`web/models/`) — Mongoose schemas only, no business logic
- **Repository** (`web/repositories/`) — All business logic, validation, user-scoped queries
- **API route** (`web/app/api/`) — Thin: parse request, check auth, call repository, format response

Agent execution: handler string (e.g. `items.create`) → handlerMap in `web/lib/toolHandlers.ts` → repository function. All handlers receive `userId` for scoping.

## Repository Conventions

- All methods take a single destructured object: `create({ userId, name, location })`
- All user-data queries must scope by `userId` — no unscoped queries
- Repositories throw errors; API routes catch and return `{ error: "msg" }`

## API Response Shape

```
Success: { items: [...] } or { item: {...} }
Error:   { error: "Error message" }
```

## Naming

| Type | Convention | Example |
|------|-----------|---------|
| Components, models | PascalCase | `ChatContainer.tsx`, `Module.ts` |
| Utilities, functions, variables | camelCase | `agentRunner.ts`, `userId` |
| Constants | UPPER_SNAKE | `MAX_TOKENS` |
| Database fields | camelCase | `createdAt` |
| Module names (domain) | Short, not descriptive | `MUSE`, `FLUX`, `NEON` |
| Parameter keys (domain) | lowercase_underscore | `thread_size`, `voltage_rating` |

## Styling

Tailwind v4 with custom `accent` color (#ff6600 orange). Dark mode supported. Grid labeling: rows=alpha (A,B,C), cols=numeric (1,2,3), origin=top-left.

## Adding Things

**New model:** Schema in `web/models/` → repository in `web/repositories/` → API routes in `web/app/api/` → seed data if needed

**New tool:** Definition in `web/lib/seeds/tools.ts` → handler in `web/lib/toolHandlers.ts` → implement in repository → assign to agents

**New agent:** Definition in `web/lib/seeds/agents.ts` → add `runNewAgent` tool if router-callable → assign tools

## Specification

- [specification/project-intent.md](specification/project-intent.md) — what WhereTF is, interaction model, domain concepts
- [specification/storage-model.md](specification/storage-model.md) — storage data model (modules, templates, inserts, overrides, paths)
- [web/docs/storage-navigator-design.md](web/docs/storage-navigator-design.md) — grid visualization UI/UX spec
