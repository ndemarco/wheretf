# Item Management — UI/UX Design

How users browse, create, edit, and organize items in WhereTF.

---

## Page Structure

Separate page from the storage navigator, accessible from the sidebar menu at `/items`. The item editor is reachable from any item reference in the app (grid cells, assignment lists, search results).

Three-panel layout:
- **Left panel** — search bar + filter pills + category filter
- **Center panel** — item grid (primary workspace)
- **Right panel** — selected item detail, aspect management, filter-from-value interaction

---

## Navigation

Sidebar icon rail is the root layout — shared across all pages. Routes:
- Modules icon → `/navigator`
- Items icon → `/items`
- Templates → `/templates` (future)
- Activity → `/activity` (future)

---

## State in URL

Active filters, sort column/direction, and search query are reflected in URL query parameters. Enables sharing and bookmarking filtered views. Example: `/items?filter=thread_diameter:M3,head_type:SHCS&sort=name:asc&q=stainless`

---

## Left Panel: Search and Filters

### Search

Text search bar at the top. Searches across item name, description, and parameter values. Executed at the database level. Results narrow the grid in real time (2+ characters).

### Filter Pills

Below the search bar. Each pill shows `Parameter: Value` (e.g., `Thread diameter: M3`). Pills are added from the detail panel (see Right Panel). Multiple pills combine with AND logic. Click X on a pill to remove it. Removing all pills returns to the unfiltered view. All filtering happens server-side — pills translate to query parameters sent to the API.

Dynamic facet counts: when pills are active, the system indicates how many items match each remaining filter option. Prevents dead-end filtering.

### Category Filter

Below the pills. Shows system categories with item counts. Click a category to add it as a filter pill (`Category: Fasteners`). Counts update as other filters are applied.

---

## Center Panel: Item Grid

The primary workspace. Items as rows, parameters as columns. Built with TanStack Table (headless — we control rendering).

### Columns

- **Name** column is always first, always frozen (does not scroll horizontally).
- **Primary category** icon column, frozen after name.
- **Dynamic parameter columns** — determined by context. Algorithm and calculation method deferred. Initially show a fixed set of common columns; dynamic adaptation is a future enhancement.
- **Column chooser** — button to manually show/hide/reorder columns. User column choices override any automatic selection.
- Horizontal scroll for overflow columns.

### Inline Editing

Click a cell to edit in place. The editor type matches the parameter's data type:
- Numeric: number input with unit label
- Text: text input
- Boolean: checkbox
- Enum: dropdown with valid options

Changes save on blur or Enter. Esc cancels.

### Row Selection

Click a row to select it and populate the detail panel. Ctrl+click for multi-select. Selected rows have accent highlight. Multi-select shows "N items selected" in detail panel (bulk operations deferred).

### Sorting

Click a column header to sort. Click again to reverse. Sort indicator arrow in header. Sort is executed server-side.

---

## Right Panel: Item Detail

Shows the full description of the selected item. This is the only place where filter-from-value interaction occurs.

### Header

Item name (editable inline), description (editable inline).

### Categories

Tags/chips for each category. One can be starred as primary. X to remove. "+ Add" button opens a category picker dropdown.

### Aspects

Each applied aspect as a collapsible section. Section header shows aspect name + completeness indicator: `Thread (2/4)` — filled/total params. Color: green=complete, orange=partial, gray=empty. X button to remove aspect.

Inside: parameter rows with:
- Parameter name, value (editable), unit label
- **Filter funnel icon** — clicking adds a `Param: Value` pill to the left panel. Only shown when value is non-empty. This is the only mechanism for adding parameter filters.

Below aspects: "+ Apply Aspect" button with dropdown of available aspects.

### Standalone Parameters

Section below aspects. Same row layout (name, value, unit, filter icon). "+ Add Parameter" button to attach a parameter definition.

### Locations

"Stored at" section. Location paths as clickable links (navigate to `/navigator` with that location focused). Assignment type badge (placed/provisional).

### Actions

- Delete item — immediate with undo toast

---

## Item Creation

Floating action button (`+ Item`) bottom-right of center panel. Creates a new item, selects it, focuses the name field. Item saves immediately with just a name. All other fields populated via detail panel or inline grid editing.

---

## Data Fetching

### Rich Item Endpoint

`GET /api/items` returns items with taxonomy data included — categories, applied aspects, and parameter values. Supports query parameters:
- `q` — text search across name, description, parameter values
- `filter` — parameter value filters (AND logic)
- `sort` — column and direction
- `category` — category filter

All filtering, searching, and sorting is executed at the database level.

### Mutations

Individual API calls for each mutation (update name, set parameter value, add category, apply aspect, etc.). Optimistic updates in the UI.

---

## Cross-Cutting Patterns

### Completeness Indicators

Aspect sections show filled/total parameter count. Supports "get items in fast, refine later."

### No Right-Click

All actions via visible UI elements. See [ui-paradigms.md](ui-paradigms.md).

### Undo, Not Confirm

Destructive actions execute immediately with undo toast.

### Item Reachability

Every item reference in the app links to `/items?selected={id}`.

---

## Deferred

- Split/merge items (UC-4, UC-5)
- Bulk parameter edit across selected items (UC-8)
- Progressive refinement / dedup detection (UC-7)
- AI-assisted item creation
- Saved/named views (filter + column + sort configurations)
- Multi-item comparison view in detail panel
- Dynamic column prevalence calculation
- Pagination / virtual scrolling strategy
