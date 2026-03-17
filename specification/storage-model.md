# Storage Model Specification

This document defines the foundational data model for WhereTF's storage system. It was developed through interactive design sessions and represents the agreed-upon concepts, terminology, and relationships.

## Global Points
- All names, labels, and descriptions are UTF-8 and unrestricted.
- The system imposes no character restrictions on user-supplied text.
- Display formatting and internal representation are separate concerns.

---

## Glossary

### Module
A top-level, independent physical storage unit. Has a user-chosen name, a description, and a single primary dimension. Modules are never nested inside other modules. Spatial relationships between modules (e.g., "NEON lives under the workbench") are descriptive metadata, not structural.

A module's primary dimension defines its top-level locations (e.g., 11 levels, 16 drawers, 3 named sections). Each of those locations is either a **receptacle** or has **fixed** sub-structure (see Location Types below).

Examples: a red cabinet (MUSE), an IKEA ALEX drawer unit, a shelving unit.

### Template
An abstract blueprint representing a real storage product, including a user's custom design. Defines positions, their arrangement, and physical constraints. Templates are never modified by instance data — they remain pristine reference definitions.

Storage is always a 2D array.

A template defines:
- **Origin** — which position is the reference point
- **Primary axis** — orientation for insert compatibility and labeling direction
- **Labeling scheme** — how positions are named (numeric, alpha, row-col, custom)
- **Positions** — the arrangement and count
- **Subdivision options** — ways positions can be divided, including the labels for resulting child positions
- **Physical constraints** — soft limits (warn) and hard limits (block) on dimensions or other physical properties (e.g. powders, liquids, gases, spools, rolls)
- **Interface types accepted** — what inserts this template's positions can receive (if any)
- **Interface type provided** — what receptacle type this template fits into (for insert templates)

Templates carry a fixed structural core plus extensible metadata with no prescribed shape. Photos, manufacturer details, product numbers, physical dimensions, weight capacity, material — whatever is useful.

There are two kinds of templates:
- **Fixed templates** — represent a specific product with a fixed layout. A Plano 3600 Stowaway is always 4 rows × 6 columns.
- **Parametric templates** — represent a system with a standard unit, instantiated at user-specified dimensions. A Gridfinity baseplate defines the 42mm grid unit; the user specifies N×M at instantiation. Parametric templates define their unit, constraints (min/max grid size), and labeling scheme. The user supplies dimensions when applying the template.

#### Template Versioning

Templates are versioned. Each version is immutable once published. When a template is applied to an insert or a fixed location, the instance records which version it was applied from.

- Editing a template publishes a new version. Existing instances stay on their applied version.
- Updating deployed instances to a newer version is an explicit operation — preview structural changes, resolve conflicts (broken overrides, displaced assignments), then apply.
- Version history is append-only. Old versions are never deleted, even when no instances reference them. They remain accessible for undo, audit, and instantiating older product models.
- The UI presents a template as a single entity with a current version. Version history is a detail view, not a primary interaction.

Examples: Plano 3600 Stowaway (fixed), Gridfinity baseplate (parametric), Akro-Mils 10116 16-drawer cabinet (fixed).

### Position
An abstract place defined within a template. Has no path, holds no items. A position is a blueprint concept only. When a template is applied to a module, each position becomes a location.

### Location
A concrete, addressable place within a module instance. Has a path. Created when a template is applied to a module location, when a location is divided, or when a module's primary dimension is defined.

A location is either:
- A **leaf** — can hold item assignments
- A **parent** — has child locations, cannot directly hold item assignments

There is no special term for a parent location. It is simply a location with children.

#### Location Types

Every location that can have sub-structure is one of two types:

**Receptacle** — an empty location that accepts inserts. It declares an interface type (e.g., "plano-3600", "gridfinity-42mm"). Sub-locations are created by whatever insert occupies it. The insert is movable — it can be removed, replaced, or relocated to another compatible receptacle.

