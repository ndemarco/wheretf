# Measure Families

Unit-aware value equivalence for parameters. Distinct from textual
synonyms — this is about values being *the same quantity expressed in
different units*, not words being interchangeable.

## Status

**Specify phase.** Not yet implemented.

---

## Why

Two users enter the same item in different units:

- "1/2 inch NPT pipe, **8 TPI**"
- "12.7 mm NPT pipe, **3.175 mm pitch**"

Those are the same item. Without unit-aware equivalence:

- Search for `thread_pitch: 3.175 mm` misses the item entered in TPI.
- Filter pills don't collapse `8 TPI` and `3.175 mm` into one facet.
- Dedup check when creating the second entry doesn't flag the
  duplicate.

Synonyms (the [taxonomy-synonyms](taxonomy-synonyms.md) spec) handle
**name equivalence** — `TPI` is a user-typed name for the
`thread_pitch` parameter. Synonyms do **not** handle
**value conversion** — 8 TPI ≠ 8 mm. This spec covers that second
piece.

---

## Goals

1. **Store one canonical value per measurement.** `thread_pitch` is
   stored in mm. User entry in TPI converts at save time.
2. **Search / filter in any unit.** User queries `8 TPI`; the query
   converts to `3.175 mm` before hitting the DB.
3. **Display in canonical by default.** Show the canonical unit in
   the grid + detail panel. Per-user or per-parameter display
   override is deferred.
4. **Validate on entry.** Reject values outside the family (can't
   put `8 TPI` into a voltage parameter).

---

## Non-goals

