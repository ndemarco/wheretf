# WhereTF - Development Guidelines

This document describes the patterns, conventions, and guidelines for developing the WhereTF application.

## Project Overview

WhereTF is an AI-powered workshop inventory management system. Users describe items through voice, text, or images via a chat interface. The AI identifies items, assigns parameters, and stores location information.

See the [specification/](./specification/) folder for detailed documentation:
- [architecture.md](./specification/architecture.md) - System overview
- [data-models.md](./specification/data-models.md) - MongoDB schemas
- [agents.md](./specification/agents.md) - AI agent definitions
- [ai-engine.md](./specification/ai-engine.md) - Agent runner
- [sessions.md](./specification/sessions.md) - Session management
- [authentication.md](./specification/authentication.md) - NextAuth setup
- [frontend.md](./specification/frontend.md) - UI specification

---

## Data Access Pattern

We use a **three-layer architecture** for data access:

```
┌─────────────────────────────────────────┐
│           API Routes (thin)             │  ← Request/response handling only
├─────────────────────────────────────────┤
│         Repository Layer                │  ← Business logic, validation
├─────────────────────────────────────────┤
│         Schema/Model Layer              │  ← Mongoose schemas, DB structure
└─────────────────────────────────────────┘
```

### 1. Schema Layer (`/models`)

Mongoose schemas define the data structure. **No business logic here.**

```javascript
// models/Item.js
import mongoose from 'mongoose';

const parameterValueSchema = new mongoose.Schema({
  key: { type: String, required: true, lowercase: true },
  value: { type: String, required: true },
  unit: { type: String, lowercase: true },
}, { _id: false });

const itemSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  description: String,
  parameters: [parameterValueSchema],
  location: { type: String, required: true, unique: true, index: true }
}, { timestamps: true });

itemSchema.index({ name: 'text', description: 'text' });
itemSchema.index({ 'parameters.key': 1, 'parameters.value': 1 });

export default mongoose.models.Item || mongoose.model('Item', itemSchema);
```

### 2. Repository Layer (`/repositories`)

All business logic lives here. Repositories handle:
- Validation
- Authorization (user scoping)
- Complex queries
- Data transformation
- Error handling

```javascript
// repositories/itemRepository.js
import Item from '@/models/Item';
import { validatePath } from '@/lib/pathValidator';

export async function create({ userId, name, description, parameters, location }) {
  // Validate location path
  const pathValidation = await validatePath(location, userId);
  if (!pathValidation.valid) {
    throw new Error(`Invalid location: ${pathValidation.error}`);
  }

  // Check for duplicate location
  const existing = await Item.findOne({ user: userId, location });
  if (existing) {
    throw new Error(`Location ${location} already has an item: ${existing.name}`);
  }

  // Create item
  const item = await Item.create({
    user: userId,
    name,
    description,
    parameters,
    location
  });

  return item;
}

export async function search({ userId, query, location, parameters }) {
  const filter = { user: userId };

  // Text search
  if (query) {
    filter.$text = { $search: query };
  }

  // Location prefix search
  if (location) {
    filter.location = { $regex: `^${location}` };
  }

  // Parameter filters
  if (parameters?.length) {
    filter.$and = parameters.map(p => ({
      parameters: { $elemMatch: { key: p.key, value: p.value } }
    }));
  }

  return Item.find(filter).sort({ updatedAt: -1 });
}

export async function update({ userId, location, updates }) {
  const item = await Item.findOne({ user: userId, location });
  if (!item) {
    throw new Error(`No item found at ${location}`);
  }

  Object.assign(item, updates);
  await item.save();

  return item;
}

export async function remove({ userId, location }) {
  const result = await Item.deleteOne({ user: userId, location });
  if (result.deletedCount === 0) {
    throw new Error(`No item found at ${location}`);
  }
  return { success: true };
}
```

### 3. API Layer (`/app/api`)

API routes are **thin**. They only handle:
- Request parsing
- Authentication check
- Calling repository methods
- Response formatting

**No business logic in API routes.**

