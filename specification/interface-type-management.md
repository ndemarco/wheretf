# Interface Type Management — UI/UX Spec

Admin CRUD for interface types. Integration points on templates + receptacles.

See [storage-model.md](storage-model.md) for the concept + UI configuration.

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

Shipped: admin CRUD at `/admin/interfaces`, template + level chip
pickers, junction tables, archive / merge lifecycle with template
re-versioning, unit-system modular display.

Out:
- Structured geometric contracts — deferred
- User-submitted types + approval workflow — deferred
- Per-org namespaces — interface types are system-global

Access: CRUD admin-only (single-user = admin; multi-tenant future =
WhereTF staff). Chip pickers open to all users.

---

## Load-bearing invariants

- **Reference by UUID, never identifier.** `interface_types.id` is the
  join key; `identifier` (`plano-3600`) is a mutable display slug.
  Never join on identifier in code or migrations. This is what makes
  rename + merge safe. Comment in the schema file preserves it.
- **Storage is always mm.** `interfaceTypes.unitSystem` is a display/
  input convenience only. Templates without dims are normal — null
  per-axis is fine. User rules the storage.
- **Stable is terminal.** Maturity state machine is
  `draft → stable → archived → deleted`. Demoting stable to draft is
  blocked (ambiguous for existing references). Unused stable types
  archive instead.
- **Merge mints new template versions.** Interfaces are versioned
  properties of templates. Merging rewrites junction rows and emits a
  new version per affected template in the same transaction.

