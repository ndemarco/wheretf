# Frontend Specification

## Overview

Next.js App Router application with a simple layout: sidebar navigation + main content area. The primary interface is an AI chat window.

## Pages

| Route | Description | Auth |
|-------|-------------|------|
| `/` | Landing page with sign-in CTA | No |
| `/auth/signin` | Google OAuth sign-in | No |
| `/auth/error` | Auth error page | No |
| `/chat` | Main chat interface (new session) | Yes |
| `/chat/:sessionId` | Chat with specific session | Yes |
| `/sessions` | Session history list | Yes |
| `/settings` | Settings overview | Yes |
| `/settings/agents` | Agent list | Yes |
| `/settings/agents/new` | Create new agent | Yes |
| `/settings/agents/:name` | Edit agent | Yes |
| `/settings/tools` | Tool list (toggle active) | Yes |

## Directory Structure

```
app/
├── layout.js                  # Root layout (providers)
├── page.js                    # Landing page (public)
├── globals.css
├── auth/
│   ├── signin/page.js
│   └── error/page.js
└── (protected)/               # Route group - requires auth
    ├── layout.js              # Sidebar + header layout
    ├── chat/
    │   ├── page.js            # New chat
    │   └── [sessionId]/page.js
    ├── sessions/
    │   └── page.js
    └── settings/
        ├── page.js
        ├── agents/
        │   ├── page.js
        │   ├── new/page.js
        │   └── [name]/page.js
        └── tools/
            └── page.js

components/
├── layout/
│   ├── Sidebar.jsx
│   ├── Header.jsx
│   └── UserMenu.jsx
├── chat/
│   ├── ChatContainer.jsx
│   ├── MessageList.jsx
│   ├── Message.jsx
│   ├── MessageInput.jsx
│   ├── ImageUpload.jsx
│   ├── VoiceInput.jsx
│   └── ContextIndicator.jsx
├── agents/
│   ├── AgentList.jsx
│   ├── AgentCard.jsx
│   ├── AgentEditor.jsx
│   └── ToolSelector.jsx
└── sessions/
    ├── SessionList.jsx
    └── SessionCard.jsx

lib/
├── auth.js                    # NextAuth config
├── mongodb.js                 # MongoDB connection
├── agentRunner.js             # Agent execution
├── contextManager.js          # Token tracking
└── seeds/
    ├── index.js
    ├── agents.js
    └── tools.js
```

## Layout

### Protected Layout (sidebar + content)

```
+------------------------------------------------------------------+
|  LOGO   WhereTF                                              👤   |
+----------+-------------------------------------------------------+
|          |                                                       |
|  Chat    |                                                       |
|          |                                                       |
| Sessions |                    MAIN CONTENT                       |
|          |                                                       |
| -------- |                                                       |
|          |                                                       |
| Settings |                                                       |
|  Agents  |                                                       |
|  Tools   |                                                       |
|          |                                                       |
+----------+-------------------------------------------------------+
```

### Sidebar Navigation

```
+------------------+
|  WhereTF         |
+------------------+
|                  |
|  💬 Chat         |  <- /chat
|                  |
|  📋 Sessions     |  <- /sessions
|                  |
|  ────────────    |
|                  |
|  ⚙️ Settings     |  <- /settings
|     Agents       |  <- /settings/agents
|     Tools        |  <- /settings/tools
|                  |
+------------------+
|  👤 Nick         |
|  Sign Out        |
+------------------+
```

---

## Chat Interface (`/chat`)

The primary interface. Full-height chat window with input at bottom.

```
+------------------------------------------------------------------+
| Chat: Workshop Inventory                          Context: 62% ⚠️ |
+------------------------------------------------------------------+
|                                                                  |
|  USER                                                            |
|  This is MUSE, red cabinet, 11 levels with Plano boxes           |
|  📷 [image thumbnail]                                             |
|                                                                  |
|  ─────────────────────────────────────────────────────────────   |
|                                                                  |
|  ASSISTANT (Module Agent)                                        |
|  I'll set that up. Here's the module I'll create:                |
|                                                                  |
|  **MUSE**                                                        |
|  - 11 levels                                                     |
|  - Levels 1-8: 4×6 Plano grid                                    |
|  - Levels 9-11: 3×4 Plano grid                                   |
|                                                                  |
|  Does this look right?                                           |
|                                                                  |
|  ▶ Tool calls (2)                                                |
|                                                                  |
|  ─────────────────────────────────────────────────────────────   |
|                                                                  |
|  USER                                                            |
|  Yes, create it                                                  |
|                                                                  |
|  ─────────────────────────────────────────────────────────────   |
|                                                                  |
|  ASSISTANT (Module Agent)                                        |
|  ✓ Created MUSE module with 11 levels.                           |
|                                                                  |
+------------------------------------------------------------------+
| 📷  🎤  |  Type a message...                            | Send  |
+------------------------------------------------------------------+
```

