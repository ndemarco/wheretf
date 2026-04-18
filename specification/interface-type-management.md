# Interface Type Management — UI/UX Spec

Admin CRUD for interface types. Integration points on templates + receptacles.

See [storage-model.md](storage-model.md) lines 124-137 (concept), [storage-definition-design.md](storage-definition-design.md) (template + level editors).

---

## Concept

Interface type = named compatibility class. Label groups inserts + receptacles that work together. Compatibility is by name; only modular-system unit geometry lives on the interface, nothing else. Compatibility check = shared interface type (matched by UUID).

Examples:
- `gridfinity-42mm` — any gf bin fits any gf baseplate
- `plano-3600` — Plano 3700 trays fit Plano 3600 boxes

Geometry contracts (footprint, mounting, clearance) → deferred. `physicalContract` JSON = free-form notes for now.

**Atomic.** One interface = one boundary. No composite interfaces (`louver-or-shelf` bad). Akro bin hangs on louver AND sits on shelf → declare both (`louver-hang` + `open-surface`).

**Membership match.** Insert compatible with receptacle if `insert.provides ∩ receptacle.accepts` non-empty.

**Maturity.** Each type carries `maturity: 'draft' | 'stable'`. Draft = admin still shaping the concept, physical contract notes likely incomplete. Stable = canonical, safe to reference. Draft types appear in pickers de-emphasized (muted chip, "(draft)" suffix) and sort below stable.

