# Agents Specification

## Overview

Agents are AI personalities with specific instructions and tool access. The system uses a router/specialist pattern where a router agent classifies user intent and delegates to specialist agents.

## Agent Data Model

```javascript
// schemas/Agent.js
const agentSchema = new Schema({
  user: {                     // Owner (agents are per-user)
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    lowercase: true
  },
  displayName: String,        // "Inventory Agent"
  description: String,        // Short description for router
  instructions: {             // System prompt
    type: String,
    required: true
  },
  model: {                    // OpenAI model
    type: String,
    default: "gpt-4o",
    enum: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"]
  },
  tools: [String],            // Tool names this agent can use
  temperature: {
    type: Number,
    default: 0.7,
    min: 0,
    max: 1
  },
  isRouter: {                 // Is this the router agent?
    type: Boolean,
    default: false
  },
  isSystem: {                 // System agents can't be deleted
    type: Boolean,
    default: false
  },
  active: {                   // Enable/disable agent
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Compound unique index - name unique per user
agentSchema.index({ user: 1, name: 1 }, { unique: true });
```

## Tool Data Model

```javascript
// schemas/Tool.js
// Tools are global (not per-user) - defined in code, synced to DB

const toolParameterSchema = new Schema({
  name: String,
  type: String,               // "string", "number", "array", "object"
  description: String,
  required: Boolean,
  enum: [String],             // Optional allowed values
}, { _id: false });

const toolSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: String,        // For OpenAI function calling
  category: {                 // For grouping in UI
    type: String,
    enum: ["agents", "items", "modules", "templates", "params", "units", "utility"]
  },
  parameters: [toolParameterSchema],
  handler: String,            // Reference to handler function
  isSystem: {                 // System tools can't be deleted
    type: Boolean,
    default: true
  },
  active: {                   // Can be toggled off
    type: Boolean,
    default: true
  }
}, { timestamps: true });
```

---

## System Agents

### Router Agent

The entry point for all user messages. Classifies intent and delegates to specialists.

```javascript
{
  name: "router",
  displayName: "Router",
  isRouter: true,
  isSystem: true,
  model: "gpt-4o",
  temperature: 0.7,
  tools: ["runModuleAgent", "runInventoryAgent", "runSearchAgent"],
  instructions: `You are the front door for a workshop inventory system.

Analyze the user's message and invoke the appropriate specialist:

- **runModuleAgent**: User wants to create or modify storage modules, cabinets,
  shelves, drawer units, or dimension templates. Keywords: "this is", "new cabinet",
  "storage unit", "set up", "module"

- **runInventoryAgent**: User wants to add, update, or describe items in storage
  locations. Keywords: "add", "put", "this bin has", "update", "move", "delete item"

- **runSearchAgent**: User wants to find items or check what's in a location.
  Keywords: "where is", "find", "do I have", "what's in", "search"

Pass along any images and context to the specialist.

If the user is just chatting, asking general questions, or you're unsure, respond
directly without invoking a specialist.`
}
```

### Module Agent

Creates and manages storage modules and dimension templates.

```javascript
{
  name: "module",
  displayName: "Module Agent",
  description: "Creates and manages storage modules",
  isSystem: true,
  model: "gpt-4o",
  temperature: 0.7,
  tools: [
    "searchModules",
    "createModule",
    "updateModule",
    "searchTemplates",
    "createTemplate"
  ],
  instructions: `You help users define storage modules for their workshop.

## Your Job

1. Understand the storage unit from user descriptions or images
2. Ask clarifying questions about dimensions (levels, rows, columns, bins)
3. Check for existing templates that match (searchTemplates)
4. Propose module structure before creating
5. **Always confirm with user before saving**

## Naming Conventions

- Module names: UPPERCASE, short (FLUX, MUSE, PRUSA)
- Dimension labels: lowercase (level, drawer, bin, row, col)
- Dimension values: lowercase or numbers ("1", "2", "yellow", "blue")

## Location Path Format

MODULE:dim-value:dim-value:...

Examples:
- MUSE:level-3:row-2:col-5
- PRUSA:drawer-1:box-yellow:row-2:col-3
- FLUX:level-5:bin-8

## Workflow

1. User describes or shows photo of storage unit
2. You identify the structure (levels, grid layout, etc.)
3. Check if any dimension templates exist that match
4. Propose the module definition
5. Wait for user confirmation
6. Create the module

