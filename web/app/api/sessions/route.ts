import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { sessionRepository } from '@/repositories';

// GET /api/sessions - List all sessions for current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sessions = await sessionRepository.list(session.user.id);
    return Response.json({
      sessions: sessions.map((s) => ({
        id: s._id,
        name: s.name,
        status: s.status,
        contextUsage: s.contextUsage,
        messageCount: s.messages?.length || 0,
        compressedSummary: s.compressedSummary,
        parentSession: s.parentSession,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Error listing sessions:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to list sessions' },
      { status: 500 }
    );
  }
}

// POST /api/sessions - Create a new session
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { name } = body;

    const newSession = await sessionRepository.create({
      userId: session.user.id,
      name,
    });

    return Response.json(
      {
        session: {
          id: newSession._id,
          name: newSession.name,
          status: newSession.status,
          contextUsage: 0,
          messageCount: 0,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating session:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to create session' },
      { status: 400 }
    );
  }
}
