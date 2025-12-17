import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { sessionRepository } from '@/repositories';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/sessions/[id] - Get a session with messages
export async function GET(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const chatSession = await sessionRepository.findById(session.user.id, id);
    if (!chatSession) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    const contextStatus = await sessionRepository.getContextStatus(session.user.id, id);

    return Response.json({
      session: {
        id: chatSession._id,
        name: chatSession.name,
        status: chatSession.status,
        messages: chatSession.messages,
        context: contextStatus,
        compressedSummary: chatSession.compressedSummary,
        parentSession: chatSession.parentSession,
        createdAt: chatSession.createdAt,
        updatedAt: chatSession.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error getting session:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to get session' },
      { status: 500 }
    );
  }
}

// PATCH /api/sessions/[id] - Update session (rename)
export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return Response.json({ error: 'Name is required' }, { status: 400 });
    }

    const chatSession = await sessionRepository.updateName(session.user.id, id, name);

    return Response.json({
      session: {
        id: chatSession._id,
        name: chatSession.name,
        status: chatSession.status,
      },
    });
  } catch (error) {
    console.error('Error updating session:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to update session' },
      { status: 400 }
    );
  }
}

// DELETE /api/sessions/[id] - Delete a session
export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    await sessionRepository.remove(session.user.id, id);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to delete session' },
      { status: 400 }
    );
  }
}
