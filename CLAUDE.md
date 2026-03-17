# WhereTF

R&D workshop item tracker. Users model their physical storage layout, catalog items via AI-assisted natural language, and get help storing, finding, and organizing their stuff. Not inventory management — no quantities, BOMs, or stock transfers.

## Stack

Next.js (App Router) + React, MongoDB/Mongoose, OpenAI GPT-4o agents, Tailwind v4. Single-user for now.

## Interaction Model

GUI and AI each own different concerns:

- **Storage layout definition** — GUI-first. Users build module/level/grid structures visually. Templates (e.g. Plano Stowaway 3600) accelerate setup. Minimal AI involvement.
- **Item cataloging** — AI-first. User describes items in natural language, AI structures into canonical form with deduplication. Goal: build a valuable item identity DB where network effects improve matching over time.
- **Item assignment** — AI-first. User says where they're putting something, or asks for a suggestion. AI considers access frequency (tracked implicitly via search/retrieve actions) and storage accessibility.
- **Search** — AI-first. Natural language queries, results displayed as a list with corresponding locations highlighted in the storage GUI.
- **Housekeeping** — Bulk reorganization ("defrag"): combine like items, suggest discards, move frequently-used items to accessible locations.
- **ERP integration** — Items link to Odoo products (Charm implementation). WhereTF is the R&D complement, not a replacement for MRP/stock.

## Domain Concepts

- **Item** — what a thing *is*, independent of where it is. A type/category, not an instance or count. Described by name, description, and unlimited key/value/unit parameter tuples. Equivalent to a product in ERP. Parameters can repeat keys (e.g. a pipe reducer with two `thread_size` values).
- **Assignment** — connects an item to a location. Own entity, not a field on item or location. One assignment per location (strict), many assignments per item. Unassigned items and empty locations are both valid states.
- **Module** — a physical storage unit (cabinet, shelf, drawer unit). Defines valid location path structures.
- **Template** — reusable grid/dimension definition (e.g. Plano Stowaway 3600 = 4×6 grid). Applied to module levels.
- **Location path** — address like `MUSE:level-3:row-2:col-5`. Module names uppercase, dimension values lowercase.

## AI Agent Architecture

Router/specialist pattern. Router classifies intent, delegates to specialists via tool calls. Specialists have scoped tool access to repositories.

- **Router** → `runStorageAgent`, `runInventoryAgent` (delegates, never answers directly)
- **Specialists** execute tools → tool handlers → repositories → MongoDB
- Agent execution loop: call OpenAI → process tool calls → feed results back → repeat until text response
- Handler dispatch: handler string (e.g. `items.create`) → handlerMap → repository function
- All handlers receive `userId` for scoping

## Context Management

Sessions track conversation history. Token estimation at ~4 chars/token, ~1000 tokens/image. Context thresholds: 75% warning, 90% critical → suggest compression. Compression summarizes via GPT-4o-mini, archives old session, starts new one with summary as context.

## Architecture

Three-layer data access — no exceptions:

- **Schema** (`web/models/`) — Mongoose schemas only, no business logic
- **Repository** (`web/repositories/`) — All business logic, validation, user-scoped queries
- **API route** (`web/app/api/`) — Thin: parse request, check auth, call repository, format response

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
| Module names | UPPERCASE | `MUSE`, `FLUX`, `PRUSA` |
| Parameter keys | lowercase_underscore | `thread_size`, `voltage_rating` |

## Adding Things

**New model:** Schema in `web/models/` → repository in `web/repositories/` → API routes in `web/app/api/` → seed data if needed

**New tool:** Definition in `web/lib/seeds/tools.ts` → handler in `web/lib/toolHandlers.ts` → implement in repository → assign to agents

**New agent:** Definition in `web/lib/seeds/agents.ts` → add `runNewAgent` tool if router-callable → assign tools

## Specification Reference

- [specification/storage-model.md](specification/storage-model.md) — v2 storage data model (modules, templates, inserts, overrides, location paths)
- [web/docs/storage-navigator-design.md](web/docs/storage-navigator-design.md) — grid visualization UI/UX spec
