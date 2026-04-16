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

### IN-3 — Module level UI conflates receptacle with its insert
- **Problem:** On `/modules/[id]` a level like MUSE:1 shows grid cells (A1..D6) directly, hiding the fact that those cells belong to a specific **insert** (a physical instance of Plano 3600). User owns a *stack* of Plano 3600s; each is a distinct insert with its own name, overrides, and contents. The current UI doesn't name the insert in the level view and doesn't frame overrides as "on this insert" vs. "on this receptacle".
- **Name ownership:** the insert's name is a property of the insert. The level's label is usually a sequential stub (1, 2, 3 or A, B, C). Renaming the insert *may* be offered as a convenience from the receptacle context, but authoritative edit happens on the insert itself.
- **Direction:**
  - Module level header should read something like: **MUSE 1** · receptacle · holds *"construction screws"* (Plano 3600 Stowaway)
  - Or show a breadcrumb on the grid: MUSE › 1 › *construction screws* (Plano 3600)
  - Overrides (merge/divide/disable/restrict) applied to cells *inside an insert* are insert-scoped — should persist as `inserts.overrides`, not on the location. They travel with the insert when relocated.
  - Offer "Remove insert" and "Replace insert" at the receptacle level.
- **Open:** For cells inside an insert we've been writing to `locations.{isDisabled,maxWidthMm,…}` which lives on the child location row. That works when the insert never moves, but the spec says overrides must travel with the insert. Needs the structured `inserts.overrides` JSONB format we deferred earlier. Punt to when we implement merge (which already has to deal with insert-scoped persistence).

### IN-5 — "New insert" entry point
- **Problem:** `/inserts` has no way to create a new, unplaced insert. Today the only way to get an insert is through the Place Insert wizard on a module level.
- **Decision:** Add a `+ New` button on the `/inserts` list. Opens a small form (pick template, optional name) → creates an unplaced insert → auto-selects it in the master-detail pane.

### IN-6 — Hide UID chrome on the inserts page
- **Problem:** Insert UID is shown both in the list row and above the detail header. It's internal scaffolding — users don't want to see it in normal use.
- **Decision:** Remove both. UID can resurface later as a dim footer detail on the insert page once RFID / label-printing workflows arrive.

### IN-7 — Insert detail is the item↔insert central surface
- **Problem:** The insert detail page currently shows metadata only. The user wants it to be the *primary* place to see an insert's layout, assign/unassign items to cells, and apply overrides (merge/unmerge/disable/restrict/divide). Module detail stays as a where-is-it view.
- **Decision:**
  - Insert detail renders the insert's cell grid (same renderer idea as module detail today).
  - Click a cell → cell-detail side panel: assigned items CRUD, overrides (disable/restrict).
  - Multi-select cells (Ctrl/Cmd-click) → Merge action in the selection summary.
  - Single-cell actions on a merged cell → Unmerge.
  - Single-cell "Divide…" → splits into named children.
  - This supersedes the in-progress cell-edit affordances on the module detail page; module detail will eventually stay read-only on cells and link to the insert page for edits.
- **Open — layout:**
  - Current `/inserts` is master-detail (list + detail). Adding a full grid + cell detail means the detail pane needs more horizontal room.
  - Options:
    - (a) Keep master-detail; the right pane grows and the grid scrolls horizontally as needed
    - (b) Full-page detail when a row is selected (collapse the list into a small drawer/header)
    - (c) Hide the list on narrow screens, side-by-side on wide
- **Open — module page overlap:**
  - Keep the module detail's grid + cell controls, or strip cell interactions there and route users to the insert page for anything beyond viewing?
- **Supersedes:** IN-2/3 Merge and IN-2/4 Divide now live here.

### IN-4 — Placement from the insert side
- **Problem:** Today placement is receptacle-first (go to a level, pick a template). User also wants insert-first: "I'm holding this Plano, find somewhere it fits." And also wants to **kick an insert out** from either side.
- **Direction:**
  - On `/inserts` detail for an unplaced insert: a "Place in…" button that lists compatible receptacles (filter by interface type match + currently empty).
  - If already placed, show "Move to…" offering the same picker, plus "Unplace" (kick out without replacement).
  - On `/modules/[id]` at a receptacle level that holds an insert: "Remove insert" (= unplace) and "Replace insert" (= unplace + reopen placement flow).
- **Naming clarification (per user):** the compatibility name is the **interface type**. Insert template `interfaceTypeProvided` must match receptacle `interfaceTypeAccepted`.

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

### HX-1 — Assignment history (cross-cutting)
- **Problem:** there's no surfaced history of who/what lived where before the current state. "Previously at this receptacle," "this item used to be in A3," etc. Comes up per-receptacle (previous inserts), per-insert (previous receptacles), per-cell (previous items), per-item (previous locations).
- **Direction (deferred):** leverage the existing `transactions` log (already records beforeState/afterState for every mutation). Build a per-entity history view that filters the log by entity id and renders as a timeline. A clean history UX inherently enables undo — each transaction entry is a reversible delta.
- **Scope:** applies to assignments, inserts, cells, receptacles, items. Would replace the current ad-hoc per-feature undo plans (e.g. module delete cascade) with a single transaction-log-driven pattern.
- **Status:** future feature. Note it here so it doesn't get re-invented per-entity.

### IN-8 — Smart subdivision label suggestions
- **Problem:** divide dialog accepts any comma-separated strings. User pointed out the template already knows enough to suggest the right terms. A drawer's front/back axis, a shelf's left/right, or a template-declared subdivision accessory (e.g. Akro-Mils 40716 divider → front + rear) all imply better defaults.
- **Direction:**
  - If the cell's template version has a non-empty `subdivisionOptions` JSONB (already a schema field), populate a dropdown of those as the first UI offering. User picks one → children created with predeclared labels. "Custom…" route stays available.
  - If no subdivision option exists: fall back to a heuristic based on cell orientation (aspect ratio + primary axis + template kind) to propose `left, right` vs `front, rear` vs `top, bottom` as the placeholder. User can still type anything.
- **Work:** backend already has the JSONB field, nothing to add there. Need: TS type for the JSONB shape, a small helper that picks a suggestion, UI refactor from single text input to "dropdown of presets + custom" component.
- **Status:** deferred — not trivial (heuristic wants thought, options schema wants a type, UI wants a real picker).

---

## Cross-cutting open questions
- **MD-1** add-level semantics — refined: on a module, ISBAT insert a new
  level *before* or *after* an existing level X. No drag-to-reorder
  (too easy to foot-gun). Typically an uncommon operation since
  module structure doesn't change often.
- **IN-2** override UX — all 4 done (Disable, Restrict, Merge, Divide)
- **IN-3** module level header now surfaces the insert (done)
- **IN-4** insert-first placement (done)
- **IN-8** smart subdivision label suggestions from template
