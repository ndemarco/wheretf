# Item Graphics

Per-item SVG wireframes for fast visual scanning of the catalog. A
tiny schematic next to each item name so the user recognizes "that's
a nut" or "that's a chip" without reading.

## Status

**Specify phase.** Not yet implemented.

---

## Why

Item names are long and look alike: *M3×10 socket head cap screw,
stainless*, *M3×12 socket head cap screw, stainless*, *M3×10 button
head cap screw, stainless*. A row of names scanned at a glance is a
wall of text. A row of wireframes is a shape-first scan — cap head
vs button head is obvious in 100 ms, not 3 s.

This is a supporting channel for the primary search/filter flow, not
a replacement for it.

---

## Goals

1. **Grid scannability.** Show a small wireframe in the first column
   of the Items grid so shape is a primary visual key.
2. **Detail recognition.** Render a larger wireframe in the detail
   panel for unambiguous "yes, that's the right thing."
3. **Graceful absence.** Items without a wireframe fall back to a
   neutral glyph based on primary category. No empty cells.
4. **Shared catalog contribution.** Wireframes live in the global
   catalog (like items themselves) so one author's drawing helps
   every downstream user.

---

## Non-goals

- **Photographs.** Wireframes only. Photography is a separate problem
  (hosting, licensing, consistency). Out of scope.
- **3D models.** No STL, no GLTF, no renders. Schematic 2D only.
- **Animated graphics.** No motion, no interaction, no hover states
  on the wireframe itself.
- **Per-variant drawings.** One wireframe per item-family intent
  ("socket head cap screw"). Variants (M3 vs M4) share the family's
  wireframe; length doesn't redraw.

---

## Style rules

- **Monochrome line art.** One color, rendered with `currentColor`
  so it inherits the surrounding text color.
- **Stroke:** 2 px (target), round caps, round joins. Consistent with
  the app icon set style.
