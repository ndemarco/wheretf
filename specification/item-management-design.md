# Item Management — UI/UX Design

How users browse, create, edit, and organize items in WhereTF.

---

## Page Structure

Separate page from the storage navigator, accessible from the main menu. The item editor is reachable from any item reference in the app (grid cells, assignment lists, search results).

Three-panel layout:
- **Left panel** — search bar + filter pills + category filter
- **Center panel** — item grid (primary workspace)
- **Right panel** — selected item detail, aspect management, filter-from-value interaction

---

## Left Panel: Search and Filters

### Search

Text search bar at the top. Searches across item name, description, and parameter values. Results narrow the grid in real time (2+ characters).

### Filter Pills

Below the search bar. Each pill shows `Parameter: Value` (e.g., `Thread diameter: M3`). Pills are added from the detail panel (see Right Panel). Multiple pills combine with AND logic. Click X on a pill to remove it. Removing all pills returns to the unfiltered view.

Dynamic facet counts: when pills are active, the system indicates how many items match each remaining filter option. Prevents dead-end filtering.

### Category Filter

Below the pills. Shows system categories with item counts. Click a category to add it as a filter pill (`Category: Fasteners`). Counts update as other filters are applied.

---

## Center Panel: Item Grid

The primary workspace. Items as rows, parameters as columns.

### Columns

- **Name** column is always first, always frozen (does not scroll horizontally).
- **Primary category** icon column, frozen after name.
- **Dynamic parameter columns** — determined by context:
  - No filters active: show a set of common parameters across all items (or name + category + description if items are too diverse).
  - Filters active: columns adapt to show parameters shared by the filtered set. Filtering to `Thread diameter: M3` surfaces Thread aspect columns (pitch, direction) plus other shared parameters.
- **Column chooser** — button to manually show/hide/reorder columns. User column choices override the automatic selection.

### Inline Editing

Click a cell to edit in place. The editor type matches the parameter's data type:
- Numeric: number input with unit label
- Text: text input
- Boolean: checkbox
- Enum: dropdown with valid options

Changes save on blur or Enter. Esc cancels.

### Row Selection

Click a row to select it and populate the detail panel. Ctrl+click for multi-select. Selected rows have accent highlight. Multi-select shows a comparison/bulk-edit view in the detail panel (deferred — show "N items selected" initially).

### Sorting

Click a column header to sort. Click again to reverse. Sort indicator arrow in header.

---

## Right Panel: Item Detail

Shows the full description of the selected item. This is where you examine, manage, and pivot from an item.

### Header

Item name (editable inline), description (editable inline).

### Categories

Shown as tags below the header. Each tag has an X to remove. One tag can be starred as primary (drives grid tile icon in navigator). "Add category" button opens a picker.

### Aspects

Each applied aspect is a collapsible section. Section header shows aspect name and a completeness indicator: `Thread (2/4)` meaning 2 of 4 parameters have values. Expand to see parameter rows:

- Parameter name, value (editable), unit label
- Each value has a **filter icon** (funnel). Clicking it adds a `Parameter: Value` pill to the left panel. This is the "pivot from current item" interaction.
- Unfilled parameters show placeholder text with the default value (if any) in muted style.

Below the aspect sections: "Apply aspect" button to add a new aspect from a picker/dropdown.

### Standalone Parameters

Section below aspects for parameters not part of any aspect. Same layout: name, value, unit, filter icon. "Add parameter" button to attach a parameter definition and set its value.

### Locations

"Stored at" section showing all locations where this item is assigned. Each location is a clickable link to the storage navigator. Shows assignment type (placed/provisional).

### Actions

- Delete item — immediate with undo toast
- Remove aspect — X on the aspect section header, cascades parameter values

---

## Item Creation

Floating action button (`+ Item`) in the bottom-right of the center panel. Creates a new item row at the top of the grid with the name field focused. The user types a name and presses Enter. The item is saved immediately. All other fields are optional — populate via the detail panel or inline grid editing.

---

## Cross-Cutting Patterns

### Completeness Indicators

When an aspect is applied, the detail panel shows how many of its parameters have values vs. how many exist. This supports "get items in fast, refine later" — the system shows what's missing without blocking.

### No Right-Click

All actions are reachable through visible UI elements. See [ui-paradigms.md](ui-paradigms.md).

### Undo, Not Confirm

Destructive actions (delete item, remove aspect, remove category) execute immediately with an undo toast.

### Item Reachability

Every item reference in the app (navigator grid cells, search results, assignment lists) links to the item management page with that item selected.

---

## Deferred

- Split/merge items (UC-4, UC-5)
- Bulk parameter edit across selected items (UC-8)
- Progressive refinement / dedup detection (UC-7)
- AI-assisted item creation
- Saved/named views (filter + column + sort configurations)
- Multi-item comparison view in detail panel