```javascript
// app/api/items/route.js
import { auth } from '@/lib/auth';
import * as itemRepo from '@/repositories/itemRepository';

export async function GET(request) {
  const session = await auth();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  const location = searchParams.get('location');

  try {
    const items = await itemRepo.search({
      userId: session.user.id,
      query,
      location
    });
    return Response.json({ items });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export async function POST(request) {
  const session = await auth();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  try {
    const item = await itemRepo.create({
      userId: session.user.id,
      ...body
    });
    return Response.json({ item }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
```

---

## Directory Structure

```
wheretf/
├── AGENTS.md                    # This file
├── specification/               # Design docs
│
├── app/                         # Next.js App Router
│   ├── layout.js
│   ├── page.js                  # Landing page
│   ├── globals.css
│   ├── providers.js             # Client providers
│   │
│   ├── api/                     # API routes (thin)
│   │   ├── auth/[...nextauth]/
│   │   ├── chat/
│   │   ├── sessions/
│   │   ├── agents/
│   │   ├── tools/
│   │   ├── items/
│   │   └── modules/
│   │
│   ├── auth/                    # Auth pages
│   │   ├── signin/
│   │   └── error/
│   │
│   └── (protected)/             # Authenticated routes
│       ├── layout.js
│       ├── chat/
│       ├── sessions/
│       └── settings/
│
├── components/                  # React components
│   ├── layout/
│   ├── chat/
│   ├── agents/
│   └── sessions/
│
├── models/                      # Mongoose schemas
│   ├── User.js
│   ├── Session.js
│   ├── Item.js
│   ├── StorageModule.js
│   ├── DimensionTemplate.js
│   ├── ParameterKey.js
│   ├── Unit.js
│   ├── Agent.js
│   └── Tool.js
│
├── repositories/                # Business logic
│   ├── itemRepository.js
│   ├── moduleRepository.js
│   ├── templateRepository.js
│   ├── parameterRepository.js
│   ├── unitRepository.js
│   ├── sessionRepository.js
│   ├── agentRepository.js
│   └── toolRepository.js
│
├── lib/                         # Shared utilities
│   ├── auth.js                  # NextAuth config
│   ├── mongodb.js               # DB connection
│   ├── openai.js                # OpenAI client
│   ├── agentRunner.js           # Agent execution
│   ├── toolHandlers.js          # Tool -> repository mapping
│   ├── contextManager.js        # Token tracking
│   ├── pathValidator.js         # Location path validation
│   └── seeds/                   # Seed data
│       ├── index.js
│       ├── agents.js
│       ├── tools.js
│       ├── parameters.js
│       └── units.js
│
└── hooks/                       # React hooks
    ├── useChat.js
    ├── useAgents.js
    ├── useSessions.js
    └── useTools.js
```

---

## Coding Conventions

### General

- **TypeScript optional** - Start with JavaScript, add TypeScript later if needed
- **ES Modules** - Use `import/export`, not `require`
- **Async/await** - Prefer over `.then()` chains
- **Early returns** - Fail fast, reduce nesting

### Naming

| Type | Convention | Example |
|------|------------|---------|
| Files (components) | PascalCase | `MessageList.jsx` |
| Files (utilities) | camelCase | `agentRunner.js` |
| Files (models) | PascalCase | `StorageModule.js` |
| Variables | camelCase | `userId`, `itemCount` |
| Constants | UPPER_SNAKE | `MAX_TOKENS`, `WARNING_THRESHOLD` |
| React components | PascalCase | `ChatContainer` |
| Functions | camelCase | `createItem`, `validatePath` |
| Database fields | camelCase | `createdAt`, `isSystem` |

### Repository Pattern

All repository methods receive an object with named parameters:

```javascript
// Good
export async function create({ userId, name, location }) { ... }

// Bad
export async function create(userId, name, location) { ... }
```

All repository methods that access user data **must** include `userId` for scoping:

```javascript
// Good - always scope by user
const items = await Item.find({ user: userId, ... });

// Bad - no user scoping
const items = await Item.find({ location }); // Security issue!
```

### Error Handling

Repositories throw errors. API routes catch and format them:

