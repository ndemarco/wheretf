# WhereTF - Workshop Inventory System

## What Is This?

WhereTF is an AI-powered workshop inventory system that helps you track where things are stored. Instead of manually cataloging items in spreadsheets or databases, you simply tell the AI what you have and where you put it using natural language.

The core question this app answers: **"Where the f*** did I put that thing?"**

## The Problem It Solves

Workshop storage is chaotic. You have:
- Drawer units with dozens of small compartments
- Shelving units with bins and boxes
- Tackle boxes, parts organizers, Gridfinity systems
- Items that span multiple cells (long screws, oversized components)

Traditional inventory systems require you to:
1. Define a rigid schema upfront
2. Manually enter items with exact locations
3. Remember the exact terminology you used

WhereTF flips this: you describe things naturally, and the AI figures out the structure.

## Core Concepts

### Storage Modules

A **module** is any physical storage unit with a name and dimensional structure:

```
NEON (IKEA ALEX drawer unit)
├── drawer-1 (Gridfinity baseplate)
│   ├── row-A, row-B, ... row-F
│   └── col-1, col-2, ... col-14
├── drawer-2
│   └── (same grid structure)
└── ...

MUSE (wire shelving unit)
├── level-1 (open shelf)
├── level-2 (Plano 3700 tackle box)
│   ├── row-1..4
│   └── col-1..7
└── level-Construction Screws (labeled bin)
```

Modules support:
- **Hierarchical dimensions**: level → row → col
- **Subdimensions**: A drawer can contain a grid
- **Storage types**: Known organizers (Plano, Gridfinity) with predefined grids
- **Cell merging**: For items that span multiple compartments
- **Named locations**: "Construction Screws" instead of "level-3"

### Location Paths

Every item has a location path in the format:
```
MODULE:dim-value:dim-value:...
```

Examples:
- `NEON:drawer-2:row-A:col-5` - Specific cell in a drawer
- `MUSE:level-Construction Screws` - Named shelf/bin
- `MUSE:level-2:row-1:col-3` - Cell in a tackle box on a shelf

### Items

Items are stored with:
- **Name**: "10k ohm resistors"
- **Description**: Optional details
- **Parameters**: Key-value pairs (resistance: 10k, tolerance: 5%)
- **Location**: Path to where it's stored

## Architecture

### Multi-Agent System

The app uses a **router + specialist** agent pattern:

```
User Message
     │
     ▼
┌─────────┐
│ Router  │ ← Lightweight (gpt-4o-mini), decides which specialist to invoke
└────┬────┘
     │
     ├──► Module Agent: Creates/modifies storage structures
     ├──► Inventory Agent: Adds/updates/moves items
     └──► Search Agent: Finds items by name, description, or location
```

Each specialist has:
- Specific tools it can call
- Domain-specific instructions
- Access to the same underlying data

### Data Flow

```
User: "Add M4 screws to NEON drawer 3, position B5"
                    │
                    ▼
            ┌──────────────┐
            │    Router    │
            └──────┬───────┘
                   │ runInventoryAgent
                   ▼
            ┌──────────────┐
            │  Inventory   │
            │    Agent     │
            └──────┬───────┘
                   │ 1. searchModules("NEON")
                   │ 2. validatePath("NEON:drawer-3:row-B:col-5")
                   │ 3. createItem(...)
                   ▼
            ┌──────────────┐
            │   MongoDB    │
            └──────────────┘
```

### Visual Navigation (Storage Navigator)

When the AI returns search results, the UI extracts location data and displays:

```
┌─────────────────────────────────────────────────────────────────┐
│ Chat                    │ Results Panel  │ Location Map Panel   │
│                         │                │                      │
│ User: where are my      │ [1] M4 screws  │ NEON › drawer-3      │
│ M4 screws?              │     NEON/3/B5  │                      │
│                         │                │    1  2  3  4  5     │
│ AI: Found 1 item:       │ [2] M4 nuts    │  ┌─────────────────  │
│                         │     NEON/3/B6  │ A│                   │
│ 1. M4 screws            │                │ B│           [1][2]  │
│    📍 NEON/drawer-3/B5  │────────────────│ C│                   │
│                         │                │   └─────────────────  │
└─────────────────────────────────────────────────────────────────┘
```

**Results Panel** (narrow):
- Numbered list of items from search results
- Grouped by chat message with visual separators
- Clicking a result opens the Location Map

**Location Map Panel** (wider):
- Shows grid visualization of the selected location
- Highlights where search results are located
- Gray = occupied cell, Colored = search result

### Clickable Location Links

The AI outputs locations as clickable markdown links using a custom `loc://` protocol:

```markdown
[📍 NEON / drawer-3 / row-B / col-5](loc://NEON/drawer-3/row-B/col-5)
```

Clicking these links:
1. Selects the corresponding result in the Results Panel
2. Opens the Location Map showing that cell
3. Highlights the chat message that produced the result

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React, Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: MongoDB with Mongoose
- **AI**: OpenAI GPT-4o / GPT-4o-mini
- **Auth**: NextAuth.js

## Key Files

```
web/
├── app/
│   ├── api/
│   │   ├── chat/route.ts          # Main chat endpoint
│   │   ├── modules/grid/route.ts  # Grid data for Location Map
│   │   └── ...
│   └── (protected)/
│       └── chat/page.tsx          # Chat UI
├── components/
│   ├── chat/
│   │   ├── ChatContainer.tsx      # Main chat + side panels
│   │   ├── ChatMessage.tsx        # Message rendering
│   │   └── ChatInput.tsx          # Input with image upload
│   └── location/
│       ├── ResultsList.tsx        # Results side panel
│       ├── LocationMapPanel.tsx   # Grid visualization panel
│       └── StorageGrid.tsx        # Grid renderer
├── lib/
│   ├── seeds/
│   │   ├── agents.ts              # Agent definitions & instructions
│   │   └── tools.ts               # Tool definitions
│   ├── agentRunner.ts             # Executes agent with tools
│   ├── locationExtractor.ts       # Extracts results from tool calls
│   └── pathValidator.ts           # Validates location paths
├── models/
│   ├── StorageModule.ts           # Module schema
│   ├── Item.ts                    # Item schema
│   └── Agent.ts                   # Agent configuration
└── repositories/
    ├── moduleRepository.ts
    ├── itemRepository.ts
    └── agentRepository.ts
```

## Design Principles

1. **Natural language first**: Users shouldn't need to learn a query language
2. **Result-driven navigation**: The visual shows where results are, not a full inventory browser
3. **Flexible location parsing**: "drawer 2 A5", "2nd drawer position A/5", "NEON:drawer-2:row-A:col-5" all work
4. **Progressive structure**: Start with simple locations, add grids and subdimensions as needed
5. **Known storage types**: Common organizers (Plano, Gridfinity) have predefined structures