Maturity is set via the save action, not a visible form field:
- **Create:** primary button "Create" → stable. Secondary deprioritized "Save as draft" → draft. Default is stable.
- **Edit stable:** single "Save" button. Stable is terminal — no demotion. (If a stable type is wrong, rename/merge/archive it; don't demote.)
- **Edit draft:** primary "Save" promotes to stable. Secondary "Save as draft" keeps it draft.

The state machine is one-directional: `draft → stable → archived → deleted`. Demoting stable back to draft is intentionally blocked — it creates ambiguous semantics when refs already point at the type (all consumers silently downgrade). Unused stable types go straight to archive instead.

**Unit system (modular interfaces).** Some interfaces have a natural modular ruler. `gridfinity-42mm` = 42×42 cell × 7mm height increment; bins are natural to express as N×M units wide × Kh tall. Fixed form factors (`plano-3600`) and continuous-dim interfaces (`louver-hang`) have no unit.

**SI mm is authoritative storage.** Interface unit system is a per-axis input/display convenience. User types "3u" in the stepper, UI computes and stores `21mm`. No unit-expressed dims in the database. No read-time materialization.

Unit system structure:
```
{
  width:  { label: "u", mm: 42 },
  depth:  { label: "u", mm: 42 },
  height: { label: "h", mm: 7  }
}
```
Axes not listed fall back to raw-mm input. Continuous-dim interfaces carry no unit system — `rowPitchMm` on the template is a clearance constant, not an input multiplier.

Multi-interface templates: unit source is the first selected interface with a `unitSystem`. Axes not covered by that one fall back to raw mm.

**Lifecycle.** Three verbs, ordered least to most destructive:
- **Archive** — hide from pickers; existing references stay intact. Default retire verb. Reversible (unarchive).
- **Merge into X** — rewrite all junction rows (`template_version_interfaces_*`, `location_interfaces_accepted`) pointing at the merged type to point at survivor. Mints a new template version for every affected template (interfaces-provided/accepted are versioned properties). Hard-deletes the merged source types in the same transaction — bypasses the archive-gate since tombstoning is part of consolidation. Use when a type was misnamed or duplicated. Rare activity, acceptable cost.
- **Delete** — hard delete. Only available when type is archived AND usage = 0. Destructive, no undo.

---

## Compatibility = Interface Match + Dimensional Fit

Interface match necessary, not sufficient. Dimensional check runs after.

### Gridfinity height
Gf bins share `gridfinity-42mm` regardless of height. Height variable (gf units ~7mm each). Drawer has finite clearance. 6u bin fails in 4u drawer even though interface matches.

Check: `insert.template.heightMm ≤ receptacle.effectiveMaxHeightMm` where `effectiveMaxHeightMm = min(template.heightMm, location.maxHeightMm)`. Restrict override semantics — see [storage-model.md §Restrict](storage-model.md).

### Akro louver drop
Louver bin extends down from rail. Vertical extent > row pitch → overflows into row below. Allowed if receptacle permits overflow, bounded by remaining rows + floor.

Check: when `receptacle.overflowDirection = "down"`, measure drop past hang point against `rowPitchMm` + available adjacent rows. Same logic `overflowDirection = "up"` for shelves.

### Where geometry lives

All dims stored in raw mm. Interface unit is display-only.

- `interfaceTypes.unitSystem` (jsonb, nullable) — per-axis input units. Shape: `{ width: {label, mm}, depth: {label, mm}, height: {label, mm} }`. Null for fixed-form + continuous-dim interfaces.
- `templateVersions.widthMm / heightMm / depthMm / rowPitchMm / overflowDirection / bufferMm` — nominal dims in raw mm. **All nullable** — dims are optional per-axis.
- `locations.maxWidthMm / maxHeightMm / maxDepthMm / restrictReason` — Restrict override clamps. Authoritative when parent template dim is null.

Templates without dims are normal. UI doesn't flag them. No drift warnings — user rules the storage.

### Placement pseudocode

```
canPlace(insert, receptacle):
  1. intersection = insert.interfacesProvided ∩ receptacle.interfacesAccepted
     if empty → reject ("no compatible interface")
  2. for each axis in { width, height, depth }:
       // optimistic: skip axis check if insert dim or receptacle clearance is null
       if insert.template[axis] == null → continue
       effectiveMax = min(receptacle.template[axis] || ∞, receptacle.location[maxAxis] || ∞)
       if effectiveMax == ∞ → continue   // no known clearance, trust user
       required = insert.template[axis] + insert.template.bufferMm (on the overflow axis)
       if required > effectiveMax and overflowDirection does not permit → reject
  3. if overflow direction set AND insert height known, verify adjacent rows absorb overhang
     else accept (can't compute overhang without data; user rules the storage)
  4. accept
```

UI must distinguish failure modes: "no compatible interface" vs "interface matches but insert 82mm tall, drawer clears 60mm".

**Future feature (not today):** user override on any placement rejection. Principle — system trusts user when user disagrees with computed fit. Add later; design guardrail now.

### Cross-location overflow helper

Placement validates target receptacle + ancestors. Overflow check needs *siblings* — row below a louver rail, to see if overflow lands on occupied space. Current placement doesn't cross location boundaries. Add spatial-neighbor helper.

```
locationNeighbors.getAdjacentInDirection({
  locationId,
  direction,   // 'up' | 'down' | 'left' | 'right'
  count,       // how many neighbors to return
}): Location[]
```

Returns ordered sibling locations in given direction, resolved by parent's layout (grid position, continuous-dim row index).

Usage in placement:
```
if (insert.heightMm > receptacle.rowPitchMm && receptacle.overflowDirection) {
  overflowMm = insert.heightMm - receptacle.rowPitchMm
  rowsNeeded = ceil(overflowMm / receptacle.rowPitchMm)
  neighbors = getAdjacentInDirection({
    locationId: receptacle.id,
    direction: receptacle.overflowDirection,
    count: rowsNeeded,
  })
  if (neighbors.length < rowsNeeded) reject("not enough rows")
  for (const n of neighbors) {
    if (hasConflictingInsert(n, projectedFootprint)) reject("row N occupied")
  }
}
```

Lives in new repo: `web/repositories/locationNeighborsRepository.ts`. Placement repo imports + calls. Spatial reasoning isolated from placement business logic.

Handles both modes — discrete grid (row/col index) and continuous-dim (row order in parent).

Override-aware: merged cells return as single neighbor; divided cells return children separately; `isDisabled` neighbors still returned — placement decides whether disabled rows absorb overflow.

No caching. Neighbor clearance changes on every sibling mutation — cache invalidation fragile. Louver panels usually ≤6 rows; walk cost negligible. Helper reusable for future defrag + UI conflict highlighting. Revisit only if profiling shows hot path.

---

## Scope

In:
- Admin CRUD (identifier, description, physical contract notes)
- Template editor: multi-select provided/accepted interfaces
- Level/receptacle: multi-select accepted interfaces

Out:
- Structured geometric contracts — deferred
- User-submitted types + approval workflow — deferred
- Per-org namespaces — interface types are system-global

---

## Access Control

CRUD = admin-only. Single-user today → sole user = admin. Multi-tenant future → WhereTF staff only; tenants select from catalog.

Template + receptacle dropdowns (consume existing types) = all users. Not admin-gated.

---

## Navigation

```
/admin/interfaces            — list (admin only)
/admin/interfaces/new        — create
/admin/interfaces/:id        — detail + edit
```

Admin section under `/admin/*`. No menu entry for non-admins. Entry point: user avatar (profile menu) dropdown → "Admin" → "Interfaces". Single avatar-menu entry covers all admin surfaces (future: categories, parameters, etc.). Short-term fallback if avatar menu not yet built: sidebar gear icon.

---

## Interface Type List (`/admin/interfaces`)

Table. Columns:
- **Checkbox** — row select for bulk ops
- **Identifier** (mono) — `plano-3600`
- **Maturity** — badge: `stable` | `draft`
- **Status** — `active` | `archived`
- **Description** — one-line truncated
- **Usage** — "N templates provide · M templates accept · K receptacles accept"
- **Created** — relative date

Row click → detail/edit. Archived rows dimmed.

Row actions (single-row icons):
- Archive / Unarchive (toggle)
- Delete (only visible when `archived && usage == 0`; destructive, confirm prompt)

Bulk actions (appear when 2+ rows selected):
- **Merge into…** — selected rows = sources (merged away). Picker shows all non-selected active types as survivor candidates. Pick survivor → confirm dialog: "N references will be rewritten and M template versions minted. This hard-deletes {A, B}." → execute in transaction → toast "Merged {A, B} into {C}. 47 references updated, 12 template versions minted."
- **Archive selected**
- **Unarchive selected**

Header actions:
- "New Interface Type" button (top-right)

Empty state: "No interface types defined. Create one to declare compatibility between inserts and receptacles." + "New Interface Type" button. Admins only reach this page.

Filter: All / Active / Archived (tabs above table, default Active).
Sort: identifier (default), usage desc, maturity, recently created.

---

## Create / Edit (`/admin/interfaces/new`, `/admin/interfaces/:id`)

Single-page form. Fields:
- **Identifier** — required, unique, slug-style. Regex `^[a-z0-9][a-z0-9-]*$`. Mutable — references are by UUID so rename is safe. On rename, display updates everywhere (chip labels, usage rows); underlying references don't care.
- **Description** — optional, multiline. What interface represents, common products, gotchas. Surfaces as tooltip on every chip that displays this type (template editor, level editor, usage row). Keep concise — one short paragraph max.
- **Unit system** — optional. Toggle "This is a modular system" → reveals three per-axis rows (width, depth, height). Each row: label (short string, e.g., "u", "h") + mm value. Leave a row empty to fall back to raw-mm input on that axis. Left entirely off for fixed-form and continuous-dim interfaces. No warning on toggle-off — storage is always mm, nothing to revert.
- **Physical contract (notes)** — optional, multiline free-form. Placeholder: "Footprint, mounting, clearance notes. Structured fields coming later." Stored `{ notes: "..." }` in `physicalContract` jsonb.

**Derive from existing** — button on detail page: "Derive new interface". Opens create form pre-filled from current type (description + physical contract + unit system copied; new identifier required; maturity resets to draft). Use case: variant / successor interface that starts identical. New row, new UUID — not a version of original. No lineage tracked today. Clone is independent after creation; no linked updates.

Buttons (footer):
- Create mode: primary "Create" (→ stable) + secondary "Save as draft" (→ draft) + Cancel.
- Edit stable: primary "Save" + Cancel. No demotion path.
- Edit draft: primary "Save" (→ promotes to stable) + secondary "Save as draft" (→ stays draft) + Cancel.

Detail header shows a small draft pill when viewing a draft. No form-level maturity control — the save action carries the intent.

Lifecycle actions (Archive, Merge, Delete) live in a lifecycle menu on the detail page header, not mixed with form buttons.

Save → redirect to list + toast "Interface type created: plano-3600" / "Updated" / "Published plano-3600 (draft → stable)" with undo where safe.

---

## Template Editor Integration

See [storage-definition-design.md](storage-definition-design.md) template detail right panel. Add two controls:

- **Interfaces provided** — multi-select chip input (insert templates). Options from `GET /api/interface-types?status=active`. Empty allowed but placement blocked until populated.
- **Interfaces accepted** — multi-select chip input (receptacle-producing templates, e.g., gf baseplates). Same source.

Dim-input mode toggle (only shown when at least one selected interface declares `unitSystem`): "Units" / "Raw mm". Units mode shows integer steppers labeled per-axis from the interface (e.g., "Width: 2u", "Height: 3h"), with mm equivalent below. Raw mm mode = plain mm inputs. Storage is always mm regardless — unit mode just scales the stepper. Mix freely; no drift warnings.

Unit source when multiple modular interfaces selected: first in list with a `unitSystem`. Axes that interface doesn't cover fall back to raw mm input.

Dims are optional per-axis. All null is fine — most templates won't bother specifying dims. Only populate when dimensional fit matters (e.g., tall gf bins against drawer clearance).

Chip UX:
- Hover a chip → tooltip shows interface description. Sourced from `interfaceTypes.description`. Saves a trip to `/admin/interfaces/:id` when deciding between similar types.
- Draft types shown with muted chip + "(draft)" suffix, sorted below stable in the picker dropdown. Maturity is independent of the status filter — drafts remain pickable.
- Archived types never appear in picker (the `status=active` filter hides them), but already-attached archived types stay visible on the template (read-only chip, muted, tooltip notes "archived — ask admin").

Both versioned. Change triggers existing "Publish as v[N]" / "Revert" flow.

Template CAN populate both sides (receptacle that's also an insert). Spec `storage-model.md:130` says directionality per boundary. Both allowed, exclusive use expected.

---

## Receptacle / Level Integration

Module detail ([storage-definition-design.md §Module Detail](storage-definition-design.md)). Level rows = `locations` with `locationType = receptacle`. Add:

- **Interfaces accepted** — multi-select chip input, level properties editor (right panel or level detail). Options from `GET /api/interface-types?status=active`. Same chip UX as template editor: tooltip-on-hover for description, draft/archived handling identical.

Placement check → see [Placement pseudocode](#placement-pseudocode).

Template-inherited accepted interfaces → not today. Direct set only.

---

## Data Flow

### Schema change (prerequisite)

Current: `interfaceTypeProvided` / `interfaceTypeAccepted` = single `text` columns on `template_versions`, `locations`, `inserts`. No multiplicity. Change → **junction tables** keyed by interface type UUID:

- `template_version_interfaces_provided (template_version_id, interface_type_id)` — composite PK
- `template_version_interfaces_accepted (template_version_id, interface_type_id)` — composite PK
- `location_interfaces_accepted (location_id, interface_type_id)` — composite PK

No `insert_interfaces_provided` table. Inserts inherit provided interfaces from template. No override path.

Extend `interface_types`:
- `maturity text not null default 'draft'` — `'draft' | 'stable'`
- `archived_at timestamp` — null = active; non-null = archived at that time
- `unit_system jsonb` — null for fixed-form + continuous-dim interfaces; populated for modular systems. Formalized per-axis shape: `{ width: { label, mm }, depth: { label, mm }, height: { label, mm } }`. Keys match axis names exactly so UI can render steppers without a separate mapping.

Template dims (`templateVersions.widthMm / heightMm / depthMm / bufferMm` etc.) stay in raw mm. All nullable — templates without dims are normal.

Existing `template_versions.unit_size: text` (value like `"42mm"`) becomes redundant post-migration — its info now lives on the interface. Deprecate + drop after backfill.

**Load-bearing invariant:** all references to interface types are by `interface_types.id` (UUID). Identifier (`plano-3600`) is a human-readable, mutable display slug. Never join on identifier anywhere — in migrations, queries, or code. This is what makes rename, merge, and historical stability safe. Mark with a comment in the schema file so it survives future "optimizations."

Junction > `uuid[]` arrays: FK integrity, single join for "templates providing X", straightforward merge rewrites.

Migration: backfill single-text identifiers → interface type UUIDs, drop text columns. Drop unresolvable values (shouldn't exist in dev).

### CRUD

- `GET /api/interface-types` — list. Query param `status=active|archived|all` (default `all` for admin list, `active` for chip pickers).
- `POST /api/interface-types` — admin only. Body `{ ..., maturity }`. Maturity defaulted from the save button (stable if omitted).
- `GET /api/interface-types/:id` — detail + usage counts.
- `PATCH /api/interface-types/:id` — admin only. Identifier + description + physicalContract + unitSystem mutable. Maturity mutable only in the direction `draft → stable`; stable → draft returns 409.
- `POST /api/interface-types/:id/archive` — admin only. Sets `archived_at = now()`.
- `POST /api/interface-types/:id/unarchive` — admin only. Nulls `archived_at`.
- `POST /api/interface-types/merge` — admin only. Body: `{ sourceIds: [...], targetId }`. Rewrites all junction rows + deletes source rows in a single transaction. Returns count of rewritten references.
- `DELETE /api/interface-types/:id` — admin only. Blocked unless archived AND usage = 0.

Routes exist at [web/app/api/interface-types/](../web/app/api/interface-types/). Need:
- Auth gating: all mutating routes call `isAdmin({ userId })` helper. Returns `true` in single-user mode; swap for real role check when multi-tenant lands.
- Usage count in detail response
- Archive/unarchive + merge routes (new)
- Delete guard: archived + usage=0
- Junction table queries post-migration

---

## Empty States

| Context | Message | Action |
|---|---|---|
| Interface list, no types | "No interface types defined. Create one to declare compatibility between inserts and receptacles." | "New Interface Type" (admin only) |
| Template editor, no types | Chip placeholder: "No interface types available. Ask admin." | Link `/admin/interfaces/new` if admin |
| Level editor, no types | Same | Same |
| Placement, no interface match | "Insert provides {A, B}; receptacle accepts {C}. No compatible interface." | Link edit either side |
| Placement, interface match + dim fail | "Interface matches ({A}), insert {h}mm tall; receptacle clears {eff}mm." | Link Restrict override or template dims |
| Placement, overflow exceeds rows | "Insert overflows {n} rows {down\|up}; {m} adjacent available." | Link receptacle layout |

