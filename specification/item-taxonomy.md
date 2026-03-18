# Item Taxonomy

How WhereTF classifies, describes, and organizes items. The goal is fast, reliable identification — if you can't find it, it may as well not exist.

---

## Design Principles

Hierarchical classification forces a dimension choice. Filing bank statements by date then account, or account then date — you can't know which query you'll need. Parametric description avoids this by describing items as a set of observable properties. Search across any combination of parameters without committing to a hierarchy.

Categories are useful for quick human scanning but fail at boundaries — a spork is neither spoon nor fork, an LED is both optical and electronic. Categories in WhereTF are lightweight visual tags, not structural classification. The real identity of an item is its parameters.

---

## Category

A broad, human-readable label used for visual grouping. Categories drive grid tile icons and color hints — a screw icon for fasteners, an SOIC glyph for ICs.

- An item can have zero or more categories.
- One category may be marked primary. The primary category drives the visual representation on grid tiles.
- If no primary is set, no icon is shown. The cell still displays the item name.
- Categories are a fixed system list, broad and shallow — roughly 10-20 entries. Users do not create categories.
- Categories do not affect search ranking or storage. They are purely a display aid.
- Wrong is better than empty. Approximate categorization still serves the scan purpose.

---

## Parameter

A single observable property of an item, expressed as a key/value pair with optional unit.

Examples:
- Length: 14 mm
- Color: red
- Voltage rating: 50 V
- Thread direction: right

### Parameter Definition

A parameter definition prescribes the key name, data type, unit (if applicable), and constraints. Definitions are system-managed and reusable across items and classes.

A parameter definition specifies:
- Name — the key (e.g., "Thread diameter", "Length", "Drive size")
- Data type — numeric, text, boolean, enum (pick from a list)
- Unit — optional, declares the measurement domain (mm, inches, volts, ohms). When a unit is declared, the parameter value is numeric and unit-aware.
- Constraints — optional restrictions on valid values:
  - Enum values — a fixed list of valid options (e.g., Drive style: Phillips, Torx, Hex, Slotted)
  - Numeric range — min/max bounds (e.g., Thread pitch: min 0.2, max 6.0)
  - Required vs. optional — whether the parameter must have a value when the class is applied

Parameter definitions enable:
- Validated data entry — the system knows what values are acceptable
- Numeric range search — "show me all resistors between 1kΩ and 100kΩ"
- Unit-aware comparison — the system understands that 25.4 mm = 1 inch
- Consistent bulk edit — the system can offer valid replacement values

---

## Class

A class is a reusable group of parameter definitions that describe one aspect of an item. Classes are the core normalization mechanism — they prescribe what parameters an item should have, ensuring consistent description across similar items.

A class defines:
- Name — what aspect it describes (e.g., "Thread", "Drive", "Head", "Package", "Material")
- Parameter definitions — the set of parameters belonging to this class, each marked required or optional
- Description — what this class represents physically

Classes do not carry values. They define structure. Values are supplied when a class is applied to an item.

### Class Application

An item gains parameters by applying one or more classes. Each application is called a class assignment. A class assignment consists of:
- The class being applied
- A role (optional) — distinguishes multiple applications of the same class on one item
- Parameter values — the actual values for each parameter defined by the class

The role is critical for items that have the same aspect more than once.

### Composition Examples

A cap or plug has one threaded connection:
- Class: Thread (no role needed — only one)
  - Thread system: NPT
  - Thread size: 1/2"
  - Thread direction: right

A standard nipple has two equivalent threaded connections:
- Class: Thread, role: "end A"
  - Thread system: NPT
  - Thread size: 3/4"
  - Thread direction: right
- Class: Thread, role: "end B"
  - (same values as end A)

A reducing nipple has two different threaded connections:
- Class: Thread, role: "large end"
  - Thread system: NPT
  - Thread size: 3/4"
  - Thread direction: right
- Class: Thread, role: "small end"
  - Thread system: NPT
  - Thread size: 1/2"
  - Thread direction: right

A machine screw composes multiple classes:
- Class: Thread
  - Thread system: metric
  - Thread diameter: M3
  - Thread pitch: 0.5
  - Thread direction: right
- Class: Drive
  - Drive style: hex
  - Drive size: 2.5 mm
- Class: Head
  - Head group: cylindrical
  - Head name: socket head cap
- Class: Material
  - Material type: 18-8 stainless steel
  - Finish: black oxide
  - Tensile strength: 70,000 PSI
- Parameter: Length — 10 mm (standalone, not part of a class)

An SMD resistor composes differently:
- Class: Electrical
  - Resistance: 10 kΩ
  - Tolerance: ±1%
  - Power rating: 0.125 W
  - Temperature coefficient: 100 ppm/°C
- Class: Package
  - Package type: SMD
  - Package code: 0805
  - Dimensions: 2.0 × 1.25 mm

### Standalone Parameters

Not every parameter belongs to a class. An item can have parameters that exist outside any class assignment. Length on a fastener is a standalone parameter — it doesn't group naturally with thread, drive, head, or material. It's a property of the whole item, not of one aspect.

### Classes Are Suggestions, Not Constraints

Classes prescribe what parameters should exist, but the system does not block an item that is missing parameters or has extra ones. An item can:
- Have a class applied with some parameters left blank (incomplete but valid)
- Have parameters that don't belong to any applied class (ad-hoc description)
- Have no classes at all (fully ad-hoc, just loose parameters)

This keeps the system from blocking the user. Get items in fast, refine later.

---

## Matrix Expansion

Classes and parameter definitions enable efficient creation of item families. A family is a set of items that share all parameters except one or more that vary.

Flow:
1. User creates one item fully (e.g., M3x10 SHCS with all classes and parameters filled in).
2. User chooses "Expand" — selects a parameter to vary (e.g., Length).
3. User enters the set of values (5, 6, 8, 10, 12, 14, 16, 20 mm).
4. System generates new items for each value, inheriting all other parameters.
5. User can expand again on another parameter (e.g., Finish: black oxide, bright zinc) — system multiplies across the matrix.

The result is a set of individually addressable items that share a parameter signature. The system can derive "these are related" by detecting shared class assignments with matching values on all but the varied parameters. No explicit family entity is needed.

---

## Search Implications

The parametric system enables multi-axis search without hierarchy:
- "M3 socket head" — matches items with Thread diameter=M3 and Head name=socket head cap
- "NPT 3/4" — matches items with Thread system=NPT and Thread size=3/4"
- "0805 resistor under 100kΩ" — matches Package code=0805 and Resistance < 100kΩ
- "stainless steel fasteners" — matches Material type containing "stainless" and category=fastener

Search operates on parameters, not categories or class names. Classes structure the data; search queries it.

---

## Relationship to Odoo/ERP

Odoo requires every product to belong to exactly one category. When items sync to Odoo, WhereTF maps the primary category (or derives one from class assignments) to Odoo's single-category requirement. The parametric richness stays in WhereTF; Odoo gets the simplified view it needs.

Class assignments and parameter values can map to Odoo product attributes and variants, enabling round-trip sync without losing structure.
