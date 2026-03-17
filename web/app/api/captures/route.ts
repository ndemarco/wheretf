import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { writeCapture, readCaptures } from '@/lib/logger';
import crypto from 'crypto';

// POST /api/captures - Capture feedback on an interaction
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { rating, userMessage, agentResponse, agent, toolCalls, userNote, screenshot, sessionId } = body as {
      rating: 'up' | 'down';
      userMessage: string;
      agentResponse: string;
      agent?: string;
      toolCalls?: { name: string; arguments: Record<string, unknown>; result: unknown }[];
      userNote?: string;
      screenshot?: string;
      sessionId?: string;
    };

    if (!userMessage || !agentResponse || !rating) {
      return Response.json({ error: 'rating, userMessage, and agentResponse are required' }, { status: 400 });
    }

    const id = crypto.randomBytes(8).toString('hex');

    writeCapture({
      id,
      timestamp: new Date().toISOString(),
      rating,
      userMessage,
      agentResponse,
      agent,
      toolCalls: toolCalls ?? [],
      userNote,
      screenshot,
      sessionId,
    });

    console.log(`[capture] ${rating === 'up' ? '+1' : '-1'} ${id}: "${userMessage.slice(0, 60)}..."${userNote ? ` note="${userNote}"` : ''}`);

    return Response.json({ id, captured: true });
  } catch (error) {
    console.error('Error saving capture:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Capture failed' },
      { status: 500 },
    );
  }
}

// GET /api/captures - List all captures
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const captures = readCaptures();
  return Response.json(captures);
}
