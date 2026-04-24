# WhereTF — Development Directives

## Claude project notes
- Keep this file under 150 lines.
- Prefer higher level CLAUDE.md files for generalized instructions

## Folder structure
- Specifications belong in `specification/`

## Stack

Next.js (App Router) + React, PostgreSQL, Tailwind v4. Storage grid rendered as SVG within React components; DOM overlays for tooltips and detail panels. Single-user for initial implementation. Designed for future multi-user, multi-tenant (users belong to orgs). AI integration (OpenAI) deferred — build core storage and item management first.

## Dev Commands

Dev DB is always local Docker: `docker compose -f docker-compose.dev.yml up -d` from repo root. Never point dev at a remote Postgres. Connection string lives in `web/.env.local` (copy from `.env.local.example`).

From `web/`:
- `npm run dev` — next dev (requires local Postgres + `.env.local`)
- `npm test` — Vitest unit and integration tests
- `npm run test:watch` — Vitest in watch mode
- `npm run db:migrate` — Drizzle migrations (also seeds `default` org/user)
- `npm run db:seed` — sample taxonomy, items, templates, modules for UI work
- `npm run db:generate` — generate migration from schema changes
- `npm run db:studio` — Drizzle Studio (database browser)

Sign in at `/login` — **Dev users** panel has 4 one-click personas (admin, free, pro). Non-prod only.

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
- All user-data queries must scope by `userId` — no unscoped queries. Future: `orgId` scoping when multi-tenant is implemented; items will be global (shared across orgs).
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
- [specification/storage-navigator-design.md](specification/storage-navigator-design.md) — grid visualization UI/UX spec
- [specification/interface-type-management.md](specification/interface-type-management.md) — interface types: admin CRUD + template/receptacle integration
- [specification/location-tracker-ux-issues.md](specification/location-tracker-ux-issues.md) — living UX issue log for `/modules` + `/templates` + `/inserts`
- [specification/item-taxonomy.md](specification/item-taxonomy.md) — conceptual: categories, parameters, aspects
- [specification/item-parametric-model.md](specification/item-parametric-model.md) — parameters + standards + designations: schema, unit conversion
- [specification/taxonomy-management-design.md](specification/taxonomy-management-design.md) — `/taxonomy` admin UI spec
- [specification/taxonomy-synonyms.md](specification/taxonomy-synonyms.md) — aspect/parameter aliases (deferred)
- [specification/measure-family.md](specification/measure-family.md) — unit-aware value equivalence (deferred)
- [specification/item-management-design.md](specification/item-management-design.md) — `/items` design decisions
- [specification/item-graphics.md](specification/item-graphics.md) — per-item SVG wireframes (deferred)
- [specification/ui-paradigms.md](specification/ui-paradigms.md) — cross-cutting UI/UX rules
- [specification/ui-layout-patterns.md](specification/ui-layout-patterns.md) — shell + three-panel layout + design tokens
- [specification/user-menu.md](specification/user-menu.md) — sidebar account affordance + `/settings` structure
- [specification/auth-roadmap.md](specification/auth-roadmap.md) — auth, authz, multi-tenancy ordering
- [specification/deployment.md](specification/deployment.md) — CI/CD pipeline and deployment
- [specification/ai-agent-architecture.md](specification/ai-agent-architecture.md) — AI agent patterns (deferred, reference only)
- [specification/ai-collaboration-notes.md](specification/ai-collaboration-notes.md) — notes on AI collaboration workflow (not a product spec)