## Example Confirmation

"I'll create this module:

**MUSE**
- 11 levels
- Levels 1-8: 4×6 Plano grid (plano-4x6 template)
- Levels 9-11: 3×4 Plano grid (plano-3x4 template)

Valid paths will look like: MUSE:level-3:row-2:col-5

Does this look right?"`
}
```

### Inventory Agent

Adds and manages inventory items.

```javascript
{
  name: "inventory",
  displayName: "Inventory Agent",
  description: "Adds and manages inventory items",
  isSystem: true,
  model: "gpt-4o",
  temperature: 0.7,
  tools: [
    "searchItems",
    "createItem",
    "updateItem",
    "deleteItem",
    "searchParams",
    "createParam",
    "searchUnits",
    "createUnit",
    "validatePath",
    "searchModules"
  ],
  instructions: `You help users catalog items in their workshop storage.

## Your Job

1. Identify items from text, images, or voice descriptions
2. Search existing parameter keys before creating new ones (searchParams)
3. Use industry-standard terminology for parameters
4. Validate location paths against module definitions (validatePath)
5. **Always confirm item details before creating**

## Parameter Guidelines

- **Search first**: Always searchParams before creating new parameter keys
- **Naming**: Keys are lowercase, underscore-separated (thread_size, voltage_rating)
- **Units**: Include units where applicable (mm, in, V, ohm, uF)
- **Duplicates OK**: An item can have multiple parameters with the same key
  (e.g., a pipe reducer with two thread_size values)

## Standard Parameter Keys

Common keys to look for:
- Dimensions: length, width, height, diameter, thread_size
- Electrical: voltage, current, resistance, capacitance, power
- Materials: material, color, finish
- Types: type, category, head_type, drive_type

## Workflow

1. User describes item(s) and location
2. Identify items and their characteristics
3. Search for existing parameter keys
4. Validate the location path
5. Propose the item(s) to create
6. Wait for user confirmation
7. Create the item(s)

## Example Confirmation

"I'll add this item:

**10k ohm resistors**
- resistance: 10k ohm
- tolerance: 5%
- power: 0.25W
- type: through-hole

**Location**: MUSE:level-3:row-2:col-5

Does this look right? Any other details to add?"`
}
```

### Search Agent

Finds items in inventory.

```javascript
{
  name: "search",
  displayName: "Search Agent",
  description: "Finds items in inventory",
  isSystem: true,
  model: "gpt-4o",
  temperature: 0.7,
  tools: [
    "searchItems",
    "searchModules"
  ],
  instructions: `You help users find items in their workshop inventory.

## Your Job

1. Parse natural language queries into search parameters
2. Search by name, description, parameters, or location
3. Present results clearly with locations
4. Help narrow down if too many results

## Search Strategies

- "where are my 10k resistors" → searchItems by name/parameters
- "what's in MUSE level 3" → searchItems by location prefix
- "do I have any brass fittings" → searchItems by material parameter
- "find something for 5V switching" → searchItems by voltage + description

## Query Interpretation

Break down user queries:
- "10mm stainless screws" → parameters: {length: 10mm, material: stainless}
- "in the red cabinet" → location prefix: MUSE (if MUSE is the red cabinet)
- "something like a relay" → text search: relay

## Result Presentation

"Found 3 items matching 'resistor':

1. **10k ohm resistors**
   Location: MUSE:level-3:row-2:col-5

2. **4.7k ohm resistors**
   Location: MUSE:level-3:row-2:col-6

3. **100 ohm resistors**
   Location: MUSE:level-4:row-1:col-2"

## No Results

If nothing found, suggest:
- Alternative search terms
- Checking if the item might be under a different name
- Browsing related categories`
}
```

---

## Tool Definitions

### Agent Runner Tools

Used by the router to invoke specialist agents.

```javascript
{
  name: "runModuleAgent",
  description: "Invoke when user wants to create or modify storage modules, cabinets, shelves, or dimension templates",
  category: "agents",
  parameters: [
    {
      name: "task",
      type: "string",
      description: "Summary of what the user wants to do",
      required: true
    }
  ],
  handler: "agents.runModule"
}

{
  name: "runInventoryAgent",
  description: "Invoke when user wants to add, update, or describe items in storage locations",
  category: "agents",
  parameters: [
    {
      name: "task",
      type: "string",
      description: "Summary of what the user wants to do",
      required: true
    }
  ],
  handler: "agents.runInventory"
}

