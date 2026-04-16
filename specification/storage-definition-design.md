# Storage Definition — UI/UX Specification

Defines the workflows for creating and configuring physical storage structures: modules, levels, templates, and inserts. This is the setup phase — building the scaffold before items get assigned.

Complements [storage-navigator-design.md](storage-navigator-design.md) (browsing and interacting with storage) and [storage-model.md](storage-model.md) (data model reference).

---

## Scope

In scope:
- Module CRUD (create, view, edit, delete)
- Level/drawer generation and per-level configuration
- Template CRUD and version publishing
- Insert creation and placement into receptacles
- SVG grid visualization as structural confirmation
- Associating templates with receptacle locations

- Overrides: merge, divide, disable (grid-interactive operations)
- Continuous-dimension locations (louver panels, open shelves)

Out of scope (covered elsewhere or deferred):
- Item assignment to locations (storage-navigator-design)
- Drag-and-drop insert relocation (future)
- Template community catalog (future)

---

## Navigation

Module management lives at `/modules`. Accessed from sidebar icon rail.

```
/modules                    — module list
/modules/new                — module creation wizard
/modules/:id                — module detail (level table + grid preview)
/modules/:id/levels/:id     — level detail (insert config, grid view)
/templates                  — template list
/templates/new              — template creation
/templates/:id              — template detail + version history
```

---

## Module List (`/modules`)

Card grid. Each card shows:
- Module name (prominent)
- Description (one line, truncated)
- Primary dimension summary: "11 levels" or "9 drawers"
- Occupancy bar — simple fill indicator (assigned locations / total leaf locations)

**Actions:**
- Card click → navigate to module detail
- "New Module" button (top-right, prominent) → navigate to creation wizard

**Empty state:** "No modules yet. Create your first storage module to start organizing."

**Sort:** by name (default), by recently modified, by occupancy

---

## Module Creation Wizard (`/modules/new`)

Multi-step form. Not a modal — a full page. Modules are created infrequently, so a deliberate process is appropriate.

### Step 1: Identity

- **Name** — short identifier (e.g., "MUSE", "ALEX"). Required.
- **Description** — what this module physically is (e.g., "Red metal cabinet, 11 shelf levels, under workbench"). Optional.

### Step 2: Primary Dimension

- **Dimension label** — what are the top-level subdivisions called? Freeform text with suggestions: "level", "drawer", "shelf", "row", "bay". Required.
- **Count** — how many? Numeric input, minimum 1. Required.
- **Preview** — as the user types, show a vertical stack diagram of the generated levels with auto-labels. Labels follow the convention: sequential numbers (1, 2, 3...) by default.

### Step 3: Level Configuration

Table of the generated levels. Columns:
- **Label** — editable (default: "1", "2", "3"...)
- **Type** — dropdown: "receptacle" (default) or "fixed"
- **Notes** — freeform text, optional

All levels start as receptacles. The user can change individual levels or multi-select + batch apply.

**Batch operations** (via multi-select checkboxes):
- Set type (receptacle/fixed) for selected levels
- Set notes for selected levels

### Step 4: Review & Create

Summary card showing:
- Module name and description
- Dimension label and count
- Level configuration table (read-only)

"Create Module" button. On success → navigate to module detail page.

---

## Module Detail (`/modules/:id`)

Two-panel layout within the main content area (sidebar remains).

### Left: Module Info + Level Table

**Module header** — name (editable inline), description (editable inline), dimension summary.

**Level table** — all levels for this module. Columns:
- Label
- Type (receptacle / fixed)
- Insert (name of placed insert, or "—" if empty)
- Status (active / disabled + reason)
- Occupancy (filled / total leaf locations, or "—" if no sub-structure)

Row click → selects level, updates right panel.

**Actions on module:**
- Edit name/description (inline)
- Add levels (append to end)
- Delete module (immediate with undo toast — per ui-paradigms.md, no confirmation dialog)

**Actions on level (via row selection or level detail):**
- Place insert (if receptacle and empty)
- Remove insert (if receptacle and occupied)
- Configure fixed structure (if fixed type)
- Disable / enable
- Delete level

### Right: Level Preview

When a level is selected:
- If the level has sub-structure (insert placed or fixed template applied) → **SVG grid preview** showing the position layout. Labels on axes (rows alpha, columns numeric). Cells show occupancy state (empty, occupied, disabled). Read-only in this context — clicking a cell does nothing here (that's the navigator's job).
- If the level is an empty receptacle → "No insert placed. Place an insert to define this level's internal structure." with a "Place Insert" button.
- If the level is an empty fixed location → "No structure defined. Apply a template to define this level's layout." with an "Apply Template" button.