Example: a MUSE shelf level is a receptacle that accepts Plano-compatible inserts. A Plano box can be relocated to any other compatible receptacle, or replaced with any insert that provides the same interface type.

**Fixed** — sub-structure is defined directly on the module or by a template applied permanently. The structure is built-in and not relocatable.

Example: an ALEX drawer unit's 9 drawers are fixed — they are part of the furniture. A Gridfinity baseplate layout inside an ALEX drawer is also fixed — once configured, the baseplate grid is structural.

A location is one or the other. A receptacle's sub-structure comes from its insert. A fixed location's sub-structure comes from the module's own configuration or a permanently applied template.

### Insert
A distinct physical object that occupies one or more receptacle locations and provides its own internal locations. Each insert is an individual instance — if you own 8 Plano boxes, each is a separate insert record, potentially with different overrides.

Key properties:
- **Relocatable as a unit** — moving an insert carries all its internal structure, overrides, and assignments to the new receptacle location
- **Overrides live on the insert** — structural modifications (merged cells, divided compartments, disabled positions) describe the physical state of this specific object, not the receptacle it sits in
- **Footprint** — how many receptacle locations the insert occupies (e.g., a Gridfinity 2×1 bin spans two baseplate positions)
- **Must respect origin and primary axis alignment** of the receptacle

An insert can be configured:
- **Template-based** — references a template, as-is
- **Template with overrides** — references a template, with structural modifications layered on top
- **Structurally defined** — custom internal layout, no template reference

An insert can exist unassigned — a new Plano box not yet placed in any module.

Compatibility between inserts and receptacles is governed by interface types (see below). Placement is rejected unless the insert provides an interface type the receptacle accepts.

Examples: a Plano box on a MUSE shelf level, a Gridfinity bin on a baseplate.

### Interface Type
A named physical contract that governs compatibility between inserts and receptacles. Defines the form factor boundary — what fits into what.

An interface type specifies:
- **Identifier** — a unique name (e.g., "plano-3600", "gridfinity-42mm")
- **Physical contract** — the dimensional and mounting constraints the name represents (footprint, attachment mechanism, clearance requirements)
- **Directionality** — a template either *provides* an interface type (insert side: "I fit into plano-3600 receptacles") or *accepts* one (receptacle side: "I accept plano-3600 inserts"), never both on the same boundary

Compatibility rules:
- Placement of an insert into a receptacle is **strictly validated** — the insert must provide an interface type that the receptacle accepts. No implicit compatibility.
- Multiple insert templates can share the same interface type (e.g., several third-party organizers that all fit the Plano 3600 form factor).
- A receptacle can accept multiple interface types if physically compatible.
- Interface types are system-defined, not user-created. Users select from known types when configuring templates.

### Item
What a thing is, independent of where it is. Has a name, description, and parameters (key/value/unit triples, images). Represents a type or category, not an individual instance or count.

Items can exist at multiple locations via multiple assignments. An item at two locations is one item definition with two assignments — referential, not duplicative.

Item definitions must be unambiguous within the user's collection. Adding a similar item may require refining an existing item's definition (adding parameters, sharpening the name) to maintain distinguishability. Definitions become progressively more detailed as the collection grows.

Equivalent to a product in ERP systems (e.g., Odoo). Future integration with ERP systems is a design guardrail. The deep detail of item management (supplier info, datasheets, equivalents) should be abstracted to a separate concern — an ERP system or a simpler standalone tool for home workshop users.

Examples: "10k 0805 resistor", "M3x10 socket head cap screw", "CA glue", "3D printer filament", "14 AWG stranded red wire".

### Assignment
The relationship between an item and a location. "This item is assigned to this location."

An assignment is either **placed** or **provisional**:

**Placed** — the item occupies a specific leaf location. Subject to the one-per-location rule (with co-storability exceptions). This is the normal, organized state.

