# Session Management

## Overview

Sessions track conversation history with the AI. Users can have multiple sessions, resume previous sessions, and compress sessions when context gets full.

## Session Data Model

```javascript
// schemas/Session.js
const messageSchema = new Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'tool', 'system'],
    required: true
  },
  content: String,
  images: [String],           // URLs or base64 for uploaded images
  toolCalls: [{
    id: String,
    name: String,
    arguments: Schema.Types.Mixed,
    result: Schema.Types.Mixed
  }],
  agent: String,              // Which agent handled this message
  tokenCount: Number,         // Track tokens for this message
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const sessionSchema = new Schema({
  user: {                     // Owner of this session
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: String,               // Optional user-provided name
  messages: [messageSchema],
  totalTokens: {              // Running total
    type: Number,
    default: 0
  },
  maxTokens: {                // Context window limit (model-dependent)
    type: Number,
    default: 128000           // GPT-4o default
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'compressed'],
    default: 'active'
  },
  compressedSummary: String,  // If compressed, store summary here
  parentSession: {            // If this was split from another session
    type: Schema.Types.ObjectId,
    ref: 'Session'
  }
}, { timestamps: true });

// Virtual for context usage percentage
sessionSchema.virtual('contextUsage').get(function() {
  return Math.round((this.totalTokens / this.maxTokens) * 100);
});

// Index for listing user's sessions
sessionSchema.index({ user: 1, updatedAt: -1 });
```

## Context Tracking

### Thresholds

```javascript
const WARNING_THRESHOLD = 0.75;  // 75% - show warning
const CRITICAL_THRESHOLD = 0.90; // 90% - strongly suggest compression
```

### Token Estimation

```javascript
// lib/contextManager.js

function estimateTokens(message) {
  let count = 0;

  if (message.content) {
    // Rough estimate: ~4 characters per token
    count += Math.ceil(message.content.length / 4);
  }

  if (message.images?.length) {
    // GPT-4o: ~765 tokens for low-res, ~1105 for high-res per image
    count += message.images.length * 1000;
  }

  if (message.toolCalls?.length) {
    count += Math.ceil(JSON.stringify(message.toolCalls).length / 4);
  }

  return count;
}
```

### Adding Messages

```javascript
async function addMessageToSession(sessionId, message) {
  const session = await Session.findById(sessionId);

  // Estimate tokens
  const tokenEstimate = estimateTokens(message);

  session.messages.push({
    ...message,
    tokenCount: tokenEstimate,
    timestamp: new Date()
  });
  session.totalTokens += tokenEstimate;

  await session.save();

  // Return context status
  const usage = session.totalTokens / session.maxTokens;

  return {
    session,
    contextStatus: {
      used: session.totalTokens,
      max: session.maxTokens,
      percentage: Math.round(usage * 100),
      warning: usage >= WARNING_THRESHOLD,
      critical: usage >= CRITICAL_THRESHOLD
    }
  };
}
```

## Context Compression

When context gets full, compress the session into a summary and start fresh.

```javascript
// lib/contextCompression.js

async function compressSession(sessionId) {
  const session = await Session.findById(sessionId);

  // Use AI to summarize the conversation
  const summary = await callOpenAI({
    model: "gpt-4o-mini",  // Cheaper model for summarization
    messages: [
      {
        role: "system",
        content: `Summarize this inventory management conversation. Include:
          - Storage modules created/modified (with their structure)
          - Items added (with locations and key parameters)
          - Key decisions made
          - Any pending tasks or questions

          Keep it concise but preserve important details for continuing the conversation.`
      },
      {
        role: "user",
        content: JSON.stringify(session.messages.map(m => ({
          role: m.role,
          content: m.content,
          agent: m.agent
        })))
      }
    ]
  });

  // Archive current session
  session.status = 'compressed';
  session.compressedSummary = summary;
  await session.save();

  // Create new session with summary as context
  const newSession = await Session.create({
    user: session.user,
    name: session.name,
    parentSession: session._id,
    messages: [{
      role: 'system',
      content: `Previous conversation summary:\n\n${summary}\n\nContinue helping the user with their workshop inventory.`,
      tokenCount: estimateTokens({ content: summary })
    }],
    totalTokens: estimateTokens({ content: summary })
  });

  return newSession;
}
```

### Session Chain

