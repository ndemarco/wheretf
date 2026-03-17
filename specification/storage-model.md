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
- **Physical constraints** — soft limits (warn) and hard limits (block) on dimensions
- **Interface types accepted** — what inserts this template's positions can receive (if any)
- **Interface type provided** — what receptacle type this template fits into (for insert templates)

Templates carry a fixed structural core plus extensible metadata with no prescribed shape. Photos, manufacturer details, product numbers, physical dimensions, weight capacity, material — whatever is useful.

There are two kinds of templates:
- **Fixed templates** — represent a specific product with a fixed layout. A Plano 3600 Stowaway is always 4 rows × 6 columns.
- **Parametric templates** — represent a system with a standard unit, instantiated at user-specified dimensions. A Gridfinity baseplate defines the 42mm grid unit; the user specifies N×M at instantiation. Parametric templates define their unit, constraints (min/max grid size), and labeling scheme. The user supplies dimensions when applying the template.

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

**Receptacle** — an empty location that accepts inserts. It declares an interface type (e.g., "plano-shelf-slot", "gridfinity-42mm"). Sub-locations are created by whatever insert occupies it. The insert is movable — it can be removed, replaced, or relocated to another compatible receptacle.

Example: a MUSE shelf level is a receptacle. A Plano box is placed into it. Tomorrow the Plano box could be moved to a different level, or swapped for a different organizer.

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

Compatibility between inserts and receptacles is modeled as a relationship: the insert's template declares an interface type it provides ("I fit into: gridfinity-42mm"), and the receptacle declares an interface type it accepts ("I accept: gridfinity-42mm"). Multiple insert types can share the same interface type.

Examples: a Plano box on a MUSE shelf level, a Gridfinity bin on a baseplate.

### Item
What a thing is, independent of where it is. Has a name, description, and parameters (key/value/unit triples, images). Represents a type or category, not an individual instance or count.

Items can exist at multiple locations via multiple assignments. An item at two locations is one item definition with two assignments — referential, not duplicative.

Equivalent to a product in ERP systems (e.g., Odoo). Future integration with ERP systems is a design guardrail. The deep detail of item management (supplier info, datasheets, equivalents) should be abstracted to a separate concern — an ERP system or a simpler standalone tool for home workshop users.

Examples: "10k 0805 resistor", "M3x10 socket head cap screw", "CA glue", "3D printer filament", "14 AWG stranded red wire".

### Assignment
The relationship between an item and a location. "This item is assigned to this location." Strictly one assignment per location. This simplifies the UI and data operations.

Future consideration: an item equivalency relationship at the item level could allow related items to coexist at a location, but this is out of scope.

### Subdivision Option
Defined on a template. Describes a specific way a position can be divided into named child positions, often corresponding to a physical accessory.

The subdivision option must define the labels for the resulting child positions. For example, the Akro-Mils 40716 divider splits a drawer into "front" and "rear" — those labels are part of the subdivision option definition, not user-supplied at application time.

---

## Override Types

Overrides are structural modifications that deviate from a template's default layout. There are three types: Merge, Divide, and Disable.

Overrides can apply to:
- **An insert** — describes the physical state of that specific object. Moves with the insert when relocated. (e.g., "this Plano box has cells 3 and 4 merged")
- **A module location** — describes the physical state of the module itself. Stays with the module. (e.g., "this shelf slot is damaged")

### Merge
Combine two or more adjacent locations into a single location.

- Target locations must be adjacent and form a contiguous rectangular region
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

### Internal Representation
Paths are stored as an **ordered array of segments**. There is no internal delimiter. This avoids any conflict with UTF-8 characters in user-defined names.

### Display Formats

Paths have two display formats:

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

## Template Configuration on Modules

### Application
A template is applied to a module location to create child locations. For example, applying a "Plano 3600" template to MUSE level 3 creates a 4×6 grid of locations under that level, because the Plano 3600 template defines a 4×6 grid of positions.

