# UI Layout Patterns

Standard layout patterns used across WhereTF screens. Follow these when building new screens.

---

## Shell

Every page shares a persistent shell:

```
┌────┬────────────────────────────────────────────────────────┐
│    │  Topbar / breadcrumb                                   │
│ S  ├──────────┬────────────────────────┬───────────────────┤
│ I  │          │                        │                   │
│ D  │  Left    │  Center                │  Right            │
│ E  │  Panel   │  Panel                 │  Panel            │
│ B  │  ~280px  │  flex: 1               │  ~320px           │
│ A  │          │                        │                   │
│ R  │          │                        │                   │
│    │          │                        │                   │
└────┴──────────┴────────────────────────┴───────────────────┘
```

### Sidebar (icon rail)

- Width: 52–56px, fixed
- Background: `#1e293b`, border-right: `1px solid #334155`
- Icons: 32×32px, 6px border-radius, centered
- States: default `#94a3b8`, hover/active `#ff6600` with `#334155` background
- Links: Modules, Items, Templates, Activity (transaction log), Taxonomy (admin)
- Collapse state persists

### Topbar

- Height: ~44px, background: `#1e293b`, border-bottom
- Contains breadcrumb navigation
- Breadcrumb segments are clickable links; current segment is plain text

---

## Three-Panel Layout

The standard content layout. All primary screens use this pattern.

### Left Panel — Search & Filtering

- Width: ~280px, fixed, background: `#1e293b`, border-right
- Scrollable independently
- Contents, top to bottom:
  1. **Search input** — full-width, icon left, clear button right. Accent border on focus.
  2. **Active filter pills** — removable chips showing current filters. AND logic. Each pill: `Label: Value` with × dismiss.
  3. **Entity list / category filter** — scrollable list of selectable items (categories, entities, tree nodes). Each row: icon/indicator, name, count badge. Click to filter or navigate. Active state: accent highlight.

### Center Panel — Primary Content

- Flex: 1, fills remaining width
- Contains a header bar (title, count, actions) pinned at top
- Main content is a data table or grid:
  - Sticky header row with sortable columns
  - Frozen first column(s) (name + icon)
  - Alternating row backgrounds: `#0f172a` / `#111827`
  - Hover: `#1a2332`
  - Selected: `#1a0f00` with 3px left accent border
  - Inline cell editing on double-click
- FAB (floating action button) at bottom-right for primary create action: 48px circle, `#ff6600`, `+` icon

### Right Panel — Detail / Properties

- Width: ~320px, fixed, background: `#1e293b`, border-left
- Scrollable independently
- Empty state: centered muted text ("Select an item to view details")
- When populated:
  1. **Header** — entity name (editable inline, click-to-edit), description (editable)
  2. **Sections** — each with uppercase label header, border-bottom, content below
  3. **Tags/chips** — for categories, relationships. Removable (×), add button (`+ Add` with dashed border)
  4. **Collapsible groups** — chevron toggle, completeness badges
  5. **Actions** — danger zone at bottom (delete/hide)

---

## Visual Constants

| Token | Value | Usage |
|-------|-------|-------|
| Accent | `#ff6600` | Selection, active states, primary actions, FAB |
| Background (deep) | `#0f172a` | Body, inputs, table rows |
| Background (surface) | `#1e293b` | Panels, cards, headers |
| Background (hover) | `#334155` | Interactive hover states |
| Border | `#334155` | Panel borders, dividers, card borders |
| Text primary | `#e2e8f0` | Body text |
| Text secondary | `#94a3b8` | Labels, descriptions |
| Text muted | `#64748b` | Counts, hints, disabled |
| Text placeholder | `#475569` | Input placeholders, empty values |
| Danger | `#ef4444` | Delete actions, remove buttons |
| Success | `#22c55e` | Complete indicators |
| Warning | `#f59e0b` | Partial indicators |

## Component Patterns

### Search Input
```
┌──────────────────────────┐
│ 🔍  Search items...    × │
└──────────────────────────┘
```
- Background: `#0f172a`, border: `#334155`, focus border: `#ff6600`
- 13px font, 8px padding

### Filter Pill
```
┌────────────────────┐
│ Label: Value    ×  │
└────────────────────┘
```
- Background: `#1a0f00`, border: `#ff660044`, text: `#ff6600`
- 11px font, 4px 8px padding, 12px border-radius

### Section Header
```
SECTION TITLE                          + Action
─────────────────────────────────────────────────
```
- 10–11px uppercase, letter-spacing 0.05–0.08em, color: `#64748b`
- Border-bottom: `1px solid #334155`

### Badge
```
┌────────┐
│ label  │
└────────┘
```
- 10px font, 2px 8px padding, 10px border-radius
- Color-coded by type: blue (receptacle), purple (fixed), green (active), red (disabled)

### Undo Toast
- Fixed bottom-center, `#1e293b` background, border, shadow
- Message + orange "Undo" button, auto-dismiss after 5 seconds
- Animation: slide up from below

### Dropdown Menu
- Absolute positioned, `#1e293b` background, border, shadow
- Items: 6px 12px padding, hover: `#334155`
- Max-height with scroll

### Inline Edit
- Click element → replace with input
- Input: accent border, same font as display element
- Save on blur/Enter, cancel on Escape

---

## Layout Variations

### Two-Panel (definition/config screens)

For screens that don't need left-panel filtering (e.g., module detail, template detail):

```
┌────┬──────────────────────┬────────────────────────────────┐
│    │  Entity List /       │  Preview / Grid                │
│ S  │  Configuration       │  + Properties sidebar          │
│    │  (panel-left)        │  (panel-right)                 │
└────┴──────────────────────┴────────────────────────────────┘
```

- Left side: entity list or configuration form
- Right side: visual preview (SVG grid) with optional properties panel alongside

### Card Grid (entry points)

Module list, template list — card grid layout before drilling into detail:
- `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`
- Cards: `#1e293b` background, `#334155` border, hover: accent border
- 16px gap, 24px padding

---

## Interaction Rules

These apply everywhere. See [ui-paradigms.md](ui-paradigms.md) for full details.

1. **No right-click menus** — all actions via visible UI
2. **Undo, not confirm** — destructive actions execute immediately with undo toast
3. **Click to select** — click again to deselect, Ctrl+click for multi-select
4. **Inline editing** — click/double-click to edit in place, save on blur
5. **Filter from value** — funnel icon on parameter values adds filter pill
