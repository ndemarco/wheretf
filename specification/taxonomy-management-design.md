# Taxonomy Management — UI/UX Specification

## Overview

Admin interface for managing WhereTF's item classification system: **parameter definitions**, **aspects**, **standards**, and **designations**. Categories are managed on a separate screen.

This is a system-level tool — it shapes how all items across all orgs are described. Changes here cascade to every item that uses the affected taxonomy elements.

---

## Access Model

Taxonomy management is a **system admin** function. It is not part of the everyday item/storage workflow.

| Role | Taxonomy | Module Layout | Items & Assignments |
|------|----------|---------------|---------------------|
| System admin | Full CRUD | Full CRUD | Full CRUD |
| Org admin | Read-only | Full CRUD | Full CRUD |
| User | Read-only | Read-only | Full CRUD |

Auth is not implemented yet. For now, the taxonomy page is accessible to all users. When auth arrives, it moves behind a system admin gate.

---

## Entity Relationships

```
Parameter Definition (atomic spec: name, type, unit, constraints)
  └─ attached to aspects (many-to-many via aspect_parameters)
  └─ attached to standards (many-to-many via standard_parameters)
  └─ values stored on items (item_parameter_values)

Aspect (reusable parameter group)
  └─ contains parameter definitions
  └─ optionally contains standards
  └─ applied to items (many-to-many)

Standard (classification system within an aspect)
  └─ covers a subset of its parent aspect's parameters
  └─ contains designations (lookup table entries)
  └─ applied to items (many-to-many via item_standards)
  └─ has optional domain_tag for grouping related standards (e.g., UNC/UNF → "Unified Thread Standard")

Designation (entry in a standard's lookup table)
  └─ maps a label (#8-32, M3x0.5, 0603) to parameter values
  └─ values stored as compound { value, source_value?, source_unit? }
```

Key invariant: parameter definitions are the atomic unit. They exist independently of aspects and standards. An aspect is a curated bundle of parameter definitions. A standard is a lookup table that resolves designations to parameter values within an aspect.

---

## Layout

Single-page, two-column layout. No tabs.

```
┌──────────────────────────────────────────────────────────────┐
│  Taxonomy                                      [system admin] │
├─────────────────────┬────────────────────────────────────────┤
│                     │                                        │
│  Entity List        │  Detail / Editor                       │
│                     │                                        │
│  Section: Aspects   │  Shows selected entity's full          │
│  ────────────────── │  editable form, relationships,         │
│  Section: Parameters│  standards, designations,              │
│                     │  usage stats, and danger zone          │
│                     │                                        │
└─────────────────────┴────────────────────────────────────────┘
```

**Left column** — scrollable list divided into two collapsible sections. Each section has a header with count and a "+ New" action. Selecting any entity opens its detail in the right column.

**Right column** — detail/editor for the selected entity. Empty state: "Select an aspect or parameter to view details." Content varies by entity type (see below).

### Why two sections, not three?

Categories are independent of aspects and parameters. They are a separate admin screen. Aspects and parameters are tightly coupled (aspects reference parameters), so they belong together.

---

## Left Column — Entity List

### Section: Aspects

Each row shows:
- Name
- Parameter count badge (e.g., "4 params")
- Standard count badge (e.g., "2 standards") — only if > 0
- Item count badge (e.g., "12 items")

Hidden aspects are excluded by default. A "Show hidden" toggle in the section header reveals them with a muted "Hidden" badge.

Sorted alphabetically.

### Section: Parameter Definitions

Each row shows:
- Name
- Data type badge (`text`, `numeric`, `boolean`, `enum`)
- Unit (if set, muted)
- Aspect count badge (how many aspects use this parameter)

Hidden parameters are excluded by default, revealed by "Show hidden" toggle.

Sorted alphabetically.

### Inline Create

"+ New" in each section header expands an inline form at the top of that section (not a modal). Minimal fields:
- **Aspect**: name (required), description
- **Parameter**: name (required), data type (required), unit

Submit creates the entity, collapses the form, and selects the new entity in the detail column.

---

## Right Column — Entity Detail

### Aspect Detail

- Editable name and description (inline, save on blur/enter)
- **Parameters**: ordered list of attached parameter definitions. Each shows name, type badge, unit. Actions: remove from aspect.
- **Add parameter**: searchable dropdown of parameter definitions not already on this aspect. Selecting one attaches it immediately.
- **Create + add parameter**: if the needed parameter doesn't exist, inline form to create a new parameter definition and attach it in one step. Form appears below the dropdown with name, data type, unit fields. On submit, creates the parameter definition and attaches it to the aspect in a single action.
- **Standards**: list of standards belonging to this aspect. Each shows name, domain tag (if set), designation count badge. Clicking a standard opens the Standard Detail view (replaces the current detail content).
- **Add standard**: inline form — name (required), description, domain tag. Appears below the standards list.
- **Usage**: "Applied to N items"
- **Danger zone**: Hide (if in use) or Delete (if unused). See Deletion & Hiding below.

### Standard Detail (nested within aspect)