**Provisional** — the item is *at* a location but not *in* a specific position. The item is physically present somewhere within that location's scope, but the user hasn't specified (or doesn't care about) the exact position. Valid at any level in the hierarchy, including parent locations.

Example: "Resistors are on MUSE 3" — the user set them on the shelf level but hasn't sorted them into a grid cell yet. The system answers "where are my resistors?" with "MUSE 3, unplaced." Later refinement to `MUSE 3 / B4` converts the provisional assignment to a placed one.

Provisional assignments:
- Are queryable and appear in search results, clearly marked as unplaced
- Do not occupy a position — they don't block placed assignments in child locations
- Create organizational pressure but don't force immediate resolution
- Are not subject to the one-per-location rule (a parent can have multiple provisional items)

Multiple placed assignments per location are allowed when items are co-storable — related items that are practical to store together and separated at time of use. This avoids expanding storage capacity unnecessarily for items whose differences are easily discerned by hand.

Example: M3x10 SHCS in black oxide and bright zinc in one bin (finish is obvious at a glance). Maintaining separate locations for every permutation of drive, length, thread, head, and finish becomes impractical.

Co-storability is an item-level relationship. Items declare which other items they can share a location with. The system must surface co-stored items clearly so the user knows a location contains multiple items.

### Subdivision
Any location can be subdivided into named child locations. There are two forms:

**Template-defined** — a subdivision option on a template, often corresponding to a physical accessory. The option defines the labels for the resulting child locations. Example: the Akro-Mils 40716 divider splits a drawer into "front" and "rear" — those labels are part of the subdivision option, not user-supplied.

**Ad-hoc** — the user splits a location informally, specifying the number of children and their labels. No template or accessory required. Example: a piece of cardboard divides a bin into "left" and "right."

In both cases, the original location becomes a parent and is no longer a valid assignment target. See the Divide override for prerequisites.

---

## Override Types

Overrides are structural modifications that deviate from a template's default layout. There are three types: Merge, Divide, and Disable.

Overrides can apply to:
- **An insert** — describes the physical state of that specific object. Moves with the insert when relocated. (e.g., "this Plano box has cells 3 and 4 merged")
- **A module location** — describes the physical state of the module itself. Stays with the module. (e.g., "this shelf slot is damaged")

### Merge
Combine two or more adjacent locations into a single location.

- Target locations must be adjacent and form a contiguous region (not necessarily rectangular — L-shapes and other contiguous arrangements are valid)
- Templates may constrain which axes allow merging. Example: a Plano 3600's rows are molded walls — columns can be merged within a row, but rows cannot be merged across.
- The merged location's path uses the position closest to the template-defined origin
- Non-origin locations become **aliases** that redirect to the origin location (e.g., querying col-4 returns col-3's contents when merged with col-3)
- Prerequisite: assignments at affected locations must be migrated or removed before merging. Strictly enforced.

### Divide
Split a single location into child locations.

- Can apply a subdivision option defined on the template
- Can apply an insert's template
- Can define a custom ad-hoc split (user specifies number of children and their labels)
- The subdivision option, insert template, or user input defines the labels for the resulting child locations
- The original location becomes a parent and is no longer a valid assignment target
- Prerequisite: existing assignment must be reassigned to a child location, reassigned elsewhere, or unassigned. The operation cannot complete with unresolved assignments. Strictly enforced.

### Disable
Mark a location as unavailable for assignment.

- Reason is optional (descriptive text: "cracked divider", "reserved for tool")
- The location still exists in the structure but cannot hold assignments
- Reversible — enable restores availability
- Prerequisite: existing assignment must be reassigned or unassigned. Strictly enforced.

---

## Path Structure

### Internal Representation (immutable convention)

Paths have three layers. The internal and serialized forms are fixed and must never change.

**Source of truth:** ordered array of segments. No delimiter, no encoding issues.
```
["MUSE", "3", "B4"]
["ALEX", "4", "B2", "Front"]
```

**Serialized form:** colon-delimited string for storage, indexing, and prefix queries. Colons have near-zero collision with workshop nomenclature (part numbers, dimensions, fastener specs). Segments must not contain colons.
```
MUSE:3:B4
ALEX:4:B2:Front
```

### Display Formats (flexible, may evolve)

User-facing display is a separate concern from internal representation.

**Brief** — compact, optimized for scanning and speech:
```
MUSE 3 / B4
ALEX 4 / B2 / Front
```

**Verbose** — explicit dimension labels for clarity:
```
MUSE 3 / Row B, Col 4
ALEX Drawer 4 / Row B, Col 2 / Front
```

Display formatting rules:
- Module name + primary dimension value are space-separated: `MUSE 3`
- Sub-dimension boundaries use slash: `/`
- Grid cells use row-letter + column-number notation: `B4` (row B, column 4)
- Dimension labels (Row, Col, Drawer) come from the template's labeling scheme
- The number immediately following a module name always indicates the primary dimension value
- Default labeling convention: rows are alpha (A, B, C, ...) top-to-back, columns are numeric (1, 2, 3, ...) left-to-right. Origin is top/back, left side.

### Spoken Form
Paths are designed to be naturally speakable: "Muse 3, B-4" or "Alex 4, B-2, front." No delimiters are verbalized.

### Path Behavior Under Overrides

**Merge:** Non-origin paths become aliases redirecting to the merged location's origin path. Querying an alias returns the origin location's data.

**Divide:** The divided location's path is no longer valid for assignment. Child location paths extend the parent path with labels from the subdivision option or insert template.

**Disable:** Path remains valid and addressable but the location is marked unavailable for assignment.

---

## How Templates Create Locations

Templates create child locations in two distinct ways, matching the two location types:

**Via insert (receptacle locations)** — placing an insert into a receptacle creates child locations defined by the insert's template. The insert is a physical instance; the template defines its structure. Example: placing a Plano 3600 insert into MUSE level 3 creates a 4×6 grid of child locations under that level.

**Via direct application (fixed locations)** — applying a template permanently to a module location creates built-in child locations. Example: applying a Gridfinity baseplate template to ALEX drawer 3 with dimensions 6×4 creates a fixed 6×4 grid.

For parametric templates, the user supplies dimensions at application time.

### Template Limits
Templates define physical constraints on their dimensions:
- **Soft limits** — warn the user ("This exceeds the Plano 3600's standard layout — are you using a modified insert?")
- **Hard limits** — block the configuration ("A Plano 3600 physically cannot have more than 6 columns")

### Changing Structure
Removing an insert from a receptacle removes its child locations. Replacing a fixed template on a module location is a destructive reconfiguration. In both cases, existing assignments under the affected location must be resolved first.

---

## Concrete Examples

### MUSE (Red Cabinet with Shelf Levels)

MUSE is a cabinet with 11 levels. Each level is a **receptacle** that accepts Plano-compatible inserts.

```
Module: MUSE
  Primary dimension: level (1-11)

  Location: level 1          ← receptacle (accepts: plano-3600)
    Insert: plano-box-001    ← a specific Plano 3600 instance
      Location: A1           ← leaf, can hold an assignment
      Location: A2
      ...
      Location: D6

  Location: level 4          ← receptacle
    Insert: plano-box-004    ← another Plano 3600 instance which happens to have overrides
      Location: A1
      Location: A2
      Location: A3+A4        ← merged (override on this insert)
      Location: A5
      Location: A6
      ...

  Location: level 10         ← receptacle, currently no insert
                              ← leaf by default, can hold an assignment directly
                                ("Construction Screws are on level 10")
```

Moving plano-box-004 from level 4 to level 10: the insert, its overrides, and all its assignments relocate as a unit. Level 4 becomes an empty receptacle. Level 10's direct assignment (if any) must be resolved first.

### ALEX (IKEA Drawer Unit with Gridfinity)

ALEX has 9 drawers. Drawers are **fixed** — they are part of the furniture. Inside some drawers, a Gridfinity baseplate layout is configured, which becomes fixed for our purposes. Gridfinity bins sit on the baseplate as **inserts**.

```
Module: ALEX
  Primary dimension: drawer (1-9)

  Location: drawer 3                 ← fixed (module-defined)
    Location: A1                     ← fixed (GF baseplate grid, parametric 6×4)
      Insert: gf-2x1-3comp-017      ← a specific GF 2×1 bin with 3 compartments
        Location: comp 1             ← leaf
        Location: comp 2             ← leaf
        Location: comp 3             ← leaf
    Location: A3                     ← next baseplate position (bin spans 2 cols)
      Insert: gf-1x1-bin-042        ← a specific GF 1×1 bin, single compartment
        Location: (single cell)      ← leaf
    ...

  Location: drawer 7                 ← fixed, no baseplate configured
                                     ← leaf, can hold an assignment directly
```

### AKRO (Akro-Mils Small Parts Cabinet)

AKRO has 16 drawers in a fixed layout. Some drawers have been divided using divider accessories.

```
Module: AKRO
  Primary dimension: drawer (1-16)
  Template: Akro-Mils 10116 (fixed, defines 16 drawer positions)

  Location: drawer 1                  ← fixed (module-defined)
                                      ← leaf, single undivided compartment

  Location: drawer 7                  ← fixed
    Override: divide (using 40716 divider → front + rear)
      Location: front                 ← leaf
      Location: rear                  ← leaf

  Location: drawer 12                 ← fixed
    Override: disable (reason: "cracked drawer, on order")
```

---

## Established Points with Rationales

### Modules are always top-level
Modules do not nest. This keeps the model simple and avoids recursive module resolution. Physical containment relationships (a drawer unit inside a workbench) are captured as metadata today. A future construct may formalize inter-module relationships without introducing nesting.

### Items are independent of locations
Items and locations are distinct entities connected by assignments. This separation supports multiple assignments per item, future ERP integration, and clean relocation semantics.

### One assignment per location, with co-storability
The default is one item per location. Multiple assignments are allowed only when items are co-storable — related items that are practical to store together and separated at time of use. Co-storability is an item-level relationship, not a location property. The system must surface co-stored items clearly so the user knows a location contains multiple items.

### No item compatibility constraints (deferred)
Storage medium types (binned, racked, bulk) and item/location compatibility validation are recognized as valuable but deferred. The model can accommodate these as template and item metadata when needed.

### No quantity tracking
The system answers "where is it?" not "how many?" An item represents a category, not a count. Inventory tracking, including counts, is the domain of ERP (e.g., Odoo-based Charm).

### Progressive organization via provisional assignments
Items can be provisionally assigned at any level in the hierarchy, including parent locations. Assigning to `MUSE 3` without specifying a grid position creates a provisional assignment — the item is at that level, position undetermined. Refining to `MUSE 3 / B4` converts it to a placed assignment. This supports the real-world workflow of setting items down now and organizing later, without violating the structural rules for placed assignments.

### Compatibility via interface types
Insert/receptacle compatibility is strictly enforced through named interface types. A template declares what interface type it provides (insert side) and/or accepts (receptacle side). Placement is rejected on mismatch. Multiple insert types can share an interface type. Interface types are system-defined, not user-created.

### Templates are pristine and versioned
Templates are never modified by instance data. Overrides live on inserts or module locations. Templates are versioned — editing publishes a new version; existing instances stay on their applied version. Updating instances to a newer version is an explicit operation with conflict resolution. Version history is append-only.

### No linking between levels
Each module location independently references its template. Batch operations ("apply this template to levels 2-5") are a UI/API convenience, not a data model concept. This keeps the data model simple.
