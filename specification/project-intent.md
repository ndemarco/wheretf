# WhereTF — Project Intent

R&D workshop item tracker. Users model their physical storage layout, catalog items, and get help storing, finding, and organizing their stuff. AI-assisted natural language cataloging is a feature layer, not the foundation — build core storage and item management first. Single-user for initial implementation. Designed for future multi-user, multi-tenant (users belong to orgs); item data will be global (shared across orgs) in the multi-tenant version. Not inventory management — no quantities, BOMs, or stock transfers.

## Interaction Model

GUI and AI each own different concerns:

- **Storage layout definition** — GUI-first. Users build module/level/grid structures visually. Templates (e.g. Plano Stowaway 3600) accelerate setup. Minimal AI involvement.
- **Item cataloging** — AI-first. User describes items in natural language, AI structures into canonical form with deduplication. Goal: build a valuable item identity DB where network effects improve matching over time.
- **Item assignment** — AI-first. User says where they're putting something, or asks for a suggestion. AI considers access frequency (tracked implicitly via search/retrieve actions) and storage accessibility.
- **Search** — AI-first. Natural language queries, results displayed as a list with corresponding locations highlighted in the storage GUI.
- **Housekeeping** — Bulk reorganization ("defrag"): combine like items, suggest discards, move frequently-used items to accessible locations.
- **ERP integration** — Items link to ERP products (e.g. Odoo). WhereTF is the R&D complement, not a replacement for MRP/stock.

## Domain Concepts

- **Item** — what a thing *is*, independent of where it is. A type/category, not an instance or count. Described by name, description, and unlimited key/value/unit parameter tuples. Equivalent to a product in ERP. Parameters can repeat keys (e.g. a pipe reducer with two thread_size values). Items belong to WhereTF globally — as items are refined and improved, they benefit all users. Storage and assignments are per-org; items are shared. Future: private items as a paid feature.
- **Assignment** — connects an item to a location. Own entity, not a field on item or location. Either *placed* (specific leaf location, one per location unless co-storable) or *provisional* (at a location, position undetermined). Many assignments per item. Unassigned items and empty locations are both valid states.
- **Module** — a top-level, independent physical storage unit (cabinet, shelf, drawer unit). Never nested. Defines valid location path structures.
- **Template** — versioned blueprint for a storage product's layout (e.g. Plano Stowaway 3600 = 4×6 grid). Applied via inserts (receptacle locations) or directly (fixed locations). Instances pin to an applied version.
- **Insert** — a distinct physical object that occupies a receptacle and provides its own internal locations. Relocatable as a unit.
- **Interface type** — named physical contract governing insert/receptacle compatibility. Strictly validated on placement.
- **Location path** — hierarchical address within a module. Module names are short identifiers, not descriptions. Descriptions belong in metadata.

## AI Agent Model

Router/specialist pattern. Router classifies intent, delegates to specialists. Specialists have scoped access to domain operations. The system loops tool calls until a text response is produced.

## Context Management

Sessions track conversation history with token estimation. Context thresholds trigger compression — summarize the conversation, archive it, and continue in a new session with the summary as context.

## What WhereTF Is Not

- Not inventory management (no quantities, BOMs, stock transfers)
- Not MRP (no purchase orders, suppliers, lead times)
- Not a catalog (items are user-defined, not sourced from a product database — though network effects may build one over time)