Get full history for a session (including parent sessions).

```javascript
async function getSessionChain(sessionId) {
  const sessions = [];
  let current = await Session.findById(sessionId);

  while (current) {
    sessions.unshift(current);
    if (current.parentSession) {
      current = await Session.findById(current.parentSession);
    } else {
      current = null;
    }
  }

  return sessions;
}
```

## API Endpoints

### POST /api/chat

Send a message to the AI.

**Request:**
```json
{
  "sessionId": "abc123",
  "message": "Add 10k resistors to level 3 row 2",
  "images": ["data:image/jpeg;base64,..."]
}
```

**Response:**
```json
{
  "message": {
    "role": "assistant",
    "content": "I've added the 10k resistors to MUSE:level-3:row-2:col-5",
    "agent": "inventory"
  },
  "context": {
    "used": 45000,
    "max": 128000,
    "percentage": 35,
    "warning": false,
    "critical": false
  },
  "sessionId": "abc123"
}
```

**Response (warning threshold):**
```json
{
  "message": { ... },
  "context": {
    "used": 98000,
    "max": 128000,
    "percentage": 77,
    "warning": true,
    "critical": false,
    "suggestion": "Context is getting full. Consider compressing this session."
  }
}
```

### GET /api/sessions

List user's sessions.

**Response:**
```json
{
  "sessions": [
    {
      "id": "abc123",
      "name": "Workshop Inventory",
      "status": "active",
      "contextUsage": 35,
      "messageCount": 23,
      "updatedAt": "2024-12-15T10:30:00Z"
    },
    {
      "id": "def456",
      "name": "Initial Setup",
      "status": "compressed",
      "compressedSummary": "Created modules FLUX, MUSE, PRUSA...",
      "updatedAt": "2024-12-14T15:00:00Z"
    }
  ]
}
```

### POST /api/sessions

Create a new session.

**Request:**
```json
{
  "name": "Electronics Inventory"
}
```

**Response:**
```json
{
  "session": {
    "id": "ghi789",
    "name": "Electronics Inventory",
    "status": "active",
    "contextUsage": 0,
    "messageCount": 0
  }
}
```

### POST /api/sessions/:id/compress

Compress a session.

**Response:**
```json
{
  "oldSession": {
    "id": "abc123",
    "status": "compressed"
  },
  "newSession": {
    "id": "jkl012",
    "name": "Workshop Inventory",
    "status": "active",
    "contextUsage": 5,
    "parentSession": "abc123"
  }
}
```

### GET /api/sessions/:id

Get session details including messages.

**Response:**
```json
{
  "session": {
    "id": "abc123",
    "name": "Workshop Inventory",
    "status": "active",
    "contextUsage": 35,
    "messages": [
      {
        "role": "user",
        "content": "This is MUSE, a red cabinet...",
        "timestamp": "2024-12-15T10:00:00Z"
      },
      {
        "role": "assistant",
        "content": "I've created the MUSE module...",
        "agent": "module",
        "timestamp": "2024-12-15T10:00:05Z"
      }
    ]
  }
}
```

### DELETE /api/sessions/:id

Delete a session (and its children if compressed).

## UI Components

### Context Indicator

Shows in chat header:

```
+------------------------------------------+
|  Chat: "Workshop Inventory"               |
|  Context: [=========>        ] 77%  ⚠️    |
|           [Compress Session]              |
+------------------------------------------+
```

### Session List (/sessions)

```
+------------------------------------------+
| Sessions                    [New Session] |
+------------------------------------------+
| > Workshop Inventory (active)      35%   |
|   Dec 15, 2024 - 23 messages             |
|                                          |
| > Initial Setup (compressed)       --    |
|   Dec 14, 2024 - archived                |
|   "Created modules FLUX, MUSE..."        |
|                                          |
| > Testing (active)                 12%   |
|   Dec 15, 2024 - 5 messages              |
+------------------------------------------+
```

### Compression Dialog

When user clicks "Compress Session":

```
+------------------------------------------+
|  Compress Session?                        |
|                                          |
|  This will:                              |
|  - Summarize the current conversation    |
|  - Archive this session                  |
|  - Start a new session with the summary  |
|                                          |
|  You can still view the archived session |
|  in your session history.                |
|                                          |
|        [Cancel]  [Compress]              |
+------------------------------------------+
```
