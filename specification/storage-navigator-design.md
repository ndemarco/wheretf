# Storage Navigator — UI/UX Specification

## Overview

GUI-first visual interface for modeling, browsing, and managing physical storage. The grid is the primary interaction surface — not a secondary view driven by chat or search. Every mutation is logged to a transaction log, enabling undo of any action.

---

## Layout

Three-pane adaptive layout with collapsible sidebar.

```
┌────┬──────────────────────────┬──────────────────────────┐
│    │                          │                          │
│ S  │   Module Explorer        │   Storage Grid / Detail  │
│ I  │                          │                          │
│ D  │   Card list, drill-down  │   SVG grid, detail panel │
│ E  │   hierarchy, search      │   insert mgmt, actions   │
│ B  │                          │                          │
│ A  │                          │                          │
│ R  │                          │                          │
└────┴──────────────────────────┴──────────────────────────┘
```

**Sidebar** — icon rail when collapsed, expands to labeled nav. Links: Dashboard, Modules, Items, Search, Templates, Activity (transaction log). Collapse state persists.

**Center pane (Module Explorer)** — module card list → drill into levels → drill into positions. Breadcrumb navigation at top: `Modules / MUSE / Level 3`. Search bar at top of module list.

**Right pane (Storage Grid / Detail)** — appears when a location with sub-structure is selected. Shows SVG grid for grid-based locations, or detail panel for leaf locations. Contextual actions in a toolbar above the grid.

### Responsive Behavior

- **Desktop (≥1200px)** — all three panes visible, resizable
- **Tablet (768–1199px)** — sidebar collapses to icon rail, two panes visible
- **Mobile (<768px)** — single pane with navigation stack, swipe or back-button to return

---

## Module Explorer (Center Pane)

### Module List

Card grid. Each card shows:
- Module name (prominent)
- Description (truncated)
- Primary dimension summary (e.g., "11 levels", "9 drawers")
- Occupancy indicator — simple fill bar, not a percentage
- Quick stats: total locations, assigned locations

Cards are filterable by text search and sortable (name, occupancy, recent activity).

Empty state: "No modules configured. Create your first module to start organizing."

### Drill-Down

Click a module card → level/drawer list replaces the card grid. Breadcrumb updates.

Each level/drawer row shows:
- Dimension value and optional name
- Location type badge: `receptacle` or `fixed`
- Insert name (if occupied receptacle)
- Occupancy indicator
- Provisional assignment count (if any, shown as a distinct badge)

Click a level/drawer → right pane opens with SVG grid (if sub-structure exists) or detail view (if leaf).

### Breadcrumb

Path segments are clickable for navigation back up the hierarchy. Current segment is not a link. Format follows the display brief format: `MUSE / Level 3 / B4`.

---

## Storage Grid (Right Pane)

SVG-rendered grid of positions within a level, drawer, or insert. This is the primary visualization surface.

### Grid Structure

- Rows labeled alphabetically (A, B, C, ...) top-to-back on left axis
- Columns labeled numerically (1, 2, 3, ...) left-to-right on top axis
- Origin: top-left (A1)
- Labels come from the template's labeling scheme when available

### Cell Visual Vocabulary

Each cell is an SVG group (`<g>`) containing layered visual elements that encode state at a glance:

**Border shape** — outer cell boundary
- Rectangle (default) — standard position
- Rounded rectangle — TBD category mapping
- Additional shapes reserved for future category encoding

