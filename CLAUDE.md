# WhereTF — Development Directives

## Claude project notes
- Keep this file under 150 lines.
- Prefer higher level CLAUDE.md files for generalized instructions

## Folder structure
- Specifications belong in `specification/`

## Stack

Next.js (App Router) + React, PostgreSQL, Tailwind v4. Storage grid rendered as SVG within React components; DOM overlays for tooltips and detail panels. Multi-user, multi-tenant (users belong to orgs). AI integration (OpenAI) deferred — build core storage and item management first.

## Dev Commands

From `web/`:
- `npm run dev` — next dev (requires local PostgreSQL)
- `npm test` — Vitest unit and integration tests
- `npm run test:watch` — Vitest in watch mode
- `npm run db:migrate` — run Drizzle migrations
- `npm run db:generate` — generate migration from schema changes
- `npm run db:studio` — Drizzle Studio (database browser)

## Testing

TDD for data model and repository layers. Tests run against a real PostgreSQL database with per-test transaction rollback — no mocks, no in-memory fakes.

- **Unit tests** — repository functions, domain logic, path utilities
- **Integration tests** — API routes, multi-step operations (insert placement, assignment resolution)
- **Component tests** — React Testing Library + Vitest, test behavior not rendering

## Architecture

Three-layer data access — no exceptions:

- **Schema** (`web/db/schema/`) — Drizzle schema definitions, no business logic
- **Repository** (`web/repositories/`) — All business logic, validation, org-scoped queries
- **API route** (`web/app/api/`) — Thin: parse request, check auth, call repository, format response

## Repository Conventions

- All methods take a single destructured object: `create({ userId, name, location })`
- Storage and assignment queries scope by `orgId` — no unscoped queries. Items are global.
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

**New model:** Drizzle schema in `web/db/schema/` → generate migration → repository in `web/repositories/` → API routes in `web/app/api/` → tests first

## Specification

- [specification/project-intent.md](specification/project-intent.md) — what WhereTF is, interaction model, domain concepts
- [specification/storage-model.md](specification/storage-model.md) — storage data model (modules, templates, inserts, overrides, paths)
- [specification/deployment.md](specification/deployment.md) — CI/CD pipeline and deployment
- [specification/storage-navigator-design.md](specification/storage-navigator-design.md) — grid visualization UI/UX spec
