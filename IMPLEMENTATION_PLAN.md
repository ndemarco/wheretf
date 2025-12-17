# WhereTF Implementation Plan

## Phase 1: Project Setup

- [x] Initialize Next.js project with App Router
- [x] Install core dependencies
  - [x] mongoose
  - [x] next-auth + @auth/mongodb-adapter
  - [x] openai
  - [x] tailwindcss
  - [x] @tanstack/react-query
- [x] Set up environment variables (.env.local.example)
- [x] Configure Tailwind CSS
- [x] Set up MongoDB connection (lib/mongodb.ts)
- [x] Create base layout and providers

## Phase 2: Authentication

- [x] Configure NextAuth with Google provider (lib/auth.ts)
- [x] Create User model (extends NextAuth default)
- [x] Set up auth API routes (app/api/auth/[...nextauth])
- [x] Create auth middleware for protected routes
- [x] Build sign-in page (app/auth/signin)
- [x] Build error page (app/auth/error)
- [x] Add SessionProvider to root layout (in providers.tsx)
- [x] Test auth flow end-to-end (build passes)

## Phase 3: Data Layer - Models & Repositories

### Core Models
- [x] ParameterKey model + repository
- [x] Unit model + repository
- [x] DimensionTemplate model + repository
- [x] StorageModule model + repository
- [x] Item model + repository

### AI/Session Models
- [x] Agent model + repository
- [x] Tool model + repository
- [x] Session model + repository

### Seed Data
- [x] Create seed data definitions (lib/seeds/)
  - [x] Default parameter keys (length, voltage, material, etc.)
  - [x] Default units (mm, in, V, ohm, etc.)
  - [x] Default tools (all tool definitions)
  - [x] Default agents (router, module, inventory, search)
- [x] Create seed runner function
- [ ] Hook seed to first authenticated request or startup

## Phase 4: Frontend - Layout & Navigation

- [x] Create protected layout with sidebar (app/(protected)/layout.tsx)
- [x] Build Sidebar component
- [x] Build Header component
- [x] Build UserMenu component
- [x] Create settings pages (agents, tools)
- [x] Build landing page (app/page.tsx)
- [x] Build placeholder pages (chat, sessions, settings)

## Phase 5: Agent Management UI + API

### API Endpoints
- [x] GET /api/agents - List agents (with auto-seed)
- [x] POST /api/agents - Create agent
- [x] GET /api/agents/[name] - Get agent
- [x] PATCH /api/agents/[name] - Update agent
- [x] DELETE /api/agents/[name] - Delete agent
- [ ] POST /api/agents/[name]/reset - Reset to default

### API Endpoints - Tools
- [x] GET /api/tools - List tools (with auto-seed)
- [x] PATCH /api/tools/[name] - Toggle active

### Frontend
- [ ] Agent list page (app/(protected)/settings/agents/page.js)
- [ ] AgentList component
- [ ] AgentCard component
- [ ] Agent editor page (app/(protected)/settings/agents/[name]/page.js)
- [ ] AgentEditor component
- [ ] ToolSelector component
- [ ] New agent page (app/(protected)/settings/agents/new/page.js)
- [ ] Tool list page (app/(protected)/settings/tools/page.js)
- [ ] useAgents hook
- [ ] useTools hook

## Phase 6: Session Management UI + API

### API Endpoints
- [ ] GET /api/sessions - List sessions
- [ ] POST /api/sessions - Create session
- [ ] GET /api/sessions/[id] - Get session with messages
- [ ] DELETE /api/sessions/[id] - Delete session
- [ ] POST /api/sessions/[id]/compress - Compress session

### Frontend
- [ ] Sessions page (app/(protected)/sessions/page.js)
- [ ] SessionList component
- [ ] SessionCard component
- [ ] CompressDialog component
- [ ] DeleteDialog component
- [ ] useSessions hook

## Phase 7: Chat UI

- [ ] Chat page (app/(protected)/chat/page.js)
- [ ] Chat with session page (app/(protected)/chat/[sessionId]/page.js)
- [ ] ChatContainer component
- [ ] MessageList component
- [ ] Message component (user + assistant variants)
- [ ] MessageInput component
- [ ] ImageUpload component (drag & drop, paste, file picker)
- [ ] VoiceInput component (Web Speech API)
- [ ] ContextIndicator component
- [ ] AgentBadge component
- [ ] ToolCallDisplay component (collapsible)
- [ ] useChat hook

## Phase 8: AI Engine

### Core Engine
- [ ] OpenAI client setup (lib/openai.js)
- [ ] Tool handler mapping (lib/toolHandlers.js)
- [ ] Agent runner (lib/agentRunner.js)
  - [ ] executeAgent function
  - [ ] Tool call processing loop
  - [ ] Recursive agent invocation
  - [ ] Multimodal message building

### Context Management
- [ ] Token estimation (lib/contextManager.js)
- [ ] Context tracking on message add
- [ ] Compression function
- [ ] Warning/critical threshold logic

### Chat API
- [ ] POST /api/chat - Send message, get AI response
  - [ ] Load session
  - [ ] Run agent
  - [ ] Track tokens
  - [ ] Return response with context status

## Phase 9: Inventory Management (AI-driven)

These are handled by AI tools, but we need the underlying APIs for direct access:

### API Endpoints (optional, for debugging/admin)
- [ ] GET /api/items - List/search items
- [ ] GET /api/modules - List modules
- [ ] GET /api/templates - List templates

### Path Validation
- [ ] validatePath utility (lib/pathValidator.js)

## Phase 10: Polish & Testing

- [ ] Error handling throughout
- [ ] Loading states
- [ ] Empty states
- [ ] Mobile responsiveness
- [ ] Dark mode support
- [ ] Manual testing of all flows
  - [ ] Sign in / sign out
  - [ ] Create storage module via chat
  - [ ] Add items via chat
  - [ ] Search items via chat
  - [ ] Edit agent instructions
  - [ ] Session compression

## Phase 11: Deployment

- [ ] Create Dockerfile
- [ ] Create docker-compose.yml (with MongoDB)
- [ ] Environment variable documentation
- [ ] Production build test
- [ ] Deploy to hosting platform

---

## Current Status

**Phase:** 5 - Agent Management UI + API
**Last Updated:** 2025-12-15

## Notes

- Keep API routes thin - all business logic in repositories
- Test each phase before moving to next
- Commit frequently with descriptive messages
