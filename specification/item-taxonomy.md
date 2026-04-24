# Item Taxonomy

How WhereTF classifies, describes, and organizes items. The goal is fast, reliable identification — if you can't find it, it may as well not exist.

---

## Design Principles

Hierarchical classification forces a dimension choice. Filing bank statements by date then account, or account then date — you can't know which query you'll need. Parametric description avoids this by describing items as a set of observable properties. Search across any combination of parameters without committing to a hierarchy.

Categories are useful for quick human scanning but fail at boundaries — a spork is neither spoon nor fork, an LED is both optical and electronic. Categories in WhereTF are lightweight visual tags, not structural classification. The real identity of an item is its parameters.

Wrong is better than empty. Approximate categorization reduces large set scan cost but may introduce errors.

---

## Category

A broad, human-readable label used for visual grouping. Categories drive grid tile icons and color hints — a screw icon for fasteners, an SOIC glyph for ICs.

- An item can have zero or more categories.
- One category may be marked primary. The primary category drives the visual representation on grid tiles.
- If no primary is set, no icon is shown. The cell still displays the item name.
- Categories are a fixed system list and should be broad and shallow. Regular users do not create categories.
- Categories are filterable in search but are not the primary search mechanism. The parametric data drives search; categories provide a quick narrowing filter.

---

## Parameter

A named property with a typed value. Parameters are the atomic unit of item description.

Examples:
- Length: 14 mm
- Color: red
- Voltage rating: 50 V
- Thread direction: right (enum)
- RoHS compliant: true (boolean)

### Parameter Definition

A parameter definition prescribes the key name, data type, unit (if applicable), and constraints. Definitions are system-managed and reusable across items and aspects.

- Name — the key (e.g., "Thread diameter", "Length", "Drive size")
- Data type — numeric, text, boolean, enum (pick from a list)
- Unit — optional, declares the measurement domain (mm, inches, volts, ohms). When a unit is declared, the parameter value is numeric and unit-aware. Entry in non-native units is supported with autoconversion (consistent with the storage model's unit handling).
- Default value — optional. Pre-filled when the parameter is added to an item via an aspect. The user can accept or change it. No inheritance, no update propagation — just a starting value.
- Constraints — optional restrictions on valid values:
  - Enum values — a fixed list of valid options (e.g., Drive style: Phillips, Torx, Hex, Slotted)
  - Numeric range — min/max bounds (e.g., Thread pitch: min 0.2, max 6.0)
  - Required vs. optional — whether the parameter must have a value when the aspect is applied. Required means the system flags it as incomplete, not that it blocks saving.

---

## Aspect

An aspect is a reusable group of parameter definitions that describes one facet of an item. Aspects are the core normalization mechanism — they prescribe what parameters an item should have, ensuring consistent description across similar items.

(The Charm/Odoo addon called this concept a "class." We use "aspect" to avoid collision with inventory management and programming terminology.)

An aspect defines:
- Name — what facet it describes (e.g., "Thread", "Drive", "Head", "Package", "Material")
- Parameter definitions — the set of parameters belonging to this aspect, each with its data type, default value, and required/optional flag
- Description — what this aspect represents physically

Aspects do not carry instance values. They define structure and defaults. Values are supplied when an aspect is applied to an item.

### Applying Aspects

An item gains parameters by applying one or more aspects. Each application copies the aspect's parameter definitions (with defaults) onto the item. The user fills in or adjusts the values.

Multiple applications of the same aspect on one item (e.g., two Thread aspects on a pipe nipple) require a role to distinguish them. Role handling is deferred — the concept is noted here; the mechanism will be specified when pipe fittings and similar multi-aspect items are actively modeled.

### Composition Example

A machine screw:
- Aspect: Thread
  - Thread system: metric
  - Thread diameter: M3
  - Thread pitch: 0.5 (default: standard for M3)
  - Thread direction: right (default)
- Aspect: Drive
  - Drive style: hex
  - Drive size: 2.5 mm
- Aspect: Head
  - Head group: cylindrical
  - Head name: socket head cap
- Aspect: Material
  - Material type: 18-8 stainless steel
  - Finish: black oxide
- Length: 10 mm (standalone parameter, not part of any aspect)

An SMD resistor:
- Aspect: Electrical
  - Resistance: 10 kΩ
  - Tolerance: ±1%
  - Power rating: 0.125 W
- Aspect: Package
  - Package type: SMD
  - Package code: 0805

### Standalone Parameters

Not every parameter belongs to an aspect. Some parameters are properties of the whole item, not of one facet — like Length on a fastener, which is the item-level dimension that typically varies across a product family.

### Aspects Are Suggestions, Not Constraints

Aspects prescribe what parameters should exist, but the system does not block an item that is missing parameters or has extra ones. An item can:
- Have an aspect applied with some parameters left blank (incomplete but valid — flagged, not blocked)
- Have parameters that don't belong to any applied aspect (ad-hoc description)
- Have no aspects at all (fully ad-hoc, just loose parameters)

Get items in fast, refine later.

---

## Item Families and Matrix Expansion

Deferred. Items that share parameters across a product family (e.g., M3 SHCS in lengths 5, 6, 8, 10, 12, 14, 16, 20) need a creation and management mechanism. Whether this is an explicit family entity or derived from shared parameter signatures — and how shared-parameter edits propagate — requires further design.

The parametric system and aspects defined here are the foundation for whatever family mechanism is chosen.

---

## Synonyms

Aspects and parameter definitions can carry alternate names (aliases) for trade-vocabulary mismatch — electronics calls it "package," mechanical calls it "footprint," electrical calls a max rating "V_max" or "breakdown voltage." Canonical names still drive storage and search; aliases expand matching and flag duplicates at author time. Full spec: [taxonomy-synonyms.md](taxonomy-synonyms.md).

---

## Search

Search is AI-driven. Users describe what they're looking for in natural language; the system interprets the query against the parametric data.

The structure defined in this document — typed parameters, unit-aware values, aspects grouping related parameters — is what makes AI search effective. Without consistent, structured data, search degrades to fuzzy text matching. With it, the AI can resolve "M3 socket head" to Thread diameter=M3 + Head name=socket head cap, and "0805 resistor under 100kΩ" to Package code=0805 + Resistance < 100kΩ.

Categories provide an additional narrowing filter but are not the primary search axis.

Search design is specified separately.

---

## Relationship to Odoo/ERP

Odoo requires every product to belong to exactly one category. When items sync to Odoo, WhereTF maps the primary category (or derives one from applied aspects) to Odoo's single-category requirement. The parametric richness stays in WhereTF; Odoo gets the simplified view it needs.

Integration details are specified separately.