{
  name: "runSearchAgent",
  description: "Invoke when user wants to find items or check what's in a location",
  category: "agents",
  parameters: [
    {
      name: "task",
      type: "string",
      description: "Summary of what the user wants to do",
      required: true
    }
  ],
  handler: "agents.runSearch"
}
```

### Item Tools

```javascript
{
  name: "searchItems",
  description: "Search inventory items by name, parameters, or location",
  category: "items",
  parameters: [
    { name: "query", type: "string", description: "Text search query", required: false },
    { name: "location", type: "string", description: "Location path or prefix", required: false },
    { name: "parameters", type: "array", description: "Parameter filters [{key, value}]", required: false }
  ],
  handler: "db.items.search"
}

{
  name: "createItem",
  description: "Create a new inventory item",
  category: "items",
  parameters: [
    { name: "name", type: "string", description: "Item name", required: true },
    { name: "description", type: "string", description: "Item description", required: false },
    { name: "parameters", type: "array", description: "Array of {key, value, unit}", required: false },
    { name: "location", type: "string", description: "Location path", required: true }
  ],
  handler: "db.items.create"
}

{
  name: "updateItem",
  description: "Update an existing item",
  category: "items",
  parameters: [
    { name: "location", type: "string", description: "Location path of item to update", required: true },
    { name: "updates", type: "object", description: "Fields to update", required: true }
  ],
  handler: "db.items.update"
}

{
  name: "deleteItem",
  description: "Delete an item from inventory",
  category: "items",
  parameters: [
    { name: "location", type: "string", description: "Location path of item to delete", required: true }
  ],
  handler: "db.items.delete"
}
```

### Module Tools

```javascript
{
  name: "searchModules",
  description: "Search for existing storage modules",
  category: "modules",
  parameters: [
    { name: "query", type: "string", description: "Search query (name or description)", required: false },
    { name: "name", type: "string", description: "Exact module name", required: false }
  ],
  handler: "db.modules.search"
}

{
  name: "createModule",
  description: "Create a new storage module",
  category: "modules",
  parameters: [
    { name: "name", type: "string", description: "Module name (uppercase)", required: true },
    { name: "description", type: "string", description: "Human-readable description", required: false },
    { name: "dimensions", type: "array", description: "Array of dimension definitions", required: true }
  ],
  handler: "db.modules.create"
}

{
  name: "updateModule",
  description: "Update an existing storage module",
  category: "modules",
  parameters: [
    { name: "name", type: "string", description: "Module name to update", required: true },
    { name: "updates", type: "object", description: "Fields to update", required: true }
  ],
  handler: "db.modules.update"
}
```

### Template Tools

```javascript
{
  name: "searchTemplates",
  description: "Search for existing dimension templates",
  category: "templates",
  parameters: [
    { name: "query", type: "string", description: "Search query", required: false }
  ],
  handler: "db.templates.search"
}

{
  name: "createTemplate",
  description: "Create a new dimension template",
  category: "templates",
  parameters: [
    { name: "name", type: "string", description: "Template name (lowercase, hyphenated)", required: true },
    { name: "description", type: "string", description: "Human-readable description", required: false },
    { name: "dimensions", type: "array", description: "Array of dimension definitions [{label, values}]", required: true }
  ],
  handler: "db.templates.create"
}
```

### Parameter & Unit Tools

```javascript
{
  name: "searchParams",
  description: "Search existing parameter keys",
  category: "params",
  parameters: [
    { name: "query", type: "string", description: "Search query", required: false },
    { name: "category", type: "string", description: "Filter by category", required: false }
  ],
  handler: "db.params.search"
}

{
  name: "createParam",
  description: "Create a new parameter key",
  category: "params",
  parameters: [
    { name: "key", type: "string", description: "Parameter key (lowercase, underscore-separated)", required: true },
    { name: "description", type: "string", description: "What this parameter represents", required: false },
    { name: "category", type: "string", description: "Category (dimension, material, electrical)", required: false },
    { name: "commonUnits", type: "array", description: "Common units for this parameter", required: false }
  ],
  handler: "db.params.create"
}

{
  name: "searchUnits",
  description: "Search existing units",
  category: "units",
  parameters: [
    { name: "query", type: "string", description: "Search query", required: false },
    { name: "type", type: "string", description: "Filter by type (length, voltage, etc.)", required: false }
  ],
  handler: "db.units.search"
}

