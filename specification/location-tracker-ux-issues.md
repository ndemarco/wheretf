# Location Tracker — UX Issues (living doc)

Running list of issues and decisions for the `/modules` and `/modules/[id]` areas. Updated during review sessions. No fixes applied until explicitly approved.

---

## Global / navigation

### GN-1 — Left toolbar expand/collapse
- **Problem:** Toolbar shows icons only; menu item names not visible.
- **Decision:** Add expanded mode (icon + name) and collapsed mode (icons only). Toggleable. Default: expanded. Persisted to localStorage.

### GN-2 — Breadcrumb trail
- **Problem:** No persistent location-path indicator as user navigates.
- **Decision:** Always-visible breadcrumb at top of main content area, using brief display form from storage-model.md §Display Formats (e.g., `MUSE 1 / A3`).

---

## `/modules` (list page)

### ML-1 — Module card editing mode
- **Problem:** Card fields are inadvertently editable.
- **Decision:** Whole card gated by edit mode. Entering edit mode reveals Save/Cancel + Delete. Outside edit mode, all fields are read-only.
- **Note:** Card is the canonical display of a module as a first-class object. All module-level affordances stay with the card.
- **TODO:** Add stats to card: `% occupied` (full locations / total locations), physical location hint (from metadata).

### ML-2 — Module deletion (GitHub-repo pattern)
- **Problem:** Single-click "Delete" is too dangerous even with undo.
- **Decision:** Follow GitHub repo deletion UX.
  1. Delete button only visible in edit mode.
  2. Opens a dialog that first explains the module's contents: inserts placed, items assigned, locations to resolve. If non-empty, user must either *move* or *orphan* contents before proceeding.
  3. Once conditions met, user must type the module name to confirm deletion.
- **Orphan semantics:** affected items become **unassigned** (their assignment records are removed). The deletion is recorded in the transaction log so it's reversible via undo.

### ML-3 — "Add a module"
- **Status:** Not actually missing. User was mistaken. `/modules/new` exists. No change.

### ML-4 — Module editing lives on the detail page
- **Decision:** `/modules` cards are **read-only**. List + add only, no edit/delete affordances on list cards. All module editing (and deletion per ML-2) happens in the right panel of `/modules/[id]`.
- **TODO:** Stats still display on the list cards per ML-1 (% occupied, physical location hint) — just non-interactive.

---

## `/modules/[id]` (module detail page)

### MD-1 — Add level control
- **Problem:** No button to add a level when a module is open.
- **Open:** Is "add level" just incrementing `primaryDimensionCount` and materializing the new level location, or are levels first-class records created individually? **Deferred.**

### MD-2 — Parent (module) vs. children (levels) distinction
- **Decision:** Module header on detail page is **non-interactive label text only**. All editing of the module itself happens in the right panel (per ML-4 revision). Levels are clearly the editable children of the module.

### MD-3 — "1 level" copy on module header
- **Problem:** Ambiguous text.
- **Decision:** Eliminate the "N level" line from the module header on this page. The level list itself communicates the count.

### MD-4 — Default level selection
- **Problem:** No level selected by default; user must click one to see anything.
- **Decision:** Auto-select a level on page load.
  - Ideal: last-selected level for this module, persisted to localStorage (per-device).
  - Fallback: first level.

### MD-5 — Level rename and property editing
- **Problem:** Unclear how to edit a level's name (e.g., rename "3" to "Power supplies") or set its properties.
- **Decision:** Level editing lives in the **right panel** when a level is selected. Right panel also hosts module-level editing (per ML-4) and eventually stats + bulk actions.
- **Level properties (initial):** label, locationType (receptacle / fixed / leaf), interfaceTypeAccepted, description, notes. Same edit-mode gating as the module card.

---

## Cross-cutting open questions
- **MD-1** add-level semantics (deferred)
