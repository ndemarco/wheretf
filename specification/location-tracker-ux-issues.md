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

### TP-2 — Delete a template
- **Problem:** No affordance to delete a template.
- **Decision:**
  - If the template is **unreferenced** (no insert or location points at any of its versions): hard delete allowed via the same GitHub-repo pattern (type-to-confirm).
  - If the template is **referenced**: hide instead of delete. A hidden template stays usable for existing inserts/locations but does not appear in pickers for new ones.
- **Future:** Delete-with-move — on delete of a referenced template, offer to replace its usages with a different template before removing.
- **Schema impact:** add `templates.isHidden boolean default false`. Picker/listing code filters it out. Existing inserts/locations resolve their templateVersion as normal.

### TP-3 — No way back to templates list from detail
- **Problem:** When viewing `/templates/[id]`, the only path back to the list is the sidebar menu button. Feels wrong.
- **Direction (asked by user):** How do other UIs handle this?
  - **Breadcrumb** (GitHub, GitLab, admin dashboards): `Templates › Plano 3600`. The crumb itself is the back-nav. This matches what we just added on `/modules/[id]` (GN-2).
  - **Back arrow in page header** (iOS, Notion): explicit `← Templates` button at top-left of the detail page.
  - **Sibling list kept visible** (master-detail on tablets / Notion sidebar / Finder): the list is a persistent left column, the detail fills the right. Click a different item, the right updates.
- **Recommended MVP:** Breadcrumb (matches GN-2 and the conventions the user already agreed to). Add a back-arrow on narrow viewports as a bonus.
- **Bigger picture (new from user):** Consider a "template editor" mode layered over the list — view the list, select/edit a template, return to the list. This is the *master-detail* / *stacked-navigation* pattern (Slack channels, Gmail labels, Xcode settings). Needs its own spec pass; deferred until TP-1/TP-2 land.

### TP-4 — Template editor: master-detail layout
- **Decision:** `/templates` becomes master-detail. List on the left, detail/editor on the right. Click a row → list stays visible, detail fills the right pane. URL reflects selection (`/templates?selected=<id>`).
- **Scope:** Templates only. Items and modules keep their current patterns.
- **Supersedes TP-3:** With master-detail, there's no navigation-away, so the "how do I get back" problem disappears.
- **Detail route:** `/templates/[id]` remains for deep-linking but becomes a thin redirect to `/templates?selected=[id]`.

---

---

## Inserts

### IN-1 — No `/inserts` page
- **Problem:** Inserts are only manageable through the module that hosts them. No way to see all inserts across the system, no way to create an unplaced insert from the UI (API only).
- **Decision:** Add a left-menu item **Inserts** → `/inserts`. List should be filterable **by type** (template) and **by interface type** (e.g. plano-3600, gridfinity-42mm) so the user can find "where does this bin fit?". Supports browsing placed + unplaced inventory.
- **Open (secondary):** Master-detail layout like templates, or something else.

### IN-2 — Where do I edit an insert's overrides (merge / divide / disable / restrict)?
- **Problem:** No UI exists for any of the four override types (see storage-model.md §Override Types). Schema supports:
  - `locations.mergedIntoId` for merge aliasing on module-scoped locations
  - `locations.isDisabled` + `disableReason` for disable on module-scoped locations
  - `locations.maxWidthMm/maxHeightMm/maxDepthMm/restrictReason` for restrict (MVP)
  - `inserts.overrides` JSONB for insert-scoped overrides (unstructured today — no validator)
- **Gaps:**
  - No API endpoint to apply an override to an insert
  - No API endpoint to divide a location (materialize children)
  - No UI for any of this
- **Direction:** Overrides should be editable from the cell detail panel (right pane) on the module detail page. Multi-select a range of cells → "Merge" shows up in the panel. Right-click or action menu on a single cell → "Disable" / "Restrict height" / "Divide".
- **Status:** Deferred. Big feature area; needs its own spec pass before implementation. Related to IN-1 (if inserts get a dedicated UI, insert-scoped overrides may live there too).

---

---

## Navigation

### NV-1 — Admin section in left menu
- **Problem:** Operations that structurally change the workshop (creating/removing modules, creating/removing/hiding templates) are mixed in with everyday navigation.
- **Decision:** Group admin-style entries in a distinct section (visually separated) in the left menu. At minimum: modules admin, templates admin. Maybe taxonomy admin belongs there too.
- **Open:** Does this mean separate routes (`/admin/modules`, `/admin/templates`) or the same routes with read/admin modes? Probably same routes, just the menu grouping communicates intent.

---

## Place Insert flow

### PI-1 — "Next" button is off-screen at bottom of template list
- **Problem:** On `/modules/[id]/levels/[levelId]/place-insert`, the Next button lives at the bottom of the template list. With more than a handful of templates, it's below the fold and feels undiscoverable.
- **Direction (likely):** Move primary action (Next / Place) to a sticky footer bar, or a fixed header action, independent of the scroll position of the list.

---

## Cross-cutting open questions
- **MD-1** add-level semantics (deferred)
- **IN-1** inserts UI master-detail layout decision
- **IN-2** override UX — 1 of 4 done (Disable); Restrict / Merge / Divide remain
- **NV-1** admin grouping — route structure
- **PI-1** place-insert Next button placement
