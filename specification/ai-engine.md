# AI Engine

## Overview

The AI engine orchestrates conversations between users and the agent system. It handles message routing, tool execution, and conversation flow.

For agent definitions and tool specifications, see [agents.md](./agents.md).

## Architecture

```
User Input (text/image/voice)
           |
           v
+---------------------+
|    Router Agent     |
|                     |
|    Tools:           |
|    - runModule      |---> Module Agent
|    - runInventory   |---> Inventory Agent
|    - runSearch      |---> Search Agent
+---------------------+
           |
           v
+---------------------------------------------+
|               Tool Layer                     |
|  Repository Layer handles all DB operations |
+---------------------------------------------+
           |
           v
      [ MongoDB ]
```

## Agent Runner

The agent runner executes agents and handles tool calls recursively.

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
        // Execute via repository layer
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

## Tool Handler Execution

Tool handlers map to repository methods. The handler string (e.g., `db.items.create`) maps to repository functions.

```javascript
// lib/toolHandlers.js
import * as itemRepo from '@/repositories/itemRepository';
import * as moduleRepo from '@/repositories/moduleRepository';
import * as paramRepo from '@/repositories/parameterRepository';
// ...

const handlers = {
  'db.items.search': itemRepo.search,
  'db.items.create': itemRepo.create,
  'db.items.update': itemRepo.update,
  'db.items.delete': itemRepo.remove,
  'db.modules.search': moduleRepo.search,
  'db.modules.create': moduleRepo.create,
  'db.modules.update': moduleRepo.update,
  'db.templates.search': templateRepo.search,
  'db.templates.create': templateRepo.create,
  'db.params.search': paramRepo.search,
  'db.params.create': paramRepo.create,
  'db.units.search': unitRepo.search,
  'db.units.create': unitRepo.create,
  'util.validatePath': validatePath,
  'agents.runModule': null,      // Handled specially in executeAgent
  'agents.runInventory': null,
  'agents.runSearch': null,
};

async function executeHandler(handlerPath, args, userId) {
  const handler = handlers[handlerPath];
  if (!handler) {
    throw new Error(`Unknown handler: ${handlerPath}`);
  }

  // All repository methods receive userId for scoping
  return handler({ ...args, userId });
}
```

## OpenAI Integration

```javascript
// lib/openai.js
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function callOpenAI({ model, messages, tools, temperature }) {
  const response = await openai.chat.completions.create({
    model,
    messages,
    tools: tools?.length ? tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    })) : undefined,
    temperature
  });

  return response.choices[0].message;
}

export function formatForOpenAI(tool) {
  return {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties: tool.parameters.reduce((acc, p) => {
        acc[p.name] = {
          type: p.type,
          description: p.description,
          enum: p.enum
        };
        return acc;
      }, {}),
      required: tool.parameters.filter(p => p.required).map(p => p.name)
    }
  };
}
```

## Multimodal Messages

```javascript
function buildUserMessage(content, images) {
  if (!images?.length) {
    return { role: "user", content };
  }

  // Multimodal message with images
  return {
    role: "user",
    content: [
      { type: "text", text: content },
      ...images.map(img => ({
        type: "image_url",
        image_url: { url: img }  // base64 or URL
      }))
    ]
  };
}
```

## Execution Flow Example

```
User: "This is MUSE, red cabinet, 11 levels with Plano boxes"
                    |
                    v
            +---------------+
            | Router Agent  |
            +---------------+
                    |
      Tool call: runModuleAgent({
        task: "Create storage module MUSE - red cabinet with 11 levels"
      })
                    |
                    v
            +---------------+
            | Module Agent  |
            +---------------+
                    |
      Tool call: searchTemplates({ query: "plano" })
           |
           v
      [Repository: templateRepository.search()]
           |
           v
      [Returns existing plano templates]
           |
      Tool call: createModule({
        name: "MUSE",
        dimensions: [...]
      })
           |
           v
      [Repository: moduleRepository.create()]
           |
           v
      "I've created the MUSE module with 11 levels..."
                    |
                    v
            [Response to user]
```
