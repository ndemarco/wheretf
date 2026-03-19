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
- Delete module (with confirmation — destructive)

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
- **Labeling scheme** — rows: alpha (default) or numeric. Columns: numeric (default) or alpha.
- **Origin** — which corner is position A1. Default: top-left.
- **Unit system** — metric or imperial. Default: metric.

**Live preview** — SVG grid updates as the user changes rows/columns. Shows labels on axes. Gives immediate confirmation that the layout matches the physical product.

"Create Template" button. Creates the template with version 1 containing the specified configuration.

---

## Template Detail (`/templates/:id`)

### Header
Template name (editable inline), description (editable inline), type badge, current version number.

### Grid Preview
SVG rendering of the current version's layout. Same visual style as module level preview.

### Version History
Table of versions, most recent first:
- Version number
- Dimensions (rows × columns)
- Date published
- Instance count (inserts/fixed locations using this version)

"Publish New Version" button → opens a form pre-filled with the current version's values. Edit and publish.

### Instances
List of inserts and fixed locations that reference this template, grouped by module. Each row shows:
- Insert name (or "fixed" for direct applications)
- Module name → level label
- Version applied

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
- Template may restrict merge axes (e.g., Plano rows are molded walls — merge within rows only, not across)
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
- Rows labeled on left axis (A, B, C... or per labeling scheme)
- Columns labeled on top axis (1, 2, 3... or per labeling scheme)
- Each cell is a `<rect>` with label text centered
- Cell border: `#475569` (slate-600)
- Cell fill: transparent (empty), `#dbeafe` light blue (occupied — has an assignment)
- Disabled cells: diagonal stripe pattern, reduced opacity
- Origin cell (A1): subtle accent dot in corner for orientation
- Hover: border thickens, shows cell label tooltip (DOM overlay)

### Sizing

- Cells are square by default, minimum 40px
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