Accessed by clicking a standard from the Aspect Detail view. Shows a breadcrumb: `Aspect Name > Standard Name`. Clicking the aspect name in the breadcrumb returns to the Aspect Detail.

- Editable name, description, domain tag (inline, save on blur/enter)
- **Parameters**: which of the parent aspect's parameters this standard covers. Shown as a checklist of the aspect's parameters with role selector (key/derived/info). Toggling a checkbox adds/removes the parameter from the standard.
- **Designations**: paginated table of lookup entries.
  - Columns: designation string, then one column per standard parameter showing the value. Display value shown in source unit (e.g., "32 TPI"); canonical value shown muted below (e.g., "0.794 mm").
  - Actions per row: edit (inline), delete (with undo toast).
  - Sorted alphabetically by designation string.
- **Add designation**: inline row at top of the table. Designation string input + value inputs for each standard parameter. Each value input includes a unit selector showing supported units for that parameter. The system converts to canonical on save and stores the source representation.
- **Usage**: "Applied to N items"
- **Danger zone**: Hide (if in use) or Delete (if unused)

### Parameter Definition Detail

- Editable name, data type, unit (inline, save on blur/enter)
- **Dependency warning**: changing the data type shows a warning if the parameter is referenced by aspects or standards. E.g., "Used by 3 aspects and 2 standards. Changing the type may invalidate existing values." The change is still allowed — this is informational, not blocking.
- Constraints editor (depends on data type):
  - `numeric`: min, max input fields
  - `enum`: tag-style editor. Each value shown as a removable tag. Add new values by typing and pressing Enter. Tags can be reordered by drag (future).
  - `text`, `boolean`: no constraints
- Default value (type-appropriate input)
- **Used by aspects**: list of aspects that include this parameter. Each is a clickable link — navigates to that aspect's detail view.
- **Used by standards**: list of standards that reference this parameter. Each is a clickable link — navigates to that standard's detail view (via its parent aspect).
- **Danger zone**: Hide (if in use) or Delete (if unused)

---

## Deletion & Hiding

### Zero usage (not referenced by any items, aspects, or standards)

Delete directly. Simple inline confirmation: "Delete [name]?" with a confirm button. No ceremony — this is a no-impact cleanup action.

### Non-zero usage

Elements with relationships cannot be deleted. Instead, they are **hidden** — removed from pickers and lists but preserved in the database. Existing item data remains intact.

- Hidden elements show a muted "Hidden" badge when viewed directly (via "Show hidden" toggle in the list header).
- A hidden aspect still appears on items that already use it, but won't be offered when applying new aspects.
- A hidden standard still resolves designations on existing items, but won't appear in standard pickers.
- A hidden parameter still holds values on existing items, but won't be offered when attaching parameters to aspects.
- Unhiding restores the element to normal visibility.

This avoids cascading data loss entirely. Full deletion with migration (reassign items, merge entities) is a future consideration.

For designations: these are data rows, not structural elements. Delete directly with undo toast, regardless of usage — removing a designation nullifies the reference on items (ON DELETE SET NULL), which is a safe operation.

---

## Empty States

- No aspects: "No aspects defined. Aspects are reusable groups of parameters — like 'Threading' or 'Fastener Drive'."
- No parameters: "No parameter definitions. Parameters are individual specs like 'pitch' or 'drive_type'."
- Aspect with no standards: "No standards. Standards provide lookup tables that map designations to parameter values."
- Standard with no designations: "No designations. Add entries to build the lookup table."
- Detail column, nothing selected: "Select an aspect or parameter to view details."

---

## Unit Conversion Helpers

Designation value entry and item parameter display both require unit conversion. A shared library of conversion functions handles this throughout the app:

- **Direct scaling**: inches ↔ mm, feet ↔ m, ounces ↔ grams, etc.
- **Inverse conversion**: TPI ↔ mm/thread (`25.4 / value`)
- **Non-linear formula**: AWG ↔ mm diameter (`0.127 × 92^((36 - n) / 39)`)

Each parameter definition's canonical unit determines the target. The UI presents a unit selector alongside value inputs, and the system converts on save. The source value and source unit are stored for display.

These helpers are implemented as pure functions in a shared module — not coupled to any UI component.

---

## Future Considerations

- **Drag-to-reorder** for parameter order within aspects and enum values
- **Merge** operation: merge two aspects, migrating all items
- **Full deletion with migration**: delete in-use elements after reassigning/migrating dependent data
- **Audit trail**: show who created/modified each taxonomy element and when
- **Bulk apply**: apply an aspect to multiple items at once from the aspect detail
- **Import/export**: bulk import of designation tables from CSV/JSON
- **Search within designations**: filter designation table by parameter value ranges
- **Visual relationship map**: graph view showing how aspects, standards, and parameters connect (inspired by Contentful's Visual Modeler)

---

## Resolved Questions

1. **Inline parameter creation**: Yes — create and attach in one step from the aspect detail.
2. **Designation value entry**: Accept values in any supported unit, convert to canonical on save. The conversion system is a shared set of helper functions used throughout the app.
3. **Large designation tables**: Not a concern. Standards are populated as items require them, not bulk-imported. Pagination is sufficient.