{
  name: "createUnit",
  description: "Create a new unit",
  category: "units",
  parameters: [
    { name: "name", type: "string", description: "Unit abbreviation (lowercase)", required: true },
    { name: "fullName", type: "string", description: "Full name", required: false },
    { name: "type", type: "string", description: "Unit type (length, voltage, etc.)", required: false }
  ],
  handler: "db.units.create"
}
```

### Utility Tools

```javascript
{
  name: "validatePath",
  description: "Validate a location path against module definitions",
  category: "utility",
  parameters: [
    { name: "path", type: "string", description: "Location path to validate", required: true }
  ],
  handler: "util.validatePath"
}
```

---

## Seed Data Strategy

### On Application Startup

```javascript
// lib/seeds/index.js
export async function seedDefaults(userId) {
  await seedTools();           // Tools are global
  await seedAgents(userId);    // Agents are per-user
  await seedParameterKeys();   // Seed common parameter keys
  await seedUnits();           // Seed common units
}
```

### Tool Seeding (Global)

```javascript
// lib/seeds/tools.js
export async function seedTools() {
  for (const tool of defaultTools) {
    await Tool.findOneAndUpdate(
      { name: tool.name },
      { $setOnInsert: tool },
      { upsert: true }
    );
  }
}
```

### Agent Seeding (Per User)

```javascript
// lib/seeds/agents.js
export async function seedAgents(userId) {
  for (const agent of defaultAgents) {
    await Agent.findOneAndUpdate(
      { user: userId, name: agent.name },
      { $setOnInsert: { ...agent, user: userId } },
      { upsert: true }
    );
  }
}
```

---

## API Endpoints

### Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents` | List all agents for current user |
| POST | `/api/agents` | Create new agent |
| GET | `/api/agents/:name` | Get single agent |
| PATCH | `/api/agents/:name` | Update agent |
| DELETE | `/api/agents/:name` | Delete agent (custom only) |
| POST | `/api/agents/:name/reset` | Reset to default (system only) |

### Tools

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tools` | List all tools |
| GET | `/api/tools/:name` | Get single tool |
| PATCH | `/api/tools/:name` | Toggle tool active status |

---

## Agent Execution Flow

```javascript
// lib/agentRunner.js

async function runChat(sessionId, userMessage, images) {
  const session = await Session.findById(sessionId);
  const userId = session.user;

  // Always start with router
  const router = await Agent.findOne({ user: userId, isRouter: true });
  const response = await executeAgent(router, userMessage, images, session.messages, userId);

  // Track in session
  await addMessageToSession(sessionId, { role: 'user', content: userMessage, images });
  await addMessageToSession(sessionId, { role: 'assistant', ...response });

  return response;
}

async function executeAgent(agent, message, images, history, userId) {
  // Get active tools for this agent
  const tools = await Tool.find({
    name: { $in: agent.tools },
    active: true
  });

  const functions = tools.map(formatForOpenAI);

  // Call OpenAI
  let response = await callOpenAI({
    model: agent.model,
    messages: [
      { role: "system", content: agent.instructions },
      ...history,
      buildUserMessage(message, images)
    ],
    tools: functions,
    temperature: agent.temperature
  });

  // Process tool calls
  while (response.tool_calls) {
    const results = [];

    for (const call of response.tool_calls) {
      const tool = tools.find(t => t.name === call.function.name);
      const args = JSON.parse(call.function.arguments);

      if (tool.handler.startsWith('agents.')) {
        // Invoke specialist agent
        const specialistName = tool.handler.replace('agents.run', '').toLowerCase();
        const specialist = await Agent.findOne({ user: userId, name: specialistName });
        const result = await executeAgent(specialist, args.task, images, history, userId);
        results.push({ call, result });
      } else {
        // Execute DB/utility tool
        const result = await executeHandler(tool.handler, args, userId);
        results.push({ call, result });
      }
    }

    // Continue with tool results
    response = await callOpenAI({
      model: agent.model,
      messages: [
        ...previousMessages,
        { role: "assistant", tool_calls: response.tool_calls },
        ...results.map(r => ({
          role: "tool",
          tool_call_id: r.call.id,
          content: JSON.stringify(r.result)
        }))
      ],
      tools: functions
    });
  }

  return {
    content: response.content,
    agent: agent.name,
    toolCalls: response.tool_calls
  };
}
```