```javascript
// Repository - throws
export async function create({ userId, name }) {
  if (!name) {
    throw new Error('Name is required');
  }
  // ...
}

// API route - catches
try {
  const item = await itemRepo.create({ ... });
  return Response.json({ item });
} catch (error) {
  return Response.json({ error: error.message }, { status: 400 });
}
```

### API Responses

Consistent response format:

```javascript
// Success
{ items: [...] }
{ item: {...} }
{ session: {...} }

// Error
{ error: "Error message" }

// With metadata
{
  items: [...],
  pagination: { page: 1, total: 50 }
}
```

---

## Frontend Patterns

### Server vs Client Components

- **Server Components** (default) - Data fetching, no interactivity
- **Client Components** (`'use client'`) - Interactivity, hooks, browser APIs

```javascript
// Server component (default) - fetches data
// app/(protected)/sessions/page.js
import { auth } from '@/lib/auth';
import { SessionList } from '@/components/sessions/SessionList';

export default async function SessionsPage() {
  const session = await auth();
  // Can fetch data directly here
  return <SessionList userId={session.user.id} />;
}

// Client component - handles interaction
// components/sessions/SessionList.jsx
'use client';

import { useSessions } from '@/hooks/useSessions';

export function SessionList({ userId }) {
  const { sessions, deleteSession } = useSessions(userId);
  // Can use hooks, handle clicks, etc.
}
```

### Data Fetching

Use React Query (or SWR) for client-side data fetching:

```javascript
// hooks/useSessions.js
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useSessions() {
  const queryClient = useQueryClient();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => fetch('/api/sessions').then(r => r.json())
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => fetch(`/api/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries(['sessions'])
  });

  return {
    sessions: sessions?.sessions ?? [],
    isLoading,
    deleteSession: deleteMutation.mutate
  };
}
```

### Component Structure

Keep components focused. Split when they get too large:

```javascript
// ChatContainer.jsx - orchestrates
export function ChatContainer({ sessionId }) {
  const { messages, sendMessage, context } = useChat(sessionId);

  return (
    <div className="chat-container">
      <ChatHeader context={context} />
      <MessageList messages={messages} />
      <MessageInput onSend={sendMessage} />
    </div>
  );
}

// MessageList.jsx - displays messages
export function MessageList({ messages }) {
  return (
    <div className="message-list">
      {messages.map(msg => (
        <Message key={msg.id} message={msg} />
      ))}
    </div>
  );
}

// Message.jsx - single message
export function Message({ message }) {
  // ...
}
```

---

## Seed Data

Default agents and tools are defined in code and seeded on first run.

### When to Seed

- On first authenticated request (check if user has agents)
- Via explicit setup endpoint
- On application startup (for global tools)

### Seed Strategy

```javascript
// lib/seeds/index.js
export async function seedDefaults(userId) {
  // Global data (no userId)
  await seedTools();

  // Per-user data
  await seedAgents(userId);
  await seedParameterKeys(userId);
  await seedUnits(userId);
}

// Use $setOnInsert to only create if not exists
await Agent.findOneAndUpdate(
  { user: userId, name: agent.name },
  { $setOnInsert: { ...agent, user: userId } },
  { upsert: true }
);
```

---

## Testing

(To be expanded)

- Unit tests for repository methods
- Integration tests for API routes
- E2E tests for critical user flows

---

## Environment Variables

```bash
# .env.local

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# MongoDB
MONGODB_URI=mongodb://localhost:27017/wheretf

# OpenAI
OPENAI_API_KEY=your-openai-key
```

---

## Common Tasks

### Adding a New Model

1. Create schema in `/models/NewModel.js`
2. Create repository in `/repositories/newModelRepository.js`
3. Create API routes in `/app/api/new-model/`
4. Add to seed data if needed

### Adding a New Tool

1. Add tool definition to `/lib/seeds/tools.js`
2. Add handler mapping in `/lib/toolHandlers.js`
3. Implement handler in appropriate repository
4. Assign to relevant agents

### Adding a New Agent

1. Add agent definition to `/lib/seeds/agents.js`
2. Add `runNewAgent` tool if it should be callable from router
3. Assign appropriate tools to the agent
