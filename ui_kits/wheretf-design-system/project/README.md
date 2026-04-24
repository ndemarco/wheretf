# WhereTF Design System

> **Bin there, found that.**

WhereTF (pronounced "where-tee-eff", and yes, it's short for *Where To Find* —
the other reading is a wink, not a slogan) is a freemium inventory app for
people with **a lot of small items** — electronics hobbyists, makers,
fiber crafters, jewelers, reloaders, lab folks. Anyone who has ever stood in
their workshop holding an empty drawer and thought the product name out loud.

WhereTF is **not** a stock-counter. It's a **deep item catalog + a location
graph**. You describe your items as precisely as you care to ("M6×30 SHCS, hex
drive, fully threaded, natural finish"), then you link each item to a location
inside a Module (a shelving unit, a chest of drawers, a bench organizer).
Find-and-retrieve, not inventory-management.

---

## Core concepts (own this vocabulary — the UI depends on it)

| Term | Meaning |
| --- | --- |
| **Item** | A uniquely-defined *type* of thing, defined as deeply as the user cares. Not a quantity. "M6×30 SHCS" is one item. |
| **Module** | A physical container of storage — a shelving unit, a chest of drawers, a bench organizer. **Not** a room or warehouse. |
| **Location** | A specific addressable spot *inside* a Module (e.g. `Drawer 3 · Bin B2`). The atomic unit of "where". |
| **Link** | The edge between an Item and a Location. Ideally 1:1, but the system tolerates 1:many. |
| **Find** | The verb. The whole product is in service of this one action. |

---

## Tiers

- **Free** — one user, limited Modules, limited Items. Goal: get them to
  curate and *deeply define* items.
- **Pro** — many Modules, many Items, multi-user.

Pricing & exact limits TBD.

---

## Sources consulted

- **Uploaded logo** — `uploads/wheretf.svg` (stored cleaned as `assets/wheretf-logo-original.svg`)
- **Site** — `wheretf.xyz` (in progress; colors & logo present, content sparse) — not reachable from this environment; user confirmed dark-themed, same orange.
- **User conversation** — tone, audience, tiers, the Item/Module/Location model.

> **No codebase or Figma was attached.** Component recreations in `ui_kits/`
> are built fresh from the brand brief and are intended as a *starting
> point* — not a recreation. Attach source when ready.

---

## Index (what's in here)

```
README.md                    ← you are here
SKILL.md                     ← agent-loadable skill manifest
colors_and_type.css          ← color & type tokens (import into any artifact)
assets/
  wheretf-logo-original.svg  ← the original uploaded logo (cleaned)
  monogram.svg               ← tag-drop mark (locked in)
  wordmark-horizontal.svg    ← mark + "WhereTF" wordmark
  logo-mark-A-binpin.svg     ← logo exploration A
  logo-mark-B-crosshair.svg  ← logo exploration B
  logo-mark-C-pingrid.svg    ← logo exploration C (adopted as primary)
  logo-mark-D-tag.svg        ← logo exploration D
  icons/                     ← 24-icon starter set, 2.5px stroke
fonts/                       ← (populated once final font files land)
preview/                     ← design system cards (registered for review)
ui_kits/
  marketing/                 ← wheretf.xyz landing-page kit
  app/                       ← product app kit (web-first, mobile-responsive)
```

---

## Logo

The supplied mark ("WhereTF?" with a pin-drop and a cluster of little
component characters) has a good instinct — the components give definition
to an otherwise-generic geolocation pin — but a pin-drop pointing at a *map*
is semantically off. WhereTF is about an **item's location inside a
storage module**, not a place on earth.

**Adopted direction (Option D, "Tag-drop"):** a luggage/inventory tag
silhouette that resolves to a pin at the bottom. The eyelet above two
label lines says "name this item, then find it" — one shape carries
both halves of the product (deep item definition + precise location).
No more surrounding component-characters, no more question mark.

**Other directions explored:** `assets/logo-mark-A-binpin.svg` (drawer
silhouette), `B-crosshair` (coordinate tag), `C-pingrid` (pin with
bin-grid interior). Keep them around — they could become secondary
marks or sticker variants.

**The "?" is dropped.** `WhereTF` reads cleaner as a wordmark and the
wink survives in the typeface weight alone.

**The little characters** from the original (chip, LED, nut, resistor, saw,
capacitor-with-leads) are too good to lose. They move out of the logo and
become the **icon family** for item categories — see `assets/icons/part-*.svg`.

---

## Content fundamentals

**Voice:** winking, irreverent, tradesperson-confident. The product knows
what it is and what it isn't. It is never precious and never corporate.

**Tone rules:**
- **"Bin there, found that."** is the tagline. Use it. It's one of five
  dad-joke puns the brand gets to earn this quarter.
- Use **you**. Never **we** in marketing copy unless introducing a team.
- **Sentence case** everywhere. Not Title Case Like A Keynote Slide.
- **Commit to the bit — briefly.** One punchy line, then answer the
  question. Never explain the joke.
- **Name things directly.** Items. Modules. Locations. Links. Not
  "storage assets" or "SKU objects".
- **Imperative > descriptive.** "Scan it. Name it. Find it." beats "A
  comprehensive inventory management solution for…"
- **No emoji in product UI.** Stickers and social are fine, sparingly.
- **Numbers are tabular.** Quantities, coordinates, part numbers use
  `font-variant-numeric: tabular-nums`.

**Examples**

| ✅ On-brand | 🚫 Off-brand |
| --- | --- |
| "Where the hell did I put that 0603 resistor?" | "Looking for a particular resistor?" |
| "Scan it. Name it. Find it." | "Our AI-powered inventory platform streamlines…" |
| "You have 147 items. You can name them all." | "Your catalog contains 147 entries." |
| "Bin 7, Drawer 2. Trust the bin." | "Location: Bin 7, Drawer 2." |
| "Free forever for one workshop." | "Sign up for our free tier today!" |

---

## Visual foundations

**Hero color** — `#ff6600`. One orange, used with restraint. It lives on
primary buttons, brand moments, and the one "found it" highlight. It does
**not** live on gradients or decorative backgrounds.

**Neutrals** — warm **ink** (near-black with a drop of brown so it doesn't
fight the orange) + cool **steel** (for rules, dividers, data). See
`colors_and_type.css` for the full scales.

**Theme** — **both themes are native**. Dark uses `#0f0d0b` (warm ink, not
black) and lifts the brand to `#ff7a1a` slightly hotter to survive the
contrast shift. Light uses `#fafaf7` (warm off-white, like a shop rag),
never pure white.

**Type** — **Space Grotesk** for UI and display (geometric, industrial-ish,
warm counters, matches the wordmark weight). **JetBrains Mono** for part
numbers, location codes, and SKUs. Weight range 400/500/600/700.

**Backgrounds** — mostly flat. Never gradients-as-vibe. **Pegboard texture**
(a faint 24×24 grid of dots, `--fg-mute` at 30% opacity) is the one
signature background, used sparingly behind hero units and empty states.

**Layout** — generous spacing (16/24/32/64px rhythm), anchored to an 8px
grid. Cards are rectangular with **10–14px radius**. **Full-bleed** is
reserved for marketing. App screens are left/right-chrome with a fixed
sidebar.

**Borders** — **1px hairlines** in a warm line color (`#e3ddd1` light,
`#2a221c` dark). Never heavy borders. The brand's weight comes from
typography, not chrome.

**Radii** — `4 / 6 / 10 / 14 / 20 / 999`. Most UI is at `10px`. Inputs at
`6px`. Pills for status chips (`999px`). Buttons at `10px`. Avatars `999px`.

**Shadows** — low, warm, never drop-shadow glamour. The ink color in
rgba is used for lift, never pure black. Three tiers:
`--shadow-1` (hover lift), `--shadow-2` (cards), `--shadow-3` (modals).
**Inset highlight** on primary buttons: a 1px top-inner-white to give
physical depth — WhereTF is a physical-world product and the UI should feel
tactile.

**Motion** — **fast and physical**. Transitions are `120–320ms`, `ease-out`
by default, **never bouncy**. The vibe is "the drawer slides open", not
"the button wiggles hello". Hover states: `filter: brightness(1.05)` on
brand surfaces, 6% darker on neutrals. Press: `scale(0.98)` for buttons,
immediate color tick-down. Focus: 3px `--focus-ring` (45% orange, color-mix).

**Transparency & blur** — `backdrop-filter: blur(12px)` on the sticky top
nav when scrolled over content, nowhere else. Glass-everywhere is a
Chromebook trope and off-brand here.

**Imagery tone** — when photography is used: **warm, shop-lit,
cluttered but organized**. Bins, drawers, hands. Never stock-photo
whiteboards-and-suits. Grain is welcome. No saturated color grading.

**Cards** — 1px hairline + `--shadow-1` at rest, `--shadow-2` on hover,
`+1px translate-y(-2px)` on hover. No border-left-accent tropes.

**Protection gradients** — only when photography forces it. A 30% ink
top-to-transparent scrim for overlaid headlines.

---

## Iconography

**System** — a **24-icon custom set** in `assets/icons/`, drawn at 48×48,
**2.5px stroke**, rounded caps & joins, `currentColor`. Outline-only by
default; fills reserved for "selected" and "found" states. The stroke
weight and rounding intentionally echo the wordmark geometry.

**Part-category icons** — `part-chip`, `part-nut`, `part-resistor`,
`part-spool`, `part-bit`. These are the spiritual descendants of the
characters from the original logo — same cast, promoted from logo
decoration to functional taxonomy.

**UX icons** — `module`, `bin`, `item`, `search`, `scan`, `pin`,
`barcode`, `plus`, `check`, `close`, `filter`, `settings`, `user`,
`menu`, `grid`, `folder`, `sparkle`, plus chevron/arrow navigation.

**Emoji** — never in product UI. OK on marketing social, sparingly, and
only orange-aligned ones (🟠 🔥 🎯). Never 🚀.

**Unicode as icons** — no. Use SVG. The only exception is the numeric
superscript `²` in part descriptions if needed.

**CDN fallback** — if you need something not in the set, use
**Lucide** (`https://unpkg.com/lucide-static`). Match the 2.5px stroke.
Document the borrow in a comment.

---

## Using this system

- **Import `colors_and_type.css` once.** Everything else hangs off its
  custom properties.
- **Wrap the app in `<html data-theme="light">` or `"dark"`**. Both are
  first-class.
- **Copy `assets/` into your project** — never hot-link.
- **Component recreations** live in `ui_kits/`. They're reference, not
  production.

---

## What's missing / open questions for the user

- Real font files (currently pulling Space Grotesk + JetBrains Mono from
  Google Fonts). Drop TTFs into `fonts/` and swap `@font-face`.
- A real codebase or Figma to calibrate the UI kit against. Without it,
  this is a well-informed proposal, not a recreation.
- Exact free-tier limits (affects copy on the pricing page).
- Decision on which of the four logo explorations ships.
