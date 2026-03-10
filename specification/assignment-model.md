# Assignment Model Specification

This document defines the assignment data model for WhereTF.

## Assignment

An assignment is a distinct record that connects an item to a location. It is its own entity, not a field on either the item or the location.

### Properties

- **Item reference** — which item is assigned here
- **Location reference** — which location the item is assigned to
- **Date assigned** — when the assignment was created

### Constraints

- **One assignment per location** — strictly enforced. A location can have at most one assignment. Attempting to assign a second item to an occupied location must fail or require the existing assignment to be resolved first.
- **Many assignments per item** — an item can be assigned to multiple locations. Each assignment is a separate record.
- **Unassigned items are valid** — an item can exist with zero assignments. This supports progressive organization (item cataloged but not yet placed) and items temporarily removed from storage.
- **Unassigned locations are valid** — a location can exist with no assignment. This is the normal state of an empty bin or compartment.

### Querying

Because assignments are their own records, both directions are efficiently queryable:
- **By item** — "Where are all my 10k resistors?" → returns all assignments for that item, with their locations
- **By location** — "What's at MUSE 3 / 2, 5?" → returns the assignment at that location, with its item
- **Unassigned items** — "What items don't have a location?" → items with no assignment records
- **Empty locations** — "What locations are available?" → locations with no assignment records

### Lifecycle

Assignments must be resolved before any override or reconfiguration that affects their location:
- **Merge** — assignments at affected locations must be migrated or removed
- **Divide** — the assignment must be reassigned to a child location, moved elsewhere, or removed
- **Disable** — the assignment must be moved or removed
- **Insert relocation** — assignments within the insert move with it automatically
- **Template change** — all assignments under the affected location must be resolved
