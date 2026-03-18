# Item Maintenance — Use Cases

These use cases define how users create, find, edit, and manage items in WhereTF. They inform the item maintenance UX design.

---

## UC-1: Create a New Item

**Trigger:** User acquires a new type of item (just bought, just received, found in a drawer).

**Precondition:** None. Items can be created standalone or during assignment.

**Flow:**
1. User initiates item creation (from search "no results" state, from an empty cell's "Assign" action, or from a dedicated "New Item" entry point).
2. System presents item form: name (required), category, parameters (key/value/unit triples).
3. User fills in what they know — minimal is fine. Details can be added later.
4. System checks for similar existing items (fuzzy match on name + parameters). If near-matches exist, surface them: "Did you mean one of these?"
5. User confirms creation or selects an existing match instead.
6. If initiated from a cell, system prompts to assign immediately. Otherwise, item exists unassigned.

**Postcondition:** Item exists in the system. Optionally assigned to a location.

**Edge cases:**
- User creates a vague item ("resistors") — allowed, but the system should encourage specificity when disambiguation becomes necessary (see UC-7).
- Duplicate detected — user can merge with existing (see UC-5) or proceed with distinct item.

---

## UC-2: Find an Item

**Trigger:** User wants to locate an item or check if it exists.

**Precondition:** At least one item exists.

**Flow:**
1. User types into search (live, incremental).
2. System matches against item name, parameters, and category. Results ranked by relevance.
3. Results show item name, key parameters, and assignment count/locations.
4. User selects a result to view full detail including all assigned locations.

**Postcondition:** User sees the item and its locations, or confirms it doesn't exist.

**Edge cases:**
- No results — system offers to create a new item with the search term as the name.
- Item exists but is unassigned — shown with "unassigned" status, offer to assign.

---

## UC-3: Edit an Item

**Trigger:** User notices incorrect or incomplete information while browsing, searching, or assigning.

**Precondition:** Item exists.

**Flow:**
1. User views item detail (from grid cell, search result, or item list).
2. User edits name, category, or parameters in place.
3. System validates — name must remain unambiguous among existing items.
4. Changes apply immediately to all assignments of this item (it's one entity, not copies).

**Postcondition:** Item definition updated everywhere it appears.

**Edge cases:**
- Renaming to match an existing item — system warns and offers merge (UC-5).
- Editing an item that has assignments — fine, no confirmation needed. The item identity hasn't changed.

---

## UC-4: Split an Item

**Trigger:** User realizes an existing item is actually two or more distinct things. Common as collections grow and initial vague definitions need refinement.

**Precondition:** Item exists, typically with multiple assignments.

**Flow:**
1. User selects an item and chooses "Split."
2. System shows current item definition and all its assignments.
3. User defines the new item(s) — edits the original's name/params to be more specific, creates one or more new items for the split-off variants.
4. System presents each assignment and asks: which item does this assignment belong to?
5. User reassigns each location to the correct split item.

**Postcondition:** Original item is refined. New item(s) exist with their own assignments. No assignments are orphaned.

**Edge cases:**
- User splits but doesn't reassign all locations — system blocks completion until all assignments are resolved.
- Single-assignment item — split is technically allowed (the item definition changes and a new item is created) but unusual.

---

## UC-5: Merge Items

**Trigger:** User discovers duplicates — two items that are actually the same thing, possibly entered at different times with different names or parameter detail.

**Precondition:** Two or more items exist that represent the same real-world thing.

**Flow:**
1. User selects items to merge (from search results, item list, or prompted by the system during creation).
2. System shows all selected items side-by-side with their definitions and assignments.
3. User picks the surviving item (or edits to create the merged definition).
4. System consolidates all assignments onto the surviving item.
5. Non-surviving items are deleted.

**Postcondition:** One item remains with all assignments. Duplicates removed.

**Edge cases:**
- Merged items were at the same location — assignments collapse (same item, same location = one assignment).
- Parameter conflicts — surviving item's definition may need editing to capture the union of information.

---

## UC-6: Delete an Item

**Trigger:** User no longer has or tracks this type of item.

**Precondition:** Item exists.

**Flow:**
1. User selects item and chooses "Delete."
2. If item has assignments, system shows them: "This item is assigned to N locations. Remove all assignments?"
3. User confirms — all assignments are removed, then the item is deleted.

**Postcondition:** Item and all its assignments no longer exist.

**Edge cases:**
- Item with no assignments — delete immediately (with undo toast, not confirmation dialog).
- Accidental delete — undo window (consistent with project's undo+notify pattern).

---

## UC-7: Progressive Refinement

**Trigger:** User adds a new item that is too similar to an existing one. The system or user recognizes that one or both definitions need more detail to be distinguishable.

**Precondition:** Two or more items exist with overlapping names or parameters.

**Flow:**
1. System detects ambiguity (during creation, search, or assignment) and flags it.
2. User reviews the similar items side-by-side.
3. User adds distinguishing parameters to one or both items (e.g., "M3 SHCS" becomes "M3x10 SHCS" and "M3x16 SHCS").
4. If the original item had assignments, user optionally reassigns them to the now-distinct items (partial split — see UC-4).

**Postcondition:** Items are unambiguous. Assignments are correct.

**Edge cases:**
- User declines to refine — allowed. The system notes the ambiguity but doesn't block. Items can coexist with similar names if the user accepts it.

---

## UC-8: Bulk Parameter Edit

**Trigger:** User needs to change the same parameter across many items at once. Common during data cleanup, reclassification, or after discovering a systematic error.

**Precondition:** Multiple items share a parameter that needs changing.

**Flow:**
1. User filters items by criteria: category, parameter key, parameter value, name pattern, or a combination (e.g., "all items where category = passive and Size = 0805").
2. System shows matching items as a list with current values highlighted.
3. User selects which items to include (select all by default, deselect exceptions).
4. User specifies the change: set parameter X to value Y, rename parameter key, add a new parameter, or remove a parameter.
5. System previews the change across all selected items — shows before/after for each.
6. User confirms. Changes apply.

**Postcondition:** All selected items updated. Assignments unchanged.

**Edge cases:**
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