When no level is selected → "Select a level to view its layout."

---

## Place Insert Flow

Triggered from level detail when the user clicks "Place Insert" on an empty receptacle.

### Step 1: Choose Template

Searchable list of templates. Each row shows:
- Template name
- Type (fixed / parametric)
- Dimensions (e.g., "4 rows × 6 columns")
- Version number

Click a template → shows a grid preview of the template's positions below the list.

### Step 2: Configure (parametric templates only)

If the template is parametric, the user specifies dimensions:
- Grid size (e.g., 6 × 4 for a Gridfinity baseplate)
- Constrained by template's min/max

Live grid preview updates as dimensions change.

Fixed templates skip this step.

### Step 3: Name & Confirm

- **Insert name** — defaults to template name + auto-incrementing number (e.g., "Plano 3600 #4"). Editable.
- Grid preview showing the final layout within the level
- "Place Insert" button

On confirm:
1. Insert record created (references template + version)
2. Child locations generated from template positions
3. Receptacle's compatibility is set by cloning the template's interface data
4. Level preview updates to show the new grid
5. Notification: "Plano 3600 #4 placed in MUSE Level 3"

---

## Apply Template to Fixed Location

Similar to Place Insert, but for fixed locations. The template is applied permanently — no insert record, locations are created directly as children of the fixed location.

