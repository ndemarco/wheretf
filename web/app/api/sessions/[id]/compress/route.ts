import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { sessionRepository } from '@/repositories';
import OpenAI from 'openai';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/sessions/[id]/compress - Compress a session
export async function POST(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    // Get the session to compress
    const chatSession = await sessionRepository.findById(session.user.id, id);
    if (!chatSession) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    if (chatSession.status === 'compressed') {
      return Response.json({ error: 'Session is already compressed' }, { status: 400 });
    }

    // Generate summary using OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const messagesForSummary = chatSession.messages.map((m) => ({
      role: m.role,
      content: m.content,
      agent: m.agent,
    }));

    const summaryResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Summarize this inventory management conversation. Include:
- Storage modules created/modified (with their structure)
- Items added (with locations and key parameters)
- Key decisions made
- Any pending tasks or questions

Keep it concise but preserve important details for continuing the conversation.`,
        },
        {
          role: 'user',
          content: JSON.stringify(messagesForSummary),
        },
      ],
      max_tokens: 1000,
    });

    const summary = summaryResponse.choices[0]?.message?.content || 'Unable to generate summary';

    // Compress the session
    const { oldSession, newSession } = await sessionRepository.compress(
      session.user.id,
      id,
      summary
    );

    return Response.json({
      oldSession: {
        id: oldSession._id,
        status: oldSession.status,
        compressedSummary: oldSession.compressedSummary,
      },
      newSession: {
        id: newSession._id,
        name: newSession.name,
        status: newSession.status,
        contextUsage: newSession.contextUsage,
        parentSession: newSession.parentSession,
      },
    });
  } catch (error) {
    console.error('Error compressing session:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to compress session' },
      { status: 500 }
    );
  }
}
