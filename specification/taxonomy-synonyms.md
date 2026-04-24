# Taxonomy Synonyms

## Status

**Specify phase.** Open questions flagged inline. Not yet implemented.

---

## Why

Different trades use different words for the same concept. WhereTF's
taxonomy has one canonical term per aspect or parameter — but users
think in their own vocabulary:

- Electronics: **package**, **footprint**, **form factor**, **case style**
- Mechanical: **thread pitch**, **TPI**, **threads per inch**
- Electrical: **V_max**, **max voltage**, **breakdown voltage**, **peak inverse voltage**

Without synonyms, a maker who searches for "footprint" never finds the
"Package" aspect, and a taxonomy admin who adds "Form factor" as a new
aspect doesn't know it duplicates an existing one.

---

## Goals

1. **Search / filter matching.** User types `footprint` → query matches
   items with the `package` parameter.
2. **Author-time dedup.** Admin types "Form factor" as a new aspect
   name → system flags "this is a known alias of *Package*. Use that
   instead, or link as an alias?"
3. **Comporting to trades.** A user's trade's vocabulary is
   first-class, not a translation layer.

### Display — decided: canonical only

When a user enters an item via an alias, the UI resolves to the
canonical name on display. Filter pills, detail panel, grid headers
all show the canonical term. The alias is a lookup key, not a stored
preference. Rationale: parameters cut across trades by design; the
catalog has one right name per concept.

### Not yet
5. **Cross-catalog import mapping.** Mapping external vocabularies
   (Digi-Key, McMaster) to ours — deferred. Synonyms will be a building
   block but the import flow is its own spec.
6. **Localization / i18n.** Different languages for the same concept
   — deferred.
7. **Per-user trade profile.** "Show me everything in electronics
   vocabulary." Interesting, but YAGNI until users ask for it.

---

## Scope (what gets synonyms)

Phase 1 — **aspects** and **parameter definitions** only. These are
the two places where trade-vocabulary mismatch bites hardest.

Out of phase 1:
- **Categories** — shallow system list, curated centrally, low synonym
  pressure. Add if demand appears.
- **Items** — item names are user-authored and already free-form.
  Synonyms on items would duplicate the parametric data's job.
- **Parameter values** (e.g., material names: `SS304` vs `A2 stainless`
  vs `18-8`) — separate spec. Enum values have their own aliasing
  problem that needs a different shape.
- **Standards / designations** — separate concept, cross-reference
  relationships are modeled already.

---

## Data model

One new table, additive-org-scoped like the rest of the taxonomy:

```
taxonomy_aliases
  id                uuid PK
  target_type       text NOT NULL     -- 'aspect' | 'parameter_definition'
  target_id         uuid NOT NULL     -- FK enforced in app layer (polymorphic)
  term              text NOT NULL     -- original casing, for display
  term_normalized   text NOT NULL     -- lowercase, non-alphanumerics → ' ', trimmed, single-spaced
  owner_org_id      uuid NULL         -- NULL = global alias; set = org-private (same additive pattern as aspects/params)
  created_at        timestamp NOT NULL DEFAULT now()
  created_by        uuid NULL         -- users.id — who added this

INDEX on (term_normalized)            -- search
UNIQUE on (target_type, target_id, term_normalized, owner_org_id)  -- one alias per target per scope
```

**No separate `is_canonical` column.** The canonical name lives on the
`aspects.name` / `parameter_definitions.name` columns already. Aliases
are *extra* names.

**Normalization** — `term_normalized` is the search key. Rule:

```
"V_max"              → "v max"
"threads per inch"   → "threads per inch"
"TPI"                → "tpi"
"form-factor"        → "form factor"
"Breakdown Voltage"  → "breakdown voltage"
```

Rules: lowercase → replace non-alphanumerics with spaces → collapse
whitespace → trim. Unicode normalization NFKC first. Applied on write
and on query.

### Why one table, not two

Using `target_type` lets one query do "find all targets matching term
X" for search. Splitting `aspect_aliases` + `parameter_aliases` forces
a UNION on every search. Polymorphic FKs are mildly awkward but the
set is small (2 target types) and growth is bounded.

---

## Seed data — worked examples

Canonical names stay what seed.ts has today. Aliases are added on top:

| Target (kind → canonical) | Aliases |
|---|---|
| aspect → `Package` | `footprint`, `form factor`, `case style`, `physical package` |
| parameter → `voltage_rating` | `V_max`, `max voltage`, `breakdown voltage`, `peak inverse voltage` |
| parameter → `thread_pitch` | `pitch` *(see note)* |
| parameter → `package` | `footprint`, `case style` |

### Unit-mismatched relatives are NOT synonyms

`TPI` is not a synonym of `thread_pitch` in the same sense: they
express the same physical property but in inverted units
(`TPI = 25.4 / pitch_mm`). A textual alias that maps `TPI: 20` to
`thread_pitch: 20` would be wrong.

