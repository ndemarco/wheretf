# Item Management — UI/UX Design

`/items` — three-pane layout (filter panel / item grid / detail panel)
for browsing, creating, editing, organizing items. Item references
throughout the app link back here via `/items?selected={id}`.

Layout primitives in [ui-layout-patterns.md](ui-layout-patterns.md);
cross-cutting rules in [ui-paradigms.md](ui-paradigms.md).

---

## Load-bearing design decisions

### Filter-from-value is the only filter-add path

Filter pills (`Parameter: Value`, AND-combined) can only be added by
clicking the funnel icon on a parameter value in the right-panel detail.
No global "add filter" button. Keeps filtering tied to observed values,
not guessed ones.

### Dynamic facet counts

When pills are active, remaining filter options show how many items
still match. Prevents dead-end filtering. (Not yet implemented — flag
when adding.)

### Completeness indicators

Aspect sections show `Name (filled/total)` with color coding. Supports
"get items in fast, refine later" — incomplete aspects flag, never
block.

### URL-reflected state

Filters, sort, search query live in URL query params so views are
shareable/bookmarkable.

---

## Deferred

- Split/merge items (UC-4, UC-5 below)
- Bulk parameter edit across selected items (UC-8 below)
- Progressive refinement / dedup detection (UC-7 below)
- AI-assisted item creation
- Saved/named views (filter + column + sort configurations)
- Multi-item comparison view in detail panel
- Dynamic column prevalence calculation
- Pagination / virtual scrolling strategy
- Family / group entry — M3 SHCS in lengths 5, 6, 10, 12, 14, 20 mm sharing most parameters. Bulk creation flow. Relates to UC-8.

---

## Deferred use cases

Lifecycle use cases still driving design. UC-1 (create), UC-2 (find),
UC-3 (edit), UC-6 (delete) are shipped via `/items`.

### UC-4: Split an Item

Trigger: user realizes an existing item is actually two or more distinct things. Common as collections grow and initial vague definitions need refinement.

Precondition: item exists, typically with multiple assignments.

Postcondition: original item is refined. New item(s) exist with their own assignments. No assignments are orphaned.

Edge cases:
- User splits but doesn't reassign all locations — system blocks completion until all assignments are resolved.
- Single-assignment item — split is technically allowed (definition changes, new item created) but unusual.

### UC-5: Merge Items

Trigger: user discovers duplicates — two items that are the same thing, possibly entered at different times with different names or parameter detail.

Precondition: two or more items exist that represent the same real-world thing.

Postcondition: one item remains with all assignments. Duplicates removed.

Edge cases:
- Merged items were at the same location — assignments collapse (same item, same location = one assignment).
- Parameter conflicts — surviving item's definition may need editing to capture the union of information.

### UC-7: Progressive Refinement

Trigger: user adds a new item that is too similar to an existing one. The system or user recognizes that one or both definitions need more detail to be distinguishable.

Precondition: two or more items exist with overlapping names or parameters.

Postcondition: items are unambiguous. Assignments are correct.

Edge cases:
- User declines to refine — allowed. System notes the ambiguity but doesn't block. Items can coexist with similar names if the user accepts it.

### UC-8: Bulk Parameter Edit

Trigger: user needs to change the same parameter across many items at once. Common during data cleanup, reclassification, or after discovering a systematic error.

Precondition: multiple items share a parameter that needs changing.

Postcondition: all selected items updated. Assignments unchanged.

Edge cases:
- Change creates ambiguity between items — system warns (see UC-7).
- Change affects items at many locations — fine; item identity hasn't changed, just metadata.
- User wants different values on different items — that's not bulk edit; do individual edits. This use case is for uniform changes across a filtered set.
- Partial application — user deselects some items from the batch. Only selected items are changed.

### Cross-cutting

- **Undo** — all destructive operations (delete, merge, split reassignment) follow the project's undo+notify pattern: action executes immediately, toast with undo action appears, auto-dismisses. No confirmation dialogs.
- **Item-location navigation** — from any item view, navigate to any of its assigned locations. From any location view, navigate to the item and see all its other locations ("Also at" links).
- **Future: AI-assisted creation** — fuzzy matching, auto-categorization, parameter extraction from photos or text. Manual flow defined here is the foundation; AI assists but doesn't replace it.
- **Future: fuzzy dedup** — system will proactively surface potential duplicates for merge consideration. UC-5's merge flow is designed to support both user-initiated and system-suggested merges.
