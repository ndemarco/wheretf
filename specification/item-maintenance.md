# Item Maintenance — Use Cases

These use cases define how users create, find, edit, and manage items in WhereTF. They inform the item maintenance UX design.

---

## To address

1. Adding a family or group: I have a set of M3 SHCS in lengths 5, 6, 10, 12, 14, 20 mm. All have the same properties.

## UC-1: Create a New Item

Trigger: User acquires a new type of item (just bought, just received, found in a drawer).

Precondition: None. Items can be created standalone or during assignment.

Postcondition: Item exists in the system. Optionally assigned to a location.

Edge cases:
- User creates a vague item ("resistors") — allowed, but the system should encourage specificity when disambiguation becomes necessary (see UC-7).
- Duplicate detected — user can merge with existing (see UC-5) or proceed with distinct item.

---

## UC-2: Find an Item

Trigger: User wants to locate an item or check if it exists.

Precondition: At least one item exists.


Postcondition: User sees the item and its locations, or confirms it doesn't exist.

Edge cases:
- No results — system offers to create a new item with the search term as the name.
- Item exists but is unassigned — shown with "unassigned" status, offer to assign.

---

## UC-3: Edit an Item

Trigger: User notices incorrect or incomplete information while browsing, searching, or assigning.

Precondition: Item exists.



Postcondition: Item definition updated everywhere it appears.

Edge cases:
- Renaming to match an existing item — system warns and offers merge (UC-5).
- Editing an item that has assignments — fine, no confirmation needed. The item identity hasn't changed.

---

## UC-4: Split an Item

Trigger: User realizes an existing item is actually two or more distinct things. Common as collections grow and initial vague definitions need refinement.

Precondition: Item exists, typically with multiple assignments.



Postcondition: Original item is refined. New item(s) exist with their own assignments. No assignments are orphaned.

Edge cases:
- User splits but doesn't reassign all locations — system blocks completion until all assignments are resolved.
- Single-assignment item — split is technically allowed (the item definition changes and a new item is created) but unusual.

---

## UC-5: Merge Items

Trigger: User discovers duplicates — two items that are actually the same thing, possibly entered at different times with different names or parameter detail.

Precondition: Two or more items exist that represent the same real-world thing.


Postcondition: One item remains with all assignments. Duplicates removed.

Edge cases:
- Merged items were at the same location — assignments collapse (same item, same location = one assignment).
- Parameter conflicts — surviving item's definition may need editing to capture the union of information.

---

## UC-6: Delete an Item

Trigger: User no longer has or tracks this type of item.

Precondition: Item exists.



Postcondition: Item and all its assignments no longer exist.

Edge cases:
- Item with no assignments — delete immediately (with undo toast, not confirmation dialog).
- Accidental delete — undo window (consistent with project's undo+notify pattern).

---

## UC-7: Progressive Refinement

Trigger: User adds a new item that is too similar to an existing one. The system or user recognizes that one or both definitions need more detail to be distinguishable.

Precondition: Two or more items exist with overlapping names or parameters.



Postcondition: Items are unambiguous. Assignments are correct.

Edge cases:
- User declines to refine — allowed. The system notes the ambiguity but doesn't block. Items can coexist with similar names if the user accepts it.

---

## UC-8: Bulk Parameter Edit

Trigger: User needs to change the same parameter across many items at once. Common during data cleanup, reclassification, or after discovering a systematic error.

Precondition: Multiple items share a parameter that needs changing.



Postcondition: All selected items updated. Assignments unchanged.

Edge cases:
- Change creates ambiguity between items — system warns (see UC-7).
- Change affects items at many locations — fine, item identity hasn't changed, just metadata.
- User wants to change different values on different items — that's not bulk edit, that's individual edits. This use case is for uniform changes across a filtered set.
- Partial application — user deselects some items from the batch. Only selected items are changed.

---

## Cross-Cutting Concerns

### Undo
All destructive operations (delete, merge, split reassignment) follow the project's undo+notify pattern: action executes immediately, toast with undo action appears, auto-dismisses after a timeout. No confirmation dialogs.

### Item-Location Navigation
From any item view, the user can navigate to any of its assigned locations. From any location view, the user can navigate to the item and see all its other locations ("Also at" links).

### Future: AI-Assisted Creation
Item creation will eventually leverage AI for fuzzy matching, auto-categorization, and parameter extraction from photos or text descriptions. The manual flow defined here is the foundation — AI assists but doesn't replace it.

### Future: Fuzzy Dedup
The system will eventually proactively surface potential duplicates for merge consideration. The merge flow (UC-5) is designed to support both user-initiated and system-suggested merges.