- **No fills** except where the shape is structurally hollow (e.g.,
  nut's through-hole). Use `fill="none"` by default.
- **ViewBox:** normalize all wireframes to `0 0 48 48`. Content
  anchored, padded from edges.
- **No text** in the wireframe itself. Labels are the job of the
  surrounding UI.
- **No scripts, no foreign content, no external references**
  (validation below).

---

## Data model

Store SVG text inline on the item row, not as a file.

```
ALTER TABLE items
  ADD COLUMN wireframe_svg text NULL;
```

Why text, not a file:
- **Seed-friendly.** Committing SVGs as part of `db/seed.ts` is a
  one-liner each; no asset pipeline.
- **Simple serving.** Returned in the existing `/api/items` response,
  rendered inline. No second round-trip.
- **Themable.** Inline means `currentColor` works without extra
  fetch tricks.
- **Size.** Target wireframe is under 2 KB. Typical: 500–800 bytes.

Limits:
- `wireframe_svg` must be ≤ **4096 bytes** on insert/update.
- Must parse as valid XML and contain exactly one root `<svg>`.
- Strip `<script>`, `<foreignObject>`, `<image>`, `href` with
  external URL, and all `on*` event attributes on save.
- Optional future: run through an SVGO pass at save.

Fallback when `wireframe_svg IS NULL`:
- Look up primary category's icon (already stored on `categories`).
- If primary category also has none, render a neutral generic glyph
  (a small rectangle-with-diagonal, for "unspecified").

---

## Where wireframes render

### 1. Items grid (first column)

- 24 px square, left of item name.
- `currentColor` matches the row's text color so selected rows
  remain legible.
- Falls back to category icon, then neutral glyph.
- Clicking the wireframe selects the row (same as name click — don't
  build a second click target).

### 2. Item detail panel (header)

- 120–160 px, above the parameter grid.
- Wireframe + item name + description together act as the panel
  header. Edit-in-place on name/description stays as-is.

### 3. Search-result visual-scan mode (deferred)

A view toggle that strips columns down to wireframe + name + one
chosen column (e.g., package, voltage, length) — for high-density
shape scanning. Design exists in the items-screen spec; implementation
follows core grid + wireframe rendering.

### 4. Global catalog admin (future)

A management view for platform admins to author / edit / curate
wireframes. Not part of v1.

---

## Authoring

### Sources, in descending preference

1. **Seeded / curated global wireframes** — hand-drawn by a maintainer
   and committed to `db/seed.ts`. The starting set.
2. **Item-entry manual upload** — user pastes SVG source into a text
   area on the item create / edit form. Validated on save.
3. **AI-assisted generation from item description and category** —
   deferred.

### Validation on save

Run a sanitizer:
1. Parse as XML. Reject if invalid.
2. Require exactly one root `<svg>` with a `viewBox`.
3. Strip dangerous elements: `<script>`, `<foreignObject>`,
   `<image>`, `<iframe>`, `<object>`, `<embed>`, `<use>` with
   external href.
4. Strip dangerous attributes: anything starting with `on`
   (`onclick`, `onload`, etc.); `href` / `xlink:href` pointing at
   external URLs.
5. Reject if byte-length > 4096 after sanitization.
6. Optionally collapse `viewBox` to `0 0 48 48` or reject mismatch
   (strict v1: reject, tighten the authoring contract).

Rejections return a 400 with the specific rule that failed.

---

## Seed list (v1)

Hand-draw ~15 wireframes for the common workshop items already in
`db/seed.ts`:

- Hex nut (top view, hexagon with hole)
- Machine screw (side view, head + thread)
- Socket head cap screw (side view, distinct cylindrical head)
- Pan-head screw (side view, rounded pan head)
- Flat-head screw (side view, conical head)
- Nylon lock nut (side view, nut with nylon collar)
- Electrolytic capacitor (schematic, polarized)
- Ceramic capacitor (schematic, non-polarized)
- Resistor (schematic zigzag body with leads)
- LED (schematic diode with light arrows)
- Soldering station (isometric box with iron)
- Digital calipers (side view, jaws + body)
- Super glue (bottle silhouette)
- JB Weld (two-part tube silhouette)
- Hookup wire (spool silhouette)

Each committed as an inline SVG string in seed.ts.

---

## Rendering

Inline `<svg>` in React, NOT `<img src="data:image/svg+xml;…">`:

```tsx
function ItemWireframe({ svg, size = 24 }: { svg: string | null; size?: number }) {
  if (!svg) return <CategoryFallback />;
  return (
    <span
      className="inline-block shrink-0"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
```

Why inline and not `<img>`:
- `currentColor` propagates only through inline SVG, not `<img>`.
- One less HTTP round-trip per item cell.

Safety: the save-time sanitizer is the trust boundary; render-time
trust is assumed. The sanitizer MUST run on every write path.

---

## Performance

- Grid wireframes are tiny; 100 items × 800 B = 80 KB of SVG in the
  rich-items response. Acceptable.
- Inline SVG renders fine at 24 px on any viewport.
- If the catalog grows to thousands of items, consider lazy
  wireframe loading via a second endpoint — defer.

---

## Open questions

1. **Stroke color on selected rows** — if the selected row bg is
   accent-orange and wireframe is `currentColor`, the wireframe
   becomes invisible. Confirm we force a contrasting stroke when
   selected, or drop `currentColor` for a fixed stroke token.
2. **Category-icon fallback scale** — category icons today are
   emoji strings (`🔩`). They don't compose with the wireframe
   visual language. Replace category icons with matching-style
   wireframe glyphs, or live with the style clash?
3. **User-authored wireframes vs global curation** — v1 allows
   either. Do user-authored wireframes propagate to global catalog
   candidates for review? Defer the moderation flow.
4. **AI generation** — when it lands, what input signal (item name +
   category? full parameter set?) and what quality bar before a
   human approves?

---

## Related

- [item-management-design.md](item-management-design.md) — grid + detail
  layout; wireframe placement lives inside that layout.
- [item-taxonomy.md](item-taxonomy.md) — categories and their icons;
  this spec intersects via the fallback glyph rule.
