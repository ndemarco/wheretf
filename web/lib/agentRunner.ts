import OpenAI from 'openai';
import { getOpenAIClient } from './openai';
import { toolRepository, agentRepository } from '@/repositories';
import { executeHandler } from './toolHandlers';
import { IAgent } from '@/models/Agent';
import { IMessage } from '@/models/Session';
import { formatForOpenAI } from '@/repositories/toolRepository';

export interface AgentResponse {
  content: string;
  agent: string;
  toolCalls?: {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    result: unknown;
  }[];
}

/**
 * Build OpenAI message format from our message format
 */
function buildMessages(
  systemPrompt: string,
  history: IMessage[],
  userMessage: string,
  images?: string[]
): OpenAI.ChatCompletionMessageParam[] {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Add history
  for (const msg of history) {
    if (msg.role === 'user') {
      messages.push({ role: 'user', content: msg.content || '' });
    } else if (msg.role === 'assistant') {
      messages.push({ role: 'assistant', content: msg.content || '' });
    } else if (msg.role === 'system') {
      messages.push({ role: 'system', content: msg.content || '' });
    }
  }

  // Add current user message with optional images
  if (images && images.length > 0) {
    const content: OpenAI.ChatCompletionContentPart[] = [
      { type: 'text', text: userMessage },
      ...images.map((img) => ({
        type: 'image_url' as const,
        image_url: { url: img },
      })),
    ];
    messages.push({ role: 'user', content });
  } else {
    messages.push({ role: 'user', content: userMessage });
  }

  return messages;
}

/**
 * Execute an agent with the given message
 */
export async function executeAgent(
  agent: IAgent,
  message: string,
  images: string[] | undefined,
  history: IMessage[],
  userId: string
): Promise<AgentResponse> {
  const openai = getOpenAIClient();

  // Get active tools for this agent
  const tools = await toolRepository.findByNames(agent.tools);
  const functions = tools.map(formatForOpenAI);

  const messages = buildMessages(agent.instructions, history, message, images);

  // Call OpenAI
  let response = await openai.chat.completions.create({
    model: agent.aiModel,
    messages,
    tools: functions.length > 0 ? functions : undefined,
    temperature: agent.temperature,
  });

  const allToolCalls: AgentResponse['toolCalls'] = [];

  // Process tool calls
  while (response.choices[0]?.message?.tool_calls) {
    const toolCallsInResponse = response.choices[0].message.tool_calls;
    const toolMessages: OpenAI.ChatCompletionMessageParam[] = [];

    // Add assistant message with tool calls
    toolMessages.push({
      role: 'assistant',
      content: response.choices[0].message.content || null,
      tool_calls: toolCallsInResponse as OpenAI.ChatCompletionMessageToolCall[],
    });

    for (const call of toolCallsInResponse) {
      // Type guard for function tool calls
      if (call.type !== 'function') continue;

      const tool = tools.find((t) => t.name === call.function.name);
      if (!tool) {
        toolMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ error: `Unknown tool: ${call.function.name}` }),
        });
        continue;
      }

      const args = JSON.parse(call.function.arguments);

      try {
        let result: unknown;

        if (tool.handler.startsWith('agents.')) {
          // Invoke specialist agent
          const specialistName = tool.handler.replace('agents.run', '').toLowerCase();
          const specialist = await agentRepository.findByName(userId, specialistName);

          if (!specialist) {
            result = { error: `Specialist agent "${specialistName}" not found` };
          } else {
            const specialistResponse = await executeAgent(
              specialist,
              args.task,
              images,
              history,
              userId
            );
            result = {
              response: specialistResponse.content,
              agent: specialistResponse.agent,
            };
          }
        } else {
          // Execute DB/utility tool
          result = await executeHandler(tool.handler, args, userId);
        }

        allToolCalls.push({
          id: call.id,
          name: call.function.name,
          arguments: args,
          result,
        });

        toolMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Tool execution failed';
        allToolCalls.push({
          id: call.id,
          name: call.function.name,
          arguments: args,
          result: { error: errorMessage },
        });

        toolMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ error: errorMessage }),
        });
      }
    }

    // Continue with tool results
    response = await openai.chat.completions.create({
      model: agent.aiModel,
      messages: [...messages, ...toolMessages],
      tools: functions.length > 0 ? functions : undefined,
      temperature: agent.temperature,
    });
  }

  return {
    content: response.choices[0]?.message?.content || '',
    agent: agent.name,
    toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
  };
}

/**
 * Run a chat message through the router agent
 */
export async function runChat(
  userId: string,
  message: string,
  images?: string[],
  history: IMessage[] = []
): Promise<AgentResponse> {
  // Get router agent
  const router = await agentRepository.findRouter(userId);
  if (!router) {
    throw new Error('Router agent not found. Please ensure agents are seeded.');
  }

  return executeAgent(router, message, images, history, userId);
}
