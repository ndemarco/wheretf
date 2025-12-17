import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { sessionRepository } from '@/repositories';
import { runChat } from '@/lib/agentRunner';
import { estimateTokens, calculateContextStatus } from '@/lib/contextManager';
import { ensureUserSeeded, seedGlobalDefaults } from '@/lib/seeds';

// POST /api/chat - Send a message to the AI
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { sessionId, message, images } = body as {
      sessionId?: string;
      message: string;
      images?: string[];
    };

    if (!message) {
      return Response.json({ error: 'Message is required' }, { status: 400 });
    }

    // Ensure user has agents seeded
    await ensureUserSeeded(session.user.id);
    await seedGlobalDefaults();

    // Get or create session
    let chatSession;
    if (sessionId) {
      chatSession = await sessionRepository.findById(session.user.id, sessionId);
      if (!chatSession) {
        return Response.json({ error: 'Session not found' }, { status: 404 });
      }
    } else {
      // Create a new session
      chatSession = await sessionRepository.create({
        userId: session.user.id,
        name: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
      });
    }

    // Add user message to session
    const userMessage = {
      role: 'user' as const,
      content: message,
      images,
      tokenCount: estimateTokens({ content: message, images }),
      timestamp: new Date(),
    };

    await sessionRepository.addMessage(session.user.id, chatSession._id.toString(), userMessage);

    // Run the AI
    const aiResponse = await runChat(
      session.user.id,
      message,
      images,
      chatSession.messages
    );

    // Add assistant message to session
    const assistantMessage = {
      role: 'assistant' as const,
      content: aiResponse.content,
      agent: aiResponse.agent,
      toolCalls: aiResponse.toolCalls,
      tokenCount: estimateTokens({
        content: aiResponse.content,
        toolCalls: aiResponse.toolCalls,
      }),
      timestamp: new Date(),
    };

    const { contextStatus } = await sessionRepository.addMessage(
      session.user.id,
      chatSession._id.toString(),
      assistantMessage
    );

    return Response.json({
      message: {
        role: 'assistant',
        content: aiResponse.content,
        agent: aiResponse.agent,
        toolCalls: aiResponse.toolCalls,
      },
      context: contextStatus,
      sessionId: chatSession._id.toString(),
    });
  } catch (error) {
    console.error('Error in chat:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Chat failed' },
      { status: 500 }
    );
  }
}
