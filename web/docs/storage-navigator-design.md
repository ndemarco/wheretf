# Storage Navigator Design Specification

## Overview

A visual storage navigator that bridges the gap between AI text responses and physical workshop locations. When the AI mentions locations, they appear highlighted in a visual view.

## Layout: Dual Side Panels

The design uses **two side panels** to the right of the chat:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Chat                    │ Results Panel        │ Location Map Panel         │
│                         │                      │                            │
│ User: where are my      │ RESULTS              │ NEON › Drawer 3            │
│ M6 screws?              │                      │                            │
│                         │ [1] 10mm Flat Washer │    1  2  3  ... 12 13 14  │
│ AI: Found 2 items:      │     MUSE / Constr... │  ┌─────────────────────────│
│                         │                      │ A│           ■        [1]  │
│ • 10mm Flat Washer      │ [2] M6x20 BHCS       │ B│     ■                   │
│   [loc button]          │     NEON / drawer 5  │ C│                         │
│                         │                      │ D│  ■     ■                │
│                         │                      │ E│                         │
│                         │                      │ F│        ■                │
│                         │                      │   └─────────────────────────│
└─────────────────────────────────────────────────────────────────────────────┘
```

### Panel 1: Results Panel (always visible when results exist)
- Numbered list of search results
- Each result shows: number badge, item name, location path
- Clicking a result opens/updates the Location Map Panel

### Panel 2: Location Map Panel (opens when a result is selected)
- Shows hierarchical breadcrumb: MODULE › dimension-value
- Displays grid visualization of that specific level/drawer
- Grid shows: empty cells (nothing), occupied cells (gray), result cells (colored + numbered)

## Key Behaviors

### Result-Driven Navigation
The visual should be **driven by the results**, not by browsing:
- Click result [1] → Shows NEON › Drawer 3 grid with [1] at A12
- Click result [2] → View switches to NEON › Drawer 5 grid with [2] at B3
- If two results are in same drawer, both numbers appear on the grid simultaneously

### Cell Visualization
- **Empty cells**: Nothing rendered (white/transparent)
- **Occupied cells**: Solid gray block (has item, but not in current results)
- **Result cells**: Colored + numbered, matching result list
  - Result 1: Blue with "1"
  - Result 2: Green with "2"
  - etc. (cycle through distinct colors)

### Module Queries
For "tell me about NEON" queries (no item results), show module summary:
```
│  NEON                           │
│  10 drawers × Gridfinity 6×14   │
│                                 │
│  ┌───┬───┬───┬───┬───┐          │
│  │ 1 │ 2 │ 3 │ 4 │ 5 │          │
│  ├───┼───┼───┼───┼───┤          │
│  │ 6 │ 7 │ 8 │ 9 │10 │          │
│  └───┴───┴───┴───┴───┘          │
│                                 │
│  Click drawer to explore        │
```
Clicking a drawer shows its grid with occupied cells marked.

### Clickable Location Links
AI outputs locations as clickable markdown links using `loc://` URI scheme:
```
[📍 MUSE / level-Construction Screws](loc://MUSE/level-Construction%20Screws)
```
- Renders as blue button in chat
- Clicking selects that location in the Results Panel
- Highlights the corresponding chat message

## Interaction Flow

1. User asks "where are my washers?"
2. AI responds with results containing `loc://` links
3. Results Panel populates with numbered results extracted from tool call data
4. User clicks a result OR clicks the loc:// button in chat
5. Location Map Panel opens showing the grid with that result highlighted
6. Chat message that produced the result gets a blue highlight ring

## What NOT to Show
- Occupancy statistics (user prefers to ask these as questions)
- Hover tooltips (not important for initial version)
- Module picker/browser (result-driven, not browsing)

## Technical Notes

### Location Path Format
Internal format: `MODULE:dim-value:dim-value:...`
Example: `MUSE:level-Construction Screws`

### loc:// URI Format
`loc://MODULE/dim-value/dim-value/...`
- URL-encode spaces as %20
- Example: `loc://MUSE/level-Construction%20Screws`

### Data Flow
1. AI tool calls contain `searchItems` results with `location` field
2. `locationExtractor.ts` extracts results from tool calls (including nested agent calls)
3. Results grouped by message index for highlighting
4. `ResultsPanel` displays results list
5. Selecting a result fetches grid data from `/api/modules/grid`
6. `StorageGrid` renders the visualization
