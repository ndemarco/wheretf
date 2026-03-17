# AI Agent Architecture (Deferred — Reference Specification)

This documents the agent architecture developed in the v1 codebase. AI integration is deferred for the initial rebuild, but the patterns here inform future implementation.

## Router-Specialist Pattern

A lightweight router agent classifies user intent and delegates to domain specialists:

- **Router** (gpt-4o-mini) — intent classification only, no direct data access. Forces tool calls for every message (except greetings). Cheap.
- **Storage Specialist** (gpt-4o) — manages templates, modules, inserts, storage structure
- **Inventory Specialist** (gpt-4o) — manages items, assignments, location queries

The router has only two tools: `runStorageAgent` and `runInventoryAgent`. Each takes a `task` string. For compound requests ("create MUSE with 11 levels and put resistors in level 5"), the router breaks into separate specialist calls with accumulated context.

## Tool Definition Structure

Tools are the interface between agents and business logic:

```
name:        "createItem"
description: "Create a new item in the inventory"
category:    "items"
handler:     "items.create"        ← dispatch key
parameters:  [{ name, type, description, required, enum? }]
```

Handler string format determines dispatch:
- `agents.runStorage` — delegate to specialist (recursive agent execution)
- `items.create` — direct handler lookup in registry

Tools are formatted for OpenAI's function-calling API at runtime.

## Handler Dispatch

Centralized handler registry maps handler strings to functions:

```
handlerMap = {
  'templates.create': templateHandlers.create,
  'modules.list':     moduleHandlers.list,
  'items.merge':      itemHandlers.merge,
  'assignments.assign': assignmentHandlers.assign,
  // ~30+ handlers
}
```

All handlers follow a consistent signature:
- Arguments object (tool parameters) + userId
- Return result object on success, `{ error: "msg" }` on failure
- Errors thrown in repositories are caught and returned gracefully — the LLM can reason about failures and retry

## Agent Execution Loop

1. Format tools for this agent into OpenAI schema
2. Build message array from system prompt, history, and current message
3. If specialist (not router): set `tool_choice: 'required'` to prevent hallucinated answers
4. Call OpenAI
5. **Tool iteration** (max 10 rounds):
   - For each tool call in response:
     - If `agents.*` handler → recursively execute specialist agent
     - Otherwise → look up and execute handler
   - Push results back as tool messages
   - Continue until LLM produces a text response (no more tool calls)
6. Post-process: strip filler phrases ("Feel free to ask", "Let me know if...")
7. Return content + agent name + optional tool call audit trail

## Patterns Worth Preserving

### Name-to-ID Resolution
AI passes names ("MUSE") not database IDs. Handlers resolve automatically — accept either, look up by name if not a valid ID.

### Path Normalization
Grid cells referenced in multiple formats ("A1", "A,1", "A 1"). Handler normalizes all to a canonical form.

### Multi-Level Path Inference
If AI provides a flat path like "MUSE level 3 cell A1", handler auto-splits into module path + insert-internal path.

### Atomic Multi-Step Operations
Operations like item merge (reassign all assignments from duplicates to keeper, delete duplicates) are atomic — no partial failures.

### Specialist Tracking
When router → specialist → response, the UI shows which specialist answered, not just "router."

### Caching
In-memory maps for tools and agents. Tools are global, agents are per-user. No TTL — session-scoped. Cleared between test scenarios via `clearAgentCaches()`.

## Reimplementation Notes

The architecture is database-agnostic. When reimplementing on PostgreSQL:
- Agent and tool definitions can be database tables or static configuration (static is simpler for a small agent count)
- Handler registry stays as code — no need to be database-driven
- Keep name-to-ID resolution and path normalization patterns
- Session/history storage moves to PostgreSQL with proper indexing
- Error handling model (throw in repo, catch in handler, return to LLM) carries over unchanged