**Border color** — encodes primary category or status
- Default border (neutral gray) — empty or uncategorized
- Category-mapped color — item's primary category determines border hue
- Orange accent (#ff6600) — active selection or action target
- Red — disabled position

**Fill** — encodes occupancy and assignment type
- No fill (transparent) — empty, available
- Solid light fill — occupied (placed assignment)
- Hatched or dotted fill — provisional assignment (item is here, position undetermined)
- Striped fill (diagonal) — disabled (with reason on hover)

**Inner content** — encodes item identity within the cell
- Glyph or icon — categorical visual shorthand (e.g., a resistor symbol, a screw silhouette)
- Text label — item name, truncated to fit
- Co-storability indicator — split cell or stacked indicator when multiple items share the location
- Search result badge — numbered overlay matching search results

**Merged cells** — rendered as a single SVG region spanning the merged positions. Non-rectangular merges (L-shapes) render as a compound path. The merged region uses the origin position's label.

**Divided cells** — rendered with internal subdivision lines. Child positions labeled per the subdivision scheme. Each child is independently interactive.

### Cell Interactions

**Hover** — tooltip appears adjacent to the cell (DOM overlay, not SVG). Tooltip shows:
- Position label (e.g., B4)
- Item name (if assigned)
- Assignment type (placed / provisional)
- Co-stored items (if any)
- Override info (merged from, divided into, disabled reason)

**Click** — opens detail panel below or beside the grid (within the right pane). Detail panel shows:
- Full item information (name, description, parameters)
- Assignment details (placed/provisional, date assigned)
- Co-stored items list
- Override history
- Actions: reassign, unassign, move, edit override

**Drag** (future) — drag an insert to relocate it. Drag an item to reassign. Visual feedback shows compatible drop targets (interface type validation).

### Grid Toolbar

Above the grid, contextual actions:
- **Zoom controls** — fit to pane, zoom in/out
- **View toggle** — grid view / list view of positions
- **Filter** — show only occupied, only empty, only provisional
- **Actions menu** — add insert, apply template, override operations

---

## Search Integration

Search lives in the module explorer's header. Two modes:

**Basic search** — keyword match against item names, descriptions, parameters. Instant results as you type.

**AI search** (when available) — natural language queries. Deferred feature, but the UI slot exists from day one.

### Search Results in Grid

When search returns results:
1. Results list appears in the center pane, replacing or overlaying the current view
2. Each result shows: item name, location path, match context
3. Clicking a result navigates the explorer to that module/level and opens the grid
4. The result's cell gets a numbered badge overlay (1, 2, 3...) with a distinct color per result
5. If multiple results are in the same grid, all badges appear simultaneously
6. Non-result occupied cells remain visible but visually recede (reduced opacity)

Results are grouped by module/level for efficient scanning.

---

## Insert Management

### Placing an Insert

1. User selects "Add insert" from grid toolbar on a receptacle location
2. System shows compatible templates (filtered by interface type)
3. User selects a template → preview appears in the grid showing the insert's positions as ghost cells
4. User confirms → insert is created, positions become locations, transaction is logged
5. Notification: "Plano 3600 placed in MUSE Level 3" with undo option

### Relocating an Insert

1. User selects an insert (via grid toolbar or detail panel)
2. "Relocate" action shows compatible receptacles across all modules (filtered by interface type)
3. User selects destination → preview shows the insert in the new location
4. User confirms → insert moves with all overrides and assignments, transaction is logged
5. Notification: "Plano 3600 moved from MUSE Level 3 to MUSE Level 7" with undo option

### Interface Type Validation

Incompatible actions are prevented, not just warned:
- Placing an insert into a receptacle that doesn't accept its interface type → action is blocked, message explains why
- Compatible receptacles are visually indicated when placing/relocating (green highlight on valid targets, no highlight on invalid)

---

## Assignment UX

### Placing an Item

1. User clicks an empty cell → detail panel opens with "Assign item" action
2. Item picker: search/browse items, select one
3. Assignment is created immediately → cell updates with item visual encoding
4. Notification: "M3x10 SHCS assigned to MUSE 3 / B4" with undo option

### Provisional Assignment

1. User assigns an item to a parent location (e.g., a level, not a specific cell)
2. Provisional badge appears on the parent in the explorer drill-down view
3. In the grid, provisional items appear in a banner above or below the grid (not in a cell, since they have no position)
4. "Place" action on a provisional item: click a cell to convert it to a placed assignment

### Co-Stored Items

When items share a location:
- Cell shows a split or stacked visual (two colors, divided diagonally or stacked)
- Tooltip lists all items
- Detail panel shows all items with their co-storability relationship
- Adding a non-co-storable item to an occupied cell → action is blocked with explanation

---

## Transaction Log

Every mutation is recorded as an immutable transaction entry. This is foundational infrastructure, not an afterthought.

### What Gets Logged

Every state change to the storage model:
- Assignment: create, move, convert (provisional→placed), remove
- Insert: place, relocate, remove
- Override: merge, divide, disable, revert
- Module: create, edit, delete
- Template: create, new version, apply, update instance
- Location: create, remove (cascading from insert/template operations)

### Transaction Entry Structure

Each entry records:
- **Timestamp**
- **Actor** — user who performed the action
- **Action type** — the operation performed
- **Entity** — what was affected (item, assignment, insert, location, module, template)
- **Before state** — snapshot of affected data before the change
- **After state** — snapshot of affected data after the change
- **Related transactions** — parent transaction ID for compound operations (e.g., relocating an insert creates sub-transactions for each assignment move)
- **Undo status** — whether this transaction has been undone, and by which transaction

### Compound Transactions

Some user actions produce multiple state changes. These are grouped under a single parent transaction:
- Relocating an insert → move insert + move all assignments + update all paths
- Merging cells → merge override + migrate/remove affected assignments
- Removing an insert → remove insert + remove all child locations + unassign all items

Undoing a compound transaction unwinds all sub-transactions atomically.

### Undo Mechanics

- Any transaction can be undone if its affected entities haven't been further modified
- If a conflicting change has occurred since the transaction, undo is blocked with an explanation of the conflict
- Undo itself is a transaction (logged, and can be re-done)
- There is no arbitrary undo depth limit, but undo is strictly sequential per entity — you cannot undo transaction 5 if transaction 8 modified the same entity

### Activity View

The sidebar's "Activity" link opens a transaction log view:
- Chronological list of transactions, most recent first
- Filterable by entity type, actor, date range
- Each entry shows: timestamp, actor, action summary, affected entity
- Expandable to show before/after state diff
- Undo button on eligible transactions

### Notifications

Every mutation triggers a toast notification:
- Brief action summary: "M3x10 SHCS assigned to MUSE 3 / B4"
- Undo button (available for a configurable duration, e.g., 10 seconds)
- After timeout, undo is still available via the Activity view
- Notifications stack, most recent on top, auto-dismiss after timeout

---

## Override Visualization

### Merge

Merged cells render as a single region spanning all merged positions. The region's border follows the contiguous shape (may be non-rectangular). The origin position's label is displayed; alias positions show a subtle redirect indicator on hover.

User flow: select cells to merge → preview merged region → confirm → notification with undo.

### Divide

Divided cells show internal subdivision lines with child labels. Each child cell is independently interactive (hover, click, assign). The parent cell's border remains visible as the outer boundary.

User flow: select cell → choose subdivision (template-defined option or ad-hoc) → preview children → confirm → notification with undo.

### Disable

Disabled cells render with diagonal stripe fill and reduced opacity. Hover shows the disable reason. Disabled cells cannot receive assignments but remain visible in the grid structure.

User flow: select cell → disable with optional reason → notification with undo.

---

## Dashboard

The sidebar's "Dashboard" link shows a summary view:
- Module cards with occupancy indicators (same as Module List but read-only summary)
- Recent activity feed (last N transactions)
- Provisional assignments queue — items needing placement, grouped by location
- Quick search bar

---

## Template Browser

Accessible from sidebar. Shows available templates:
- Card grid with template name, type (fixed/parametric), interface type provided/accepted
- Version indicator (current version number)
- Instance count (how many inserts/fixed locations use this template)
- Click to view template detail: position layout preview, version history, list of instances

---

## Empty States

Every view has a purposeful empty state with a clear next action:
- No modules → "Create your first storage module"
- Module with no levels configured → "Define this module's levels"
- Level with no insert → "Place an insert or apply a template"
- Empty grid → "Start assigning items to positions"
- No search results → "No items match. Try different terms."
- No provisional assignments → (don't show the section)

---

## Visual Constants

- Accent color: #ff6600 (orange) — selection, active states, primary actions
- Grid cell default border: neutral gray (#d1d5db)
- Occupied cell fill: light blue (#dbeafe)
- Provisional fill: dotted pattern on light amber (#fef3c7)
- Disabled fill: diagonal stripes on light red (#fee2e2)
- Search result badge colors: cycle through a palette of 8 distinguishable colors
- Hover state: border thickens + accent color
- Selected state: accent color border + subtle glow

---

## Technical Notes

### SVG Rendering

Grid cells are SVG `<rect>` or `<path>` elements (paths for merged non-rectangular regions). Text labels, glyphs, and badges are SVG `<text>` and `<use>` elements. Tooltips and detail panels are DOM elements positioned relative to SVG coordinates via `getBBox()`.

### State Management

Grid state is derived from:
1. Module structure (levels, location types)
2. Template definitions (positions, labeling)
3. Active inserts and their overrides
4. Current assignments (placed and provisional)
5. Active search results (for badge overlays)

Grid re-renders on any state change. Transitions animate cell changes (new assignment fades in, removed assignment fades out).

### Performance

For grids up to ~500 cells, SVG performs well with React-managed elements. If a view exceeds this (unlikely for physical storage), virtualize rows outside the viewport.