- **Localization of unit symbols** (cm vs centimètre) — deferred.
- **User-level display preferences** ("show me everything in
  imperial") — deferred. Canonical everywhere for v1.
- **Runtime unit swap** in the grid — one unit column per parameter,
  always canonical, for v1.
- **Exotic transforms** — log/dB, currency, dates. Out of scope.

---

## Concept

A **measure family** is a physical quantity (length, pitch, voltage,
temperature). A family owns:

- A **canonical unit** — what the DB stores.
- One or more **units** — each with a transform to/from the canonical.

### Example families (seed list)

| Family | Canonical | Other units | Transform |
|---|---|---|---|
| `length` | mm | inch, cm, m, mil | linear: `inch × 25.4`, `cm × 10`, `m × 1000`, `mil × 0.0254` |
| `pitch` | mm | TPI (threads-per-inch) | **inverse**: `mm = 25.4 / TPI` |
| `mass` | g | oz, lb, kg | linear |
| `voltage` | V | mV, kV | linear |
| `resistance` | Ω | mΩ, kΩ, MΩ | linear |
| `capacitance` | F | µF, nF, pF | linear |
| `temperature` | °C | °F, K | **affine**: `°C = (°F − 32) × 5/9`, `°C = K − 273.15` |
| `angle` | ° | rad, grad | linear |

### Transform types

- **Linear:** `canonical = factor × value`. Most cases.
- **Affine:** `canonical = factor × value + offset`. Temperature only,
  for v1.
- **Inverse:** `canonical = k / value`. TPI ↔ pitch. Also used for
  frequency ↔ period if that comes up.

No other transform types. If a user needs log/dB/currency later, that
opens a new spec.

---

## Data model

Two new tables. Parameter definitions gain one optional FK column.

```
measure_families
  id             uuid PK
  slug           text UNIQUE NOT NULL       -- 'length', 'pitch', 'temperature'
  name           text NOT NULL              -- 'Length', 'Thread pitch'
  canonical_unit_id  uuid NOT NULL FK measure_units(id) DEFERRABLE
  created_at     timestamp

measure_units
  id             uuid PK
  family_id      uuid NOT NULL FK measure_families(id)
  symbol         text NOT NULL              -- 'mm', 'inch', 'TPI', '°C'
  name           text NOT NULL              -- 'millimeter', 'threads per inch'
  transform_kind text NOT NULL              -- 'linear' | 'affine' | 'inverse'
  factor         numeric NOT NULL           -- linear scale
  offset         numeric NOT NULL DEFAULT 0 -- affine offset
  is_canonical   boolean NOT NULL DEFAULT false
  created_at     timestamp

  UNIQUE (family_id, symbol)
```

And on `parameter_definitions`:

```
ALTER TABLE parameter_definitions
  ADD COLUMN measure_family_id uuid NULL
  REFERENCES measure_families(id);
```

Nullable — not every parameter needs a family. Enums don't. Text
parameters don't. Numeric parameters without cross-unit semantics
(e.g., "number of pins") don't either.

**Stored value is always in the canonical unit.** No per-entry unit
stamp. If the user entered `8 TPI`, the row holds `3.175`; the entry
UI remembers *they typed TPI* only within the session.

---

## Entry UX

Parameter entry widgets render a **unit selector** next to the
number input when the parameter has a `measure_family_id`:

```
  [  3.175  ] [ mm ▾ ]
                 ├ mm (canonical)
                 ├ inch
                 └ TPI (inverse)
```

- Default unit on new entry = canonical.
- User picks another unit, number input is interpreted in that unit
  on save.
- After save, the displayed value re-renders in canonical (or the
  unit the user last selected — session-scoped, not persisted, for
  v1).

### Inverse units (TPI)

TPI is nonlinear. The unit selector shows "TPI" with a subtle hint
(tooltip or inline symbol) that the relationship is `pitch × TPI =
25.4`. The transform is stored in `measure_units` and applied
symmetrically on entry and display.

---

## Search / filter integration

Filter pills carry the value in canonical. When the user types an
alias of a unit (e.g., they search `8 TPI`):

1. Resolve `TPI` as a unit in the `pitch` family.
2. Convert `8` under that unit's transform → `3.175 mm`.
3. Apply the filter in mm.

Pill display: `thread_pitch: 3.175 mm` (canonical). If the user wants
to remember their input form, open question — defer.

---

## Dedup at item entry

Combined with the synonym system:

1. User types `thread_pitch: 8 TPI` while creating an item.
2. Alias resolver confirms `TPI` → `thread_pitch` parameter.
3. Unit resolver converts `8 TPI` → `3.175 mm`.
4. Dedup check: does an existing item have `thread_pitch` ≈ 3.175 mm
   (within tolerance) and the same other identifying parameters?
5. If yes, surface "this looks like `{existing item}` — use it, or
   create a new entry?"

Tolerance for float equality: `abs(a − b) / max(abs(a), abs(b),
1e-9) < 1e-6`. Tighten per-family if needed.

---

## Validation

Entry-time:
- If the parameter has a `measure_family_id`, the unit chosen must
  belong to that family. Reject otherwise.
- Numeric range checks (from `parameter_definitions.constraints`) run
  **after** conversion to canonical.

Save-time:
- Stored value is always canonical. No unit column on item
  parameter values.

---

## Seed coverage

Ship the families above (length, pitch, mass, voltage, resistance,
capacitance, temperature, angle). Assign `measure_family_id` to
existing parameters in `db/seed.ts`:

- `length` → `length` family (canonical mm)
- `thread_pitch` → `pitch` family (canonical mm)
- `voltage_rating` → `voltage` family
- `resistance` → `resistance` family
- `capacitance` → `capacitance` family
- `temp_rating` → `temperature` family
- `weight` → `mass` family

Text/enum parameters (`material`, `head_type`, `drive_type`,
`package`, `color`, `tolerance`, `gauge`) stay `measure_family_id =
NULL`.

---

## Open questions

1. **Tolerance per family.** Temperature tolerance of 1e-6 is absurd;
   voltage of 1e-6 is probably fine. Per-family tolerance override?
2. **Remembering user's entered unit.** Session-scoped vs
   user-preference-persisted. Defer. Canonical-only display is the v1
   bar.
3. **Unit symbol ambiguity.** `T` means tesla or tons? `m` means
   meter or milli-? We control the symbol registry so we avoid
   collisions by seeding clean, unambiguous symbols. No user-created
   units in v1.
4. **Imperial + metric display in one cell** (e.g., show
   `3.175 mm (1/8")`). Nice-to-have. Defer.

---

## Related

- [taxonomy-synonyms.md](taxonomy-synonyms.md) — name aliasing, the
  sibling problem. Synonyms + measure families together cover the
  full cross-trade vocabulary + cross-unit entry story.
- [item-parametric-model.md](item-parametric-model.md) — parameter
  data types, constraints, unit declarations (existing spec — this
  doc formalizes the unit layer).
