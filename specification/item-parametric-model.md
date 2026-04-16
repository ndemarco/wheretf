# Item Parametric Model — Design Discussion

## First Principle

**Parameters are elemental physical properties, globally scoped, with no domain semantics.** Pitch is pitch — whether on a propeller, a screw thread, or a pipe fitting. Length is length. Mass is mass. A parameter definition describes a measurement, not a use case.

Domain constraints (pipes don't come in 80 TPI) are properties of the domain, not of the parameter. Those constraints live in standards. Search narrowing by domain uses categories and aspects as filters layered on top of global parameter queries.

**Designations are the primary affordance, not standards.** Users pick "M3" or "#8-32" or "0603" — they don't pick "ISO 261" or "JEDEC." Standards are backstage plumbing: they power the lookup tables that resolve a designation to parameter values. The standard name is available as metadata (for reference, filtering, disambiguation) but is never required knowledge for ordinary use.

---

## The Pattern

Physical goods are manufactured to standards. A standard defines a table of valid designations, each mapping to a set of parameter values. Picking a designation determines those values.

Examples:
- UNC threading: designation "#8-32" → pitch=32 TPI, major_dia=0.164", minor_dia=0.1302"
- SMD packages: designation "0603" → length=1.6mm, width=0.8mm, height=0.45mm (NOTE: SMD packages exist in both imperial and metric designations — there's a 0603M package also)
- Wire gauge: designation "18 AWG" → diameter=1.024mm, resistance=20.95 Ω/km, ampacity=16A (NOTE: Wire gauges also exist in metric, indicating cross-sectional area in mm²)
- Bearings: designation "6201" → bore=12mm, OD=32mm, width=10mm
- O-rings: designation "AS568-210" → ID=19.99mm, cross_section=3.53mm

The pattern: **standard + designation → parameter values**.

---

## Core Concepts

### Parameter Definition

The atomic unit. A physical measurement: name, dataType, unit. System-wide, unique by name. No domain semantics, no aspect scoping.

Examples: pitch (numeric, mm/thread), length (numeric, mm), major_diameter (numeric, mm), resistance (numeric, Ω/km), tapered (boolean), drive_type (enum: cross, slotted, hex, square, star, spanner, ...), drive_system (enum: Phillips, Pozidriv, Torx, Robertson, ...), drive_size (numeric, mm).

Each parameter definition declares a **canonical unit** — the single unit used for storage and comparison, always SI. All values are normalized to SI internally, enabling global queries ("all items with length < 10mm") without unit conversion at query time.

Parameters have optional constraints (min, max, enumValues) that reflect physical limits of the measurement itself, not domain-specific valid ranges.

### Value Representation

Numeric parameter values carry three fields:

```
{
  "value": 12.7,           // canonical, in the parameter's declared unit (mm)
  "source_value": "1/2",   // as entered or as defined by the standard
  "source_unit": "in"      // the original unit system
}
```

**`value`** is what the system queries, compares, and indexes. It is always in the parameter's canonical unit.

**`source_value` + `source_unit`** preserve the original representation. "1/2 inch pipe" displays as "1/2″" — not "12.7mm" — because that's how the domain identifies it. The source fields are display-only; they never participate in search or comparison.

This applies everywhere parameter values appear:
- `item_parameter_values.value` (JSONB) stores the compound representation
- `standard_designations.values` (JSONB) stores compound values per parameter in the lookup table

Trade designations that aren't real measurements (pipe nominal sizes, wire gauge numbers) are handled by making the designation string itself the human label. The parameter values behind it are the actual physical measurements. "1/2 inch pipe" is the designation; the `values` contain OD=0.840", ID=0.622" in canonical units with source representations preserved.

Non-numeric parameters (boolean, text, enum) store `value` only — no unit conversion applies.

### Unit Conversion

Each parameter definition declares a canonical unit (always SI). Source values in other units must be converted before storage. Conversions fall into three categories:

**Direct scaling** — multiply by a constant.
- inches → mm: `value * 25.4`
- feet → m: `value * 0.3048`
- ounces → grams: `value * 28.3495`
- mil (thou) → mm: `value * 0.0254`

**Inverse conversion** — the source unit measures the reciprocal of the canonical unit.
- TPI (threads per inch) → mm/thread: `25.4 / value`
- Gauge numbers (AWG) → mm diameter: lookup table (non-linear, no formula)

TPI is a count-per-length unit; the canonical SI representation of pitch is distance-per-thread (mm). A #8-32 screw at 32 TPI stores `pitch.value = 0.79375` (mm/thread), with `source_value = "32"`, `source_unit = "TPI"`. Searching "pitch < 1mm" returns fine-thread fasteners regardless of whether they were entered as TPI, mm, or metric pitch.

**Non-linear formula** — a formula exists but it is not a simple ratio.
- AWG → diameter: `diameter_mm = 0.127 × 92^((36 - n) / 39)` (geometric progression)
- Cross-section and resistance derive from diameter.
- AWG gauge numbers are not measurements — they are designation labels. But unlike truly arbitrary designations, the underlying values are computable.

The parameter definition stores which conversion category applies. The system must know how to round-trip: given `source_value` + `source_unit`, compute `value`; given `value` + `source_unit`, recover `source_value` for display. For inverse conversions, the formula is its own inverse. For lookup-only, both directions require the table.

### Aspect

A domain grouping that references parameter definitions and optionally contains standards. Aspects define the interface — "these are the parameters that describe this facet of an item."

Examples:
- "Machine Screw Threading" → parameters: pitch, major_dia, minor_dia, thread_angle, class_of_fit
- "Pipe Threading" → parameters: pitch, major_dia, minor_dia, thread_angle, tapered
- "SMD Package" → parameters: length, width, height, lead_count
- "Fastener Drive" → parameters: drive_type, drive_system, drive_size
An aspect can have zero standards (freeform — user enters values manually) or multiple standards (user picks one, values cascade from lookup).

### Standard

A named classification system belonging to an aspect. Carries a lookup table of designations → parameter values. The standard provides the domain constraints — which combinations of values are valid.

Examples:
- Standard "UNC" (belongs to "Machine Screw Threading") → designations: #4-40, #6-32, #8-32, ...
- Standard "NPT" (belongs to "Pipe Threading") → designations: 1/8"-27, 1/4"-18, 1/2"-14, ...
- Standard "ISO 261" (belongs to "Machine Screw Threading") → designations: M3x0.5, M4x0.7, ...
- Standard "JEDEC" (belongs to "SMD Package") → designations: 0603, 0805, SOT-23, SOT-223, ...
- Standard "Phillips" (belongs to "Fastener Drive") → designations: #0, #1, #2, #3, #4
- Standard "Torx" (belongs to "Fastener Drive") → designations: T6, T8, T10, T15, T20, T25, ...

A standard's parameters are a subset of its parent aspect's parameters. The standard may not cover all of them — uncovered parameters remain user-entered.

### Designation

A specific entry within a standard. Maps to concrete parameter values.

- Belongs to one standard
- Has a display name (the designation string) — this is the trade label, which may not be a real measurement (e.g., "1/2 inch" for pipe nominal size)
- Carries a values map: parameter_definition_id → compound value ({ value, source_value, source_unit })

---

## Hierarchy

```
Aspect: Machine Screw Threading
  ├─ parameters: pitch (mm), major_dia (mm), minor_dia (mm), thread_angle (°), class_of_fit (enum)
  ├─ Standard: UNC
  │    ├─ #4-40  → { pitch: {v:0.635, src:"40", su:"TPI"}, major_dia: {v:2.845, src:"0.112", su:"in"}, ... }
  │    ├─ #8-32  → { pitch: {v:0.794, src:"32", su:"TPI"}, major_dia: {v:4.166, src:"0.164", su:"in"}, ... }  // 25.4/32 = 0.794 mm/thread
  │    └─ ...
  ├─ Standard: UNF
  │    └─ ...
  └─ Standard: ISO 261
       ├─ M3x0.5 → { pitch: {v:0.5, src:"0.5", su:"mm"}, major_dia: {v:3.0, src:"3.0", su:"mm"}, ... }
       └─ ...

Aspect: Pipe Threading
  ├─ parameters: pitch (mm), major_dia (mm), minor_dia (mm), thread_angle (°), tapered (boolean)
  ├─ Standard: NPT
  │    ├─ 1/2"-14 → { pitch: {v:1.814, src:"14", su:"TPI"}, major_dia: {v:21.336, src:"0.840", su:"in"}, tapered: true }
  │    └─ ...
  └─ Standard: BSPT
       └─ ...

Aspect: SMD Package
  ├─ parameters: length (mm), width (mm), height (mm), lead_count (numeric)
  ├─ Standard: JEDEC
  │    ├─ 0603  → { length: {v:1.6, src:"0603", su:"JEDEC"}, width: {v:0.8}, height: {v:0.45}, lead_count: {v:2} }
  │    ├─ SOT-23 → { length: {v:2.9}, width: {v:1.3}, height: {v:1.0}, lead_count: {v:3} }
  │    └─ ...
  └─ Standard: IPC
       └─ ...

Aspect: Fastener Drive
  ├─ parameters: drive_type (enum), drive_system (enum), drive_size (mm)
  ├─ Standard: Phillips
  │    ├─ #0 → { drive_type: "cross", drive_system: "Phillips", drive_size: {v:2.0, src:"#0"} }
  │    ├─ #2 → { drive_type: "cross", drive_system: "Phillips", drive_size: {v:5.0, src:"#2"} }
  │    └─ ...
  ├─ Standard: Torx
  │    ├─ T10 → { drive_type: "star", drive_system: "Torx", drive_size: {v:2.74, src:"T10"} }
  │    ├─ T25 → { drive_type: "star", drive_system: "Torx", drive_size: {v:4.43, src:"T25"} }
  │    └─ ...
  └─ Standard: Pozidriv
       ├─ #2 → { drive_type: "cross", drive_system: "Pozidriv", drive_size: {v:5.0, src:"#2"} }
       └─ ...
```

Note: "pitch" and "major_dia" appear in multiple aspects. They are the same parameter definitions — not copies. Values on items are stored once per parameter per item, globally scoped. Canonical units are SI (mm for pitch as distance between threads, mm for diameters, ° for angles). Source representations preserve the original domain notation (TPI, inches) for display.

---

## Proposed Schema

```
standards
  id              uuid PK
  name            text UNIQUE NOT NULL    -- "UNC", "ISO 261", "AWG"
  aspect_id       uuid FK → aspects       -- the aspect this standard belongs to
  description     text
  created_at      timestamp
  updated_at      timestamp

standard_parameters
  id                        uuid PK
  standard_id               uuid FK → standards
  parameter_definition_id   uuid FK → parameter_definitions
  role                      text NOT NULL  -- "key" | "derived" | "info"
  sort_order                integer
  UNIQUE(standard_id, parameter_definition_id)

standard_designations
  id              uuid PK
  standard_id     uuid FK → standards
  designation     text NOT NULL           -- "#8-32", "M3x0.5", "0603"
  values          jsonb NOT NULL          -- { param_def_id: { value, source_value, source_unit }, ... }
  metadata        jsonb                   -- notes, aliases, cross-references
  UNIQUE(standard_id, designation)

item_standards
  id              uuid PK
  item_id         uuid FK → items
  standard_id     uuid FK → standards
  designation_id  uuid FK → standard_designations  -- NULL if non-standard/custom
  is_custom       boolean DEFAULT false   -- true if user overrode derived values
  created_at      timestamp
  UNIQUE(item_id, standard_id)
```

Existing tables unchanged:
- `parameter_definitions` — atomic specs, globally scoped
- `aspects` — domain groupings referencing parameters
- `aspect_parameters` — join: which parameters belong to which aspects
- `item_aspects` — aspect applied to item
- `item_parameter_values` — actual values, stored per item per parameter as compound representation ({ value, source_value, source_unit }). Populated manually or from standard lookup.

---

## User Flow

### Applying an aspect with standards

1. User selects item, clicks "Add Aspect"
2. Picker shows available aspects
3. User selects "Machine Screw Threading"
4. Aspect is applied. System shows its parameters with empty value slots.
5. System also shows available standards for this aspect: UNC, UNF, ISO 261
6. User picks "UNC" → designation picker appears with searchable list
7. User picks "#8-32" → system fills derived parameter values from lookup
8. Uncovered parameters (class_of_fit) remain for manual entry
9. User can override any derived value — system flags it as custom

### Applying a freeform aspect

1. User selects "Physical Dimensions"
2. No standards available — empty parameter slots appear
3. User fills in length, width, height manually

### Search

- "All items with pitch < 10" → global parameter query, returns pipes and screws
- "All items with pitch < 10 in category Fasteners" → parameter + category filter
- "All items with Machine Screw Threading aspect and pitch < 10" → parameter + aspect filter
- "All UNC #8-32 items" → standard + designation filter

---

## Access Control Boundaries

The model must support tiered access at the data layer:

- **Standard names, designation strings, parameter definition names**: low-privilege data. Required for search and identification.
- **Structured parameter values within a designation (the `values` JSONB)**: high-privilege data. The parametric breakdown is the catalog's deep value.
- **Full designation tables (all entries for a standard)**: must never be returned in a single API call. Pagination and per-account rate limiting required regardless of privilege tier.

The `values` JSONB on `standard_designations` is a discrete, gatable field. The API layer can return designation records with or without it based on caller privilege.

---

## Resolved Questions

### 1. Parameter value storage for standard-derived values

**Leaning Option B** — computed at read time from the designation reference. Lookup updates propagate automatically. Revisit in detail during implementation; may need caching or materialized views for performance.

### 2. Compound designations

Decompose in the data model. "M3x0.5x10" is two standards applied to one item: threading (M3x0.5) + geometry (10mm length). Reconstitute for display — the user sees "M3x0.5x10" but the system stores two separate standard/designation pairs.

### 3. Standard families

Flat with a domain tag. UNC and UNF both tagged "Unified Thread Standard" but no parent/child hierarchy. Can revisit if grouping becomes necessary.

### 4. Designation aliases

No alias table. AI handles fuzzy matching of "#8-32" / "8-32" / "#8-32 UNC" / "No. 8-32" at the search/input layer.

### 5. Lookup table population

Out of scope for this spec. Pipeline design (system seeds, admin entry, community contribution, bulk import) is a separate concern.

### 6. Cross-standard equivalence

No equivalence mappings in the data model. If cross-standard matching becomes necessary (e.g., "#8-32 UNC" ≈ "M4x0.7"), it belongs in the AI layer.

---

## What This Means for Existing Code

### Migration path

- `aspects` and `aspect_parameters` unchanged
- New tables: `standards`, `standard_parameters`, `standard_designations`, `item_standards`
- `item_parameter_values` unchanged — both standards and aspects write to it
- Existing seed data: "Threading" aspect stays, gains standards beneath it. "Dimensions" stays freeform.

### UI impact

- Item detail: aspects now optionally show available standards with designation pickers
- Taxonomy admin: new Standards section for creating standards and managing lookup tables within aspects
- Search: global parameter queries + category/aspect narrowing

### API impact

- New endpoints: `/api/standards`, `/api/standards/[id]/designations`
- Item endpoints: apply standard + designation to item
- Search: filter by parameter values globally, narrow by category/aspect/standard