### Chat Features

- **Message input**: Text area, Enter to send (Shift+Enter for newline)
- **Image upload**: Click button, drag & drop, or paste from clipboard
- **Voice input**: Web Speech API for voice-to-text
- **Context indicator**: Progress bar showing token usage (yellow at 75%, red at 90%)
- **Agent badge**: Shows which agent handled each response
- **Tool calls**: Collapsible section showing tool invocations
- **Markdown**: Render markdown in assistant messages

---

## Sessions Page (`/sessions`)

List of chat sessions with resume/delete actions.

```
+------------------------------------------------------------------+
| Sessions                                         [+ New Session]  |
+------------------------------------------------------------------+
|                                                                  |
| ACTIVE                                                           |
|                                                                  |
| +--------------------------------------------------------------+ |
| | Workshop Inventory                                           | |
| | Last active: 5 minutes ago | 47 messages | Context: 62%      | |
| |                                           [Resume] [Delete]  | |
| +--------------------------------------------------------------+ |
|                                                                  |
| +--------------------------------------------------------------+ |
| | Electronics Sorting                                          | |
| | Last active: 2 hours ago | 12 messages | Context: 15%        | |
| |                                           [Resume] [Delete]  | |
| +--------------------------------------------------------------+ |
|                                                                  |
| ARCHIVED                                                         |
|                                                                  |
| +--------------------------------------------------------------+ |
| | Initial Setup (compressed)                                   | |
| | Archived: Dec 14, 2024                                       | |
| | Summary: Created modules FLUX, MUSE, PRUSA...                | |
| |                                             [View] [Delete]  | |
| +--------------------------------------------------------------+ |
|                                                                  |
+------------------------------------------------------------------+
```

---

## Agent List (`/settings/agents`)

List of agents with edit/delete actions.

```
+------------------------------------------------------------------+
| Agents                                             [+ New Agent]  |
+------------------------------------------------------------------+
|                                                                  |
| SYSTEM AGENTS                                                    |
|                                                                  |
| +--------------------------------------------------------------+ |
| | Router                                                [Edit] | |
| | Routes requests to specialist agents                         | |
| | Model: gpt-4o | Tools: 3                                     | |
| +--------------------------------------------------------------+ |
|                                                                  |
| +--------------------------------------------------------------+ |
| | Module Agent                                          [Edit] | |
| | Creates and manages storage modules                          | |
| | Model: gpt-4o | Tools: 5                                     | |
| +--------------------------------------------------------------+ |
|                                                                  |
| +--------------------------------------------------------------+ |
| | Inventory Agent                                       [Edit] | |
| | Adds and manages inventory items                             | |
| | Model: gpt-4o | Tools: 10                                    | |
| +--------------------------------------------------------------+ |
|                                                                  |
| +--------------------------------------------------------------+ |
| | Search Agent                                          [Edit] | |
| | Finds items in inventory                                     | |
| | Model: gpt-4o | Tools: 2                                     | |
| +--------------------------------------------------------------+ |
|                                                                  |
| CUSTOM AGENTS                                                    |
|                                                                  |
| +--------------------------------------------------------------+ |
| | Electronics Sorter                           [Edit] [Delete] | |
| | Specialized for electronic components                        | |
| | Model: gpt-4o | Tools: 8                                     | |
| +--------------------------------------------------------------+ |
|                                                                  |
+------------------------------------------------------------------+
```

---

## Agent Editor (`/settings/agents/:name`)

Form to edit agent configuration.

