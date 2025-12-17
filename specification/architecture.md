# WhereTF - Workshop Inventory System

## Overview

AI-powered inventory management system for workshop organization. Users describe items through voice, text, or images via a chat interface. The AI agent identifies items, assigns parameters, and stores location information.

## Tech Stack

- **Frontend**: Next.js (App Router)
- **Database**: MongoDB with Mongoose ODM
- **AI**: OpenAI (GPT-4o with vision for multimodal input)
- **Authentication**: NextAuth.js v5 with Google OAuth
- **Deployment**: Docker

## Core Concepts

### Parameters (not Labels)
Items are described by parameters with key/value/unit structure:
- `{ key: "material", value: "stainless steel" }`
- `{ key: "length", value: "10", unit: "mm" }`

Parameter keys are not unique per item - an item can have multiple parameters with the same key (e.g., a pipe reducer with two different thread sizes).

### Storage Modules
Storage units (cabinets, shelves, drawer units) are defined as modules with a hierarchical dimension structure. Modules describe what valid location paths look like but do not generate location records.

### Location Paths
Items have a location path string like:
- `MUSE:level-3:row-2:col-5`
- `PRUSA:drawer-1:box-yellow:row-2:col-3`
- `FLUX:level-5:bin-8`

Format: `MODULE:dimension-value:dimension-value:...`

### Single Source of Truth
- Items are the source of truth for inventory
- Modules describe valid path structures (schema/validation)
- No separate Location collection - paths live on items

### One Item Per Location
Each location path can only have one item (enforced by unique constraint). Items represent a category of things in a bin, not individual pieces (e.g., "5V relays" not "5V relay x 24").

### Multi-Tenant
All data is scoped to authenticated users. Each user has their own modules, items, sessions, etc.

## Architecture

```
+-------------------------------------------------------------+
|                      Next.js Frontend                        |
|  +-------------------------------------------------------+  |
|  |  /auth/signin    /chat         /sessions   /settings  |  |
|  |  Sign In Page    Chat UI       Session     Agent      |  |
|  |  (Google OAuth)  - Text        History     Config     |  |
|  |                  - Images                             |  |
|  |                  - Voice                              |  |
|  |                  - Context %                          |  |
|  +-------------------------------------------------------+  |
+-------------------------------------------------------------+
                            |
                            v
+-------------------------------------------------------------+
|                    Next.js API Routes                        |
|  +-------------------------------------------------------+  |
|  | /api/auth/*     /api/chat    /api/sessions            |  |
|  | NextAuth        Agent Runner  Session CRUD            |  |
|  |                                                       |  |
|  | /api/agents     /api/modules  /api/items              |  |
|  | Agent CRUD      Module CRUD   Item CRUD               |  |
|  +-------------------------------------------------------+  |
+-------------------------------------------------------------+
                            |
            +---------------+---------------+
            v               v               v
+---------------+   +---------------+   +-------------------+
|    OpenAI     |   |   Agent       |   |     MongoDB       |
|   (GPT-4o)    |   |   Runner      |   |                   |
|   - Vision    |   |               |   | - users           |
|   - Chat      |   | Router Agent  |   | - sessions        |
+---------------+   |      |        |   | - items           |
                    |      v        |   | - modules         |
                    | +-----------+ |   | - templates       |
                    | | Module    | |   | - agents          |
                    | | Inventory | |   | - tools           |
                    | | Search    | |   | - parameterKeys   |
                    | +-----------+ |   | - units           |
                    +---------------+   +-------------------+
```

## Agent Architecture

```
User Input (text/image/voice)
           |
           v
+---------------------+
|    Router Agent     |
|                     |
|    Tools:           |
|    - runModuleAgent |---> Module Agent
|    - runInventory   |---> Inventory Agent
|    - runSearchAgent |---> Search Agent
+---------------------+
           |
           v
+---------------------------------------------+
|               Tool Layer                     |
|  DB Tools:              Agent Tools:         |
|  - createModule         - runModuleAgent     |
|  - searchItems          - runInventoryAgent  |
|  - createItem           - runSearchAgent     |
|  - searchParams                              |
|  - createParam                               |
|  - validatePath                              |
+---------------------------------------------+
           |
           v
      [ MongoDB ]
```

## Pages

| Route | Description | Auth Required |
|-------|-------------|---------------|
| `/` | Landing page | No |
| `/auth/signin` | Google sign in | No |
| `/chat` | Main chat interface | Yes |
| `/sessions` | Session history | Yes |
| `/settings/agents` | Agent configuration | Yes |
| `/settings/tools` | Tool configuration | Yes |

## User Workflows

### 1. Sign In
User signs in with Google OAuth. Redirected to chat.

### 2. Define Storage Module
User shows a photo or describes a storage unit. AI creates a module definition describing valid paths.

### 3. Inventory Items
User goes through bins describing contents. AI:
1. Identifies items from input (text/image/voice)
2. Proposes parameters (checking existing parameter keys first)
3. Confirms with user
4. Creates item with location path

### 4. Find Items
User describes what they need. AI searches by:
- Text search on name/description
- Parameter matching
- Location prefix queries

### 5. Manage Sessions
User can:
- View session history
- Resume previous sessions
- Compress sessions when context gets full
- Delete sessions

## Specification Documents

- [Data Models](./data-models.md) - MongoDB/Mongoose schemas
- [Agents](./agents.md) - AI agent definitions, tools, seed data
- [AI Engine](./ai-engine.md) - Agent runner, tool execution
- [Sessions](./sessions.md) - Session management, context tracking, compression
- [Authentication](./authentication.md) - NextAuth.js, Google OAuth, route protection
- [Frontend](./frontend.md) - UI layout, pages, components

Also see [AGENTS.md](../AGENTS.md) in the project root for development patterns and conventions.