For parametric templates, the user supplies dimensions at application time. For example, applying a "Gridfinity baseplate" template to ALEX drawer 3 with dimensions 6×4 creates a 6×4 grid of locations.

### Template Limits
Templates define physical constraints on their dimensions:
- **Soft limits** — warn the user ("This exceeds the Plano 3600's standard layout — are you using a modified insert?")
- **Hard limits** — block the configuration ("A Plano 3600 physically cannot have more than 6 columns")

### Template Assignment Is Not an Override
Assigning or changing a template on a module location is a **module configuration operation**, not an override. It is distinct from Merge, Divide, and Disable, which modify structure within an already-applied template.

Changing a template is a destructive reconfiguration. All existing assignments under the affected location must be resolved before the operation completes.

---

## Concrete Examples

### MUSE (Red Cabinet with Shelf Levels)

MUSE is a cabinet with 11 levels. Each level is a **receptacle** that accepts Plano-compatible inserts.

```
Module: MUSE
  Primary dimension: level (1-11)

  Location: level 1          ← receptacle (accepts: plano-shelf-slot)
    Insert: plano-box-001    ← a specific Plano 3600 instance
      Location: A1           ← leaf, can hold an assignment
      Location: A2
      ...
      Location: D6

  Location: level 4          ← receptacle
    Insert: plano-box-004    ← a Plano 3600 with overrides
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

ALEX has 9 drawers. Drawers are **fixed** — they are part of the furniture. Inside some drawers, a Gridfinity baseplate layout is configured (also fixed). Gridfinity bins sit on the baseplate as **inserts**.

```
Module: ALEX
  Primary dimension: drawer (1-9)

  Location: drawer 3                  ← fixed (module-defined)
    Location: A1                      ← fixed (GF baseplate grid, parametric 6×4)
      Insert: gf-2x1-3comp-017       ← a specific GF 2×1 bin with 3 compartments
        Location: comp 1              ← leaf
        Location: comp 2              ← leaf
        Location: comp 3              ← leaf
    Location: A3                      ← next baseplate position (bin spans 2 cols)
      Insert: gf-1x1-bin-042         ← a specific GF 1×1 bin, single compartment
        Location: (single cell)       ← leaf
    ...

  Location: drawer 7                  ← fixed, no baseplate configured
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
Modules do not nest. This keeps the model simple and avoids recursive module resolution. Physical containment relationships (a drawer unit inside a workbench) are captured as descriptive metadata.

### Items are independent of locations
Items and locations are distinct entities connected by assignments. This separation supports multiple assignments per item, future ERP integration, and clean relocation semantics.

### One assignment per location is enforced
The goal of organization is to have one item per location. This simplifies the UI (show empty locations for easy assignment) and the data model.

Future consideration: an item equivalency relationship, potentially implemented outside this project, could allow related items to coexist at a single location.

### No item compatibility constraints (deferred)
Storage medium types (binned, racked, bulk) and item/location compatibility validation are recognized as valuable but deferred. The model can accommodate these as template and item metadata when needed.

### No quantity tracking
The system answers "where is it?" not "how many?" An item represents a category, not a count. Inventory tracking, including counts, is the domain of ERP (e.g., Charm).

### Progressive organization supported
Items can be assigned at any level in the hierarchy. Assigning to `MUSE 3` without specifying a grid position is valid — the item is on that level, position unspecified. Later refinement to `MUSE 3 / 2, 5` is a reassignment operation.

### Compatibility modeled as relationships
Insert/receptacle compatibility uses named interface types. A template declares what interface type it provides ("I fit into: X") and/or accepts ("I accept: X"). Matching is by type string. Multiple insert types can share an interface type. This is minimal and extensible without requiring a full compatibility matrix.

### Templates are pristine
Templates are never modified by instance data. Overrides live on inserts (for insert-specific modifications) or on module locations (for module-specific modifications). If a modified configuration is reused frequently, it becomes a new template.

### No linking between levels
Each module location independently references its template. Batch operations ("apply this template to levels 2-5") are a UI/API convenience, not a data model concept. This keeps the data model simple.
