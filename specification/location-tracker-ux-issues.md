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

---

## `/templates` and `/templates/[id]`

### TP-1 — "New template" button missing
- **Problem:** No entry point to create a template from the list page or detail page. `/templates/new` exists as a route.
- **Status:** Capturing; needs clarification.

### TP-2 — Delete a template missing
- **Problem:** No affordance to delete a template.
- **Status:** Capturing; same GitHub-repo deletion pattern likely applies (dialog + contents summary + type-to-confirm). Open: what are "contents" for a template — all inserts/locations referencing any of its versions?

### TP-3 — No way back to templates list from detail
- **Problem:** When viewing `/templates/[id]`, the only path back to the list is the sidebar menu button. Feels wrong.
- **Direction (asked by user):** How do other UIs handle this?
  - **Breadcrumb** (GitHub, GitLab, admin dashboards): `Templates › Plano 3600`. The crumb itself is the back-nav. This matches what we just added on `/modules/[id]` (GN-2).
  - **Back arrow in page header** (iOS, Notion): explicit `← Templates` button at top-left of the detail page.
  - **Sibling list kept visible** (master-detail on tablets / Notion sidebar / Finder): the list is a persistent left column, the detail fills the right. Click a different item, the right updates.
- **Recommended MVP:** Breadcrumb (matches GN-2 and the conventions the user already agreed to). Add a back-arrow on narrow viewports as a bonus.
- **Bigger picture (new from user):** Consider a "template editor" mode layered over the list — view the list, select/edit a template, return to the list. This is the *master-detail* / *stacked-navigation* pattern (Slack channels, Gmail labels, Xcode settings). Needs its own spec pass; deferred until TP-1/TP-2 land.

### TP-4 — Template editor mode over list
- **Problem:** Navigating away from the list to a dedicated detail page loses the user's place in the list and feels heavy.
- **Direction:** A "template editor mode" logically applied on top of the list — select a template → inline detail view opens (could be right pane, drawer, or modal) → user edits → closes → returns to list with selection preserved.
- **Status:** New idea. Defer full spec until we agree on which layout pattern fits best (pane vs. drawer vs. modal vs. full-page overlay).
- **Open:** Does this pattern also apply to `/items/[id]` and `/modules/[id]`? If yes, it becomes a cross-cutting layout decision, not just templates.

---

## Cross-cutting open questions
- **MD-1** add-level semantics (deferred)
- **TP-1/TP-2** template create/delete affordances
- **TP-3** back-nav from template detail (recommend breadcrumb)
- **TP-4** master-detail pattern — scope decision (templates only, or everywhere)
