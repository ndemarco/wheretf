# Taxonomy Management — UI/UX Specification

Admin interface at `/taxonomy` for managing item classification:
**parameter definitions**, **aspects**, **standards**, **designations**.
Categories have their own screen under `/taxonomy/categories`.

Shipped layout: two-column (entity list left, detail/editor right). No
tabs. Inline create per section. Aspect-scoped standard+designation
management nested within the aspect detail.

Data model + rationale: [item-parametric-model.md](item-parametric-model.md).
Conceptual overview: [item-taxonomy.md](item-taxonomy.md).

---

## Access Model (forward-looking)

Taxonomy is a **system admin** function — it shapes how items are
described across all orgs. Multi-tenant intent:

| Role | Taxonomy | Module Layout | Items & Assignments |
|------|----------|---------------|---------------------|
| System admin | Full CRUD | Full CRUD | Full CRUD |
| Org admin | Read-only | Full CRUD | Full CRUD |
| User | Read-only | Read-only | Full CRUD |

Auth not yet enforced — the page is open today. When auth lands this
moves behind a system-admin gate. See
[auth-roadmap.md](auth-roadmap.md).

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
