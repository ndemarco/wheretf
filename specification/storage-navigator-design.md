# Storage Navigator — UI/UX Specification

## Overview

GUI-first visual interface for modeling, browsing, and managing physical storage. The grid is the primary interaction surface — not a secondary view driven by chat or search. Every mutation logs to a transaction log, enabling undo.

Three-pane shell with sidebar icon rail. Layout primitives + design
tokens live in [ui-layout-patterns.md](ui-layout-patterns.md);
cross-cutting interaction rules in [ui-paradigms.md](ui-paradigms.md).

---

## Cell Visual Vocabulary

Each cell encodes state through layered visual elements. The goal is at-a-glance recognition of occupancy, identity, and overrides.

**Border shape** (future category encoding): rectangle (default), rounded, other shapes reserved.

**Border color**: neutral = empty/uncategorized; category-mapped hue =
primary category; accent (#ff6600) = selection; red = disabled.

**Fill**:
- transparent — empty, available
- solid light — occupied (placed assignment)
- hatched/dotted — provisional assignment (item is here, position undetermined)
- diagonal stripes — disabled (reason on hover)

**Inner content**: category glyph/icon, truncated item name, co-storability split/stack when multiple items share the location, numbered search-result badge when active.

**Merged cells** — single SVG region spanning the merged positions. Non-rectangular merges (L-shapes) render as a compound path. The merged region uses the origin position's label.

**Divided cells** — internal subdivision lines with independently interactive children.

---

## Search Integration

Search results overlay the grid as numbered badges (1, 2, 3…) with
distinct colors per result. Non-result occupied cells recede (reduced
opacity). Clicking a result navigates the explorer to the containing
module/level. AI / natural-language search is deferred; the UI slot
exists from day one.

---

## Provisional Assignments

Provisional items live at a parent location (e.g. a level, not a cell).
They appear in a banner above/below the grid rather than in a cell.
"Place" converts a provisional to a placed assignment by clicking a
target cell. Provisionals are queryable and surface a badge count on the
parent in the drill-down list.

---

## Co-Stored Items

When items share a location: cell renders split/stacked visual; tooltip
lists all items; adding a non-co-storable item is blocked with
explanation. Co-storability is an item-level relationship — see
[storage-model.md](storage-model.md).

---

## Transaction Log + Undo (design rationale)

Every mutation is logged as an immutable transaction entry with
before/after state and parent pointer for compound operations (e.g.
relocating an insert groups the insert move + every assignment move
under a single parent). Undoing a compound entry unwinds all sub-entries
atomically. Undo is sequential per entity — blocked if a later
transaction modified the same entity. Activity view lives at
`/activity`; mutation toasts offer time-bounded inline undo. Compound
grouping + sequential constraint are load-bearing — they define how the
storage model survives bulk operations like insert relocation without
orphaning data.

---

## Empty States

Every view has a purposeful empty state with a clear next action (no
modules → "Create your first storage module"; no search results → "No
items match. Try different terms."; no provisional assignments → section
hidden).