**Out of scope for this spec:** a "measure family" concept where
synonyms carry a unit transform. When TPI needs to work, it's a
`thread_pitch` parameter value entered via a `TPI` input widget that
converts at entry time — that belongs in the parameter-entry UX, not
the synonym table.

Scope here is **pure textual aliases with identical semantics and
identical storage units.**

### Ambiguous terms across trades

`pitch` alone means thread pitch in mechanical, pin pitch in
electronics. Writing `pitch` as an alias of `thread_pitch` creates a
false positive for electronics users searching their own aspects.

**Resolution for phase 1:** don't add short ambiguous terms as
aliases. The canonical name already has a disambiguator
(`thread_pitch`, not `pitch`). Users who type `pitch` get a
disambiguation prompt (see Search flow).

**Deferred:** a `trade` / `context` column on `taxonomy_aliases` to
narrow a synonym to one domain. Add when the ambiguity cases outgrow
the canonical-name-is-specific-enough workaround.

---

## Search flow

1. User types `footprint` in the items search.
2. Query is normalized → `footprint`.
3. Lookup order:
   a. Exact match on `aspects.name` / `parameter_definitions.name` (normalized).
   b. Match on `taxonomy_aliases.term_normalized`.
4. If a single target: expand the query against that target's
   canonical name and run the existing search.
5. If multiple targets (e.g., `pitch`): return both; UI shows a
   disambiguation chip. "Did you mean: **Thread pitch** (mechanical)
   or **Pin pitch** (electronics)?"

---

## Authorship — alias authoring rides item entry

**Any user entering an item can create aliases or new taxonomy
elements.** There is no separate admin-only alias management flow.
The authoring surface is the item-entry path: when a user types a
term the system doesn't recognize, the resolution dialog lets them
either match to an existing aspect/parameter (creating an alias) or
create a new taxonomy element.

Rationale: taxonomy authoring needs to happen at the point of
friction (entering an item), not behind an admin UI a user would
never open. Requiring admin review up-front blocks item entry — which
is the primary user goal.

**Decay assumption.** New taxonomy element creation is expected to
decay exponentially as the catalog matures. Early users generate most
of the novel terms; later users mostly match existing vocabulary. We
rely on this curve rather than gating. If it doesn't hold, revisit
with a moderation flow — not now.

### Resolution flow at item entry

When a user types a term for an aspect or parameter:

1. Normalize the entered term.
2. Lookup canonical names + existing aliases.
3. **One exact match** → auto-resolve silently.
4. **Multiple matches** (ambiguity, see `pitch` below) → surface
   "Did you mean: A / B / other?"
5. **No match** → surface three options:
   - **"Use existing {canonical}"** — user picks from a suggested
     list (fuzzy match against close canonicals)
   - **"Add `{term}` as an alias of {canonical}"** — pick an existing
     target, save as alias
   - **"Create new {aspect|parameter} named `{term}`"** — create a
     new taxonomy element

No silent deduplication. Always surface the conflict; let the author
decide.

---

## Open questions

1. **Seed coverage** — how many aliases ship in the v1 seed? Target
   ~20 high-signal ones (package/footprint, V_max/breakdown voltage,
   etc.); let the rest accrue via author-time dedup as users enter
   items.
2. **Alias edit/delete semantics** — deletes are always safe (the
   term just stops matching). Edits are rare. Platform admins only
   in a dedicated moderation UI, or any authoring user who created
   the alias? Deferred — decide when we see abuse patterns.
3. **Unit-aware value equivalence (related spec, not this one)** —
   not a synonym case but adjacent. E.g., a user entering
   *1/2" NPT pipe, 8 TPI* needs the system to recognize this as
   *12.7 mm NPT, 3.175 mm pitch*. Requires a **measure family**
   concept: one physical quantity, multiple units, known transforms
   between them. Pure textual aliases can't do this. Flagged for a
   separate spec in this session.

---

## Minimal implementation steps (for later, not now)

1. Migration — create `taxonomy_aliases` table with index + unique
   constraint.
2. Repository — `aliasRepository` with `list`, `listForTarget`,
   `create`, `delete`, `findTargetsByTerm(term, scope)`.
3. Seed update — add the ~20 curated aliases for the workshop theme.
4. Search integration — expand item search query via
   `findTargetsByTerm` lookup; rewrite matching portion of the query
   to use the canonical parameter/aspect name before executing.
5. Author-time dedup — wire into the aspect/parameter create modals.
6. UI surface (admin only) — a table of aliases on each aspect /
   parameter detail view.

No implementation in this pass.

---

## Related

- [item-taxonomy.md](item-taxonomy.md) — parametric model, aspects,
  categories
- [item-parametric-model.md](item-parametric-model.md) — data types,
  units, constraints