Same step sequence (choose template → configure if parametric → confirm), but:
- No insert name (there's no insert object)
- Messaging reflects permanence: "Apply Template" instead of "Place Insert"
- Notification: "Gridfinity 6×4 applied to ALEX Drawer 3"

---

## Template List (`/templates`)

Table view. Columns:
- Name
- Type (fixed / parametric)
- Current version
- Dimensions (rows × columns for latest version)
- Instance count (how many inserts + fixed applications use this template)

**Actions:**
- Row click → navigate to template detail
- "New Template" button → navigate to template creation

**Empty state:** "No templates defined. Create a template to define reusable storage layouts."

---

## Template Creation (`/templates/new`)

Single-page form (not a wizard — templates are simpler than modules).

**Fields:**
- **Name** — e.g., "Plano 3600 Stowaway". Required.
- **Description** — optional.
- **Type** — fixed or parametric. Required.
- **Rows** — number. For parametric: this is the default, with min/max constraints.
- **Columns** — number. Same as rows.
- **Min/Max rows** (parametric only)
- **Min/Max columns** (parametric only)
- **Row labels** — radio: alpha (A, B, C…) or numeric (1, 2, 3…). Default: alpha. Row and column labels must differ — validation prevents selecting the same type for both.
- **Column labels** — radio: numeric or alpha. Default: numeric.
- **Origin** — dropdown: top-left (default), top-right, bottom-left, bottom-right. Controls which corner the label sequence starts from. Changing origin reverses the label rendering order on affected axes (e.g., bottom-left → row A is at the bottom, column 1 is at the left).
- **Row dividers** — checkbox: fixed (checked) or removable (unchecked). Default: removable. Fixed means permanent physical dividers — merging across rows is blocked. Example: Plano 3600 row walls are molded plastic.
- **Column dividers** — checkbox: fixed or removable. Default: removable. Independent of row dividers. Example: Plano 3600 column dividers are removable tabs.
- **Unit system** — radio: imperial or metric. Default: metric.

**Live preview** — SVG grid updates as the user changes any property. Shows labels on axes with correct origin ordering. Fixed dividers render as thick lines between cells. Origin marker (accent triangle) appears in the label gutter corner outside cells.

"Create Template" button. Creates the template with version 1 containing the specified configuration.

---

## Template Detail (`/templates/:id`)

Three-panel layout: left panel (version history + instances), center panel (grid preview), right panel (properties).

### Left Panel

**Header** — template name (editable inline), description (editable inline), type badge.

**Version History** — table of versions, most recent first:
- Version number
- Dimensions (rows × columns)
- Date published
- Instance count (inserts/fixed locations using this version)
- Active badge — one version is marked "active" (the default for new inserts)
- Remove action (×) — visible only on versions with 0 instances. Hides the version from the list; data remains in the database.

Version rows are clickable. Clicking a version updates the center grid preview and right properties panel to show that version's configuration.

**Instances** — list below version history. Each row shows:
- Checkbox (for batch operations)
- Insert name (or "fixed" for direct applications)
- Module name → level label
- Version badge — shows current version, highlighted if not on the selected version

**"Apply v[X] to Selected"** button below the instance list. X is the currently selected version in the history table. Supports both upgrade (moving to a newer version) and downgrade (reverting to an older version).

### Center Panel

SVG grid rendering of the selected version's layout. Large cells (72px), 8px gaps between cells. Fixed dividers render as thick lines. Origin marker (accent triangle) in the label gutter corner outside cells. Labels reflect the version's labeling scheme and origin ordering.

### Right Panel — Properties

Properties are **always editable** — no edit/view mode toggle. Controls are always live form inputs. All changes immediately update the grid preview.

When the current form state differs from the selected version's saved data, two buttons appear:
- **"Publish as v[N]"** — creates a new version with the current property values
- **"Revert"** — resets all controls back to the selected version's values

When the form matches the selected version, neither button is shown.

**"Set as Active"** button — appears when viewing a non-active version. Sets the selected version as the default for new inserts.

**Property controls:**
- Dimensions — two number inputs (rows × cols)
- Row labels — radio: Alpha / Numeric
- Column labels — radio: Numeric / Alpha (validation: must differ from row labels)
- Origin — dropdown: Top-left, Top-right, Bottom-left, Bottom-right
- Row dividers — checkbox: Fixed (checked = permanent, blocks cross-row merging)
- Column dividers — checkbox: Fixed (checked = permanent, blocks within-row merging)
- Unit system — radio: Imperial / Metric

### Version Application Flow

Applying a version to instances (both upgrade and downgrade):

1. User selects a version in the history table, then checks target instances
2. Click "Apply v[X] to Selected" → **preview panel** shows per-instance impact:
   - **No conflicts** — structure is compatible, application is clean. Shows before/after grid side by side.
   - **Override conflicts** — the instance has overrides (merges, divides) that conflict with the target version's structure. Lists each conflict with resolution options: keep override, drop override, or skip this instance.
   - **Assignment conflicts** — locations that exist in the current version but not the target have active assignments. Lists affected assignments with options: reassign, unassign, or skip this instance.
3. User resolves conflicts per instance, or skips instances that need manual attention
4. Click "Apply" → instances updated, child locations restructured, toast with undo
5. Skipped instances remain on their current version — no partial changes per instance

The application is a compound transaction — all changes for one instance are grouped and undone atomically.

---

## Overrides (Grid-Interactive Operations)

Overrides modify the structure of a placed insert or a fixed location. All three types are accessed from the grid view — select cells, then apply the operation.

### Merge

Combine adjacent cells into a single larger cell.

1. User selects two or more adjacent cells in the grid (click first, shift-click additional)
2. Selected cells highlight with accent border
3. "Merge" action appears in a toolbar above the grid
4. Click merge → cells combine into a single region, labeled by the origin cell
5. Merged region renders as one `<rect>` spanning the combined area (or `<path>` for non-rectangular shapes)
6. Toast: "Merged A3–A4" with undo

**Constraints:**
- Cells must be adjacent and contiguous
- Template's **row dividers** and **column dividers** settings are enforced independently. If row dividers are fixed, the system blocks any merge that spans rows and explains why ("Row dividers on this template are permanent"). If column dividers are fixed, same for column-spanning merges. The merge action button is disabled for invalid selections.
- Existing assignments at affected cells must be migrated or removed first (enforced, not warned)

### Divide

Split a cell into named child positions.

1. User selects a single cell in the grid
2. "Divide" action appears in the toolbar
3. Click divide → panel shows options:
   - **Template-defined subdivision** — if the template defines subdivision options (e.g., "front/rear divider"), show those as named presets
   - **Ad-hoc** — user specifies count and labels (e.g., 2 children: "Left", "Right")
4. Preview shows the cell with internal subdivision lines
5. Confirm → child locations created, parent cell becomes non-assignable
6. Toast: "Divided B2 into Left, Right" with undo

**Constraints:**
- Existing assignment at the cell must be reassigned to a child or elsewhere before dividing (enforced)

### Disable

Mark a cell as unavailable.

1. User selects a cell in the grid
2. "Disable" action appears in the toolbar
3. Click disable → optional reason prompt (e.g., "cracked divider")
4. Cell renders with diagonal stripe fill, reduced opacity
5. Toast: "Disabled C5: cracked divider" with undo

Re-enable: select a disabled cell → "Enable" action appears → restores cell to active state.

**Constraints:**
- Existing assignment must be reassigned or removed first (enforced)

---

## Continuous-Dimension Locations

Some storage defines capacity by physical dimensions rather than discrete grid positions. Louver panels and open shelves are the primary examples.

### Template Configuration

When creating a template for continuous-dimension storage, additional fields:
- **Dimension type** — "discrete" (default, grid-based) or "continuous"
- **Row width** — total available width per row (e.g., 36 inches)
- **Row pitch** — vertical spacing between rows (e.g., 3.5 inches)
- **Overflow direction** — "down" (hanging, like louver panels) or "up" (sitting, like shelves)

### Visualization

Continuous-dimension levels render differently from grids:
- Each row is a horizontal bar showing total width
- Placed inserts appear as blocks within the bar, sized proportionally to their consumed width (insert width + buffer)
- Remaining capacity shown as empty space
- Utilization percentage displayed per row
- Overflow indicators: if an insert's height exceeds row pitch, a visual indicator extends into the adjacent row

### Placement

Placing an insert into a continuous-dimension location:
1. System checks dimensional fit (insert width + buffer ≤ remaining width)
2. Insert appears in the row visualization
3. Ordering within a row is optional — inserts can be reordered or treated as unordered

---

## SVG Grid Visualization

Used in three contexts during storage definition:
1. **Module detail** — level preview (read-only)
2. **Place insert / apply template** — preview of what will be created
3. **Template detail** — canonical layout preview

### Rendering Rules

- SVG within a React component. Scales to fit available width, maintains aspect ratio.
- Rows labeled on left axis, columns labeled on top axis, per labeling scheme (alpha or numeric)
- Label ordering follows origin setting — labels always ascend outward from the origin corner (e.g., bottom-left origin → row A at bottom, column 1 at left)
- Each cell is a `<rect>` with label text centered (row label + column label, e.g., "A1")
- Cell border: `#475569` (slate-600)
- Cell fill: transparent (empty), `#1e3a5f` dark blue (occupied — has an assignment)
- Disabled cells: diagonal stripe pattern (`#f87171` at 40% opacity), reduced overall opacity
- Merged cells: single `<rect>` spanning combined area, labeled by origin cell (e.g., "A3–A4")
- Divided cells: parent cell split into sub-rects with custom labels (e.g., "L", "R")
- **Fixed dividers** — thick lines (`#94a3b8`, 3px, 80% opacity) between rows and/or columns where dividers are marked fixed. Rendered independently per axis.
- **Origin marker** — accent triangle (`#ff6600`) in the label gutter corner outside all cells, at the origin position. Not inside any cell.
- Hover: border thickens, shows cell label tooltip (DOM overlay)

### Sizing

- Cells are square by default
- Template detail context: 72px cells, 8px gaps, 14px axis labels, 12px cell labels
- Module detail / modal contexts: 52px cells, 2px gaps, 11px axis labels, 9px cell labels
- Grid scales down for large templates (many columns), minimum cell size 24px
- Horizontal scroll if the grid exceeds available width at minimum cell size

---

## Empty States

| Context | Message | Action |
|---|---|---|
| Module list, no modules | "No modules yet. Create your first storage module to start organizing." | "New Module" button |
| Module detail, no levels | Should not happen — levels are auto-generated | — |
| Level selected, empty receptacle | "No insert placed." | "Place Insert" button |
| Level selected, empty fixed | "No structure defined." | "Apply Template" button |
| Template list, no templates | "No templates defined. Create a template to define reusable storage layouts." | "New Template" button |
| Place insert, no templates exist | "No templates available. Create a template first." | Link to /templates/new |

---

## Data Flow

### Module creation
1. POST `/api/modules` → creates module
2. POST `/api/locations` × N → creates one location per level (children of module)
3. Each location: `moduleId`, `label`, `path` (e.g., "MUSE:3"), `locationType: "receptacle"`

### Place insert
1. POST `/api/inserts` → creates insert record (references template + version)
2. POST `/api/inserts/:id/place` → places insert at receptacle location (validates compatibility)
3. System generates child locations from template version's position definitions
4. GET `/api/locations?moduleId=X` → refresh level table and grid preview

### Apply template to fixed location
1. Locations created directly as children of the fixed location, referencing the template version
2. No insert record — the structure is permanent

### Template creation
1. POST `/api/templates` → creates template with version 1
2. Subsequent versions: POST `/api/templates/:id/versions`

---

## Resolved Questions

1. **Level reordering** — deferred. No clear use case yet.
2. **Module photos** — deferred. Metadata field supports it; upload UI comes later.
3. **Template sharing** — no import/export. Multi-tenant: templates promoted to system level via referential links, not per-tenant copies.
4. **Undo** — always implemented. Toast notification with undo button on every mutation. Undo via transaction log per ui-paradigms.md. Only omit undo when explicitly agreed.
5. **Custom row/column labels** — deferred. Current options are alpha and numeric. Custom labels (e.g., color names like "black, blue, red, green") are a future feature.
6. **Template version list length** — versions with 0 instances can be hidden from the list to prevent clutter. Data is retained in the database. No pagination needed if unused versions are pruned.

