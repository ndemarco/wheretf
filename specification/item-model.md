# Item Model Specification

This document defines the item data model for WhereTF.

## Item

An item represents what a thing **is**, independent of where it is. It is a type or category, not an individual instance or count.

### Properties

- **Name** — short, scannable identifier for the item. Used in grid views, search results, and quick visual scans. ("M3x10 SHCS", "10k 0805 resistor", "CA glue")
- **Description** — long-form text capturing all detail the user wants to record about the item. No length restriction.
- **Parameters** — unlimited key/value/unit tuples for structured specs. Any property that benefits from structured storage belongs here.

Example parameters:
```
resistance: 10k / ohm
package: 0805
material: stainless steel
voltage: 3.3 / V
manufacturer: Würth Elektronik
wire gauge: 14 / AWG
```

### Key Points

- An item has no inherent relationship to a location. Items and locations are connected by **assignments** (defined in storage-model.md).
- An item can have multiple assignments — the same item at multiple locations. This is referential, not duplicative. One item definition, many assignments.
- Items do not track quantity. The system answers "where is it?" not "how many?"
- Equivalent to a product in ERP systems (e.g., Odoo). Future integration with ERP systems is a design guardrail. Deep item management (supplier info, datasheets, equivalents, purchasing) should be abstracted to a separate concern.

### Future Considerations (out of scope)

- **Images** — photos of the item for visual identification in grid views
- **Label printing** — generate bin labels from item data
- **Categories/tags** — grouping items beyond what parameters and search provide
- **Item equivalency** — relationships between items that are interchangeable or commonly co-located
- **ERP integration** — linking items to products in external systems (e.g., Charm/Odoo)
