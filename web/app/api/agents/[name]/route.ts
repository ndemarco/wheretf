import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { agentRepository } from '@/repositories';

type RouteContext = { params: Promise<{ name: string }> };

// GET /api/agents/[name] - Get a single agent
export async function GET(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name } = await context.params;

  try {
    const agent = await agentRepository.findByName(session.user.id, name);
    if (!agent) {
      return Response.json({ error: 'Agent not found' }, { status: 404 });
    }
    return Response.json({ agent });
  } catch (error) {
    console.error('Error getting agent:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to get agent' },
      { status: 500 }
    );
  }
}

// PATCH /api/agents/[name] - Update an agent
export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name } = await context.params;

  try {
    const body = await request.json();
    const { displayName, description, instructions, aiModel, tools, temperature, active } = body;

    const agent = await agentRepository.update({
      userId: session.user.id,
      name,
      updates: {
        displayName,
        description,
        instructions,
        aiModel,
        tools,
        temperature,
        ...(typeof active === 'boolean' && { active }),
      },
    });

    return Response.json({ agent });
  } catch (error) {
    console.error('Error updating agent:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to update agent' },
      { status: 400 }
    );
  }
}

// DELETE /api/agents/[name] - Delete an agent
export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name } = await context.params;

  try {
    await agentRepository.remove(session.user.id, name);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting agent:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to delete agent' },
      { status: 400 }
    );
  }
}