```
+------------------------------------------------------------------+
| Edit Agent: Inventory Agent                            [← Back]   |
+------------------------------------------------------------------+
|                                                                  |
| BASIC INFO                                                       |
|                                                                  |
| Name              [inventory                    ] (readonly)     |
| Display Name      [Inventory Agent              ]                |
| Description       [Adds and manages inventory   ]                |
|                                                                  |
| MODEL                                                            |
|                                                                  |
| Model             [gpt-4o                    ▼]                  |
| Temperature       [0.7] --------●--------  (0.0 - 1.0)           |
|                                                                  |
| INSTRUCTIONS                                                     |
|                                                                  |
| +--------------------------------------------------------------+ |
| | You help users catalog items in their storage.               | |
| |                                                              | |
| | Your job:                                                    | |
| | 1. Identify items from text, images, or voice descriptions   | |
| | 2. Search existing parameter keys before creating new ones   | |
| | ...                                                          | |
| +--------------------------------------------------------------+ |
|                                                                  |
| TOOLS                                                            |
|                                                                  |
| Items                          Parameters                        |
| [x] searchItems                [x] searchParams                  |
| [x] createItem                 [x] createParam                   |
| [x] updateItem                 [x] searchUnits                   |
| [x] deleteItem                 [x] createUnit                    |
|                                                                  |
| Modules                        Utility                           |
| [x] searchModules              [x] validatePath                  |
| [ ] createModule                                                 |
| [ ] updateModule                                                 |
|                                                                  |
|                      [Reset to Default]    [Save Changes]        |
+------------------------------------------------------------------+
```

---

## Tool List (`/settings/tools`)

Read-only list of tools with active toggle.

```
+------------------------------------------------------------------+
| Tools                                                             |
+------------------------------------------------------------------+
|                                                                  |
| Tools are defined in code. Toggle to enable/disable.             |
|                                                                  |
| AGENT RUNNERS                                                    |
|                                                                  |
| [x] runModuleAgent                                               |
|     Invoke the Module Agent for storage module tasks             |
|                                                                  |
| [x] runInventoryAgent                                            |
|     Invoke the Inventory Agent for adding/updating items         |
|                                                                  |
| [x] runSearchAgent                                               |
|     Invoke the Search Agent for finding items                    |
|                                                                  |
| ITEMS                                                            |
|                                                                  |
| [x] searchItems                                                  |
|     Search inventory items by name, parameters, location         |
|                                                                  |
| [x] createItem                                                   |
|     Create a new inventory item                                  |
|                                                                  |
| [x] updateItem                                                   |
|     Update an existing item                                      |
|                                                                  |
| [x] deleteItem                                                   |
|     Delete an item                                               |
|                                                                  |
| MODULES                                                          |
|                                                                  |
| [x] searchModules                                                |
| [x] createModule                                                 |
| [x] updateModule                                                 |
|                                                                  |
| ...                                                              |
+------------------------------------------------------------------+
```

---

## API Endpoints

### Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send message, get AI response |

### Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions` | List user's sessions |
| POST | `/api/sessions` | Create new session |
| GET | `/api/sessions/:id` | Get session with messages |
| DELETE | `/api/sessions/:id` | Delete session |
| POST | `/api/sessions/:id/compress` | Compress session |

### Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents` | List agents |
| POST | `/api/agents` | Create agent |
| GET | `/api/agents/:name` | Get agent |
| PATCH | `/api/agents/:name` | Update agent |
| DELETE | `/api/agents/:name` | Delete agent |
| POST | `/api/agents/:name/reset` | Reset to default |

### Tools

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tools` | List tools |
| PATCH | `/api/tools/:name` | Toggle active |

---

## State Management

Minimal state management using:

- **NextAuth SessionProvider** - Auth state
- **React Query / SWR** - Data fetching and caching
- **React Context** - Chat state (current session, messages)

```javascript
// providers.js
<SessionProvider>        {/* NextAuth */}
  <QueryClientProvider>  {/* React Query */}
    <ChatProvider>       {/* Chat context */}
      {children}
    </ChatProvider>
  </QueryClientProvider>
</SessionProvider>
```

---

## Styling

- **Tailwind CSS** - Utility-first CSS
- **shadcn/ui** - Component library (optional)
- **Dark mode** - System preference or toggle

Simple, clean design. Focus on usability over aesthetics.
