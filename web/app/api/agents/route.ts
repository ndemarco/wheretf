import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { agentRepository } from '@/repositories';
import { ensureUserSeeded } from '@/lib/seeds';

// GET /api/agents - List all agents for current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Ensure user has default agents seeded
    await ensureUserSeeded(session.user.id);

    const agents = await agentRepository.list(session.user.id);
    return Response.json({ agents });
  } catch (error) {
    console.error('Error listing agents:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to list agents' },
      { status: 500 }
    );
  }
}

// POST /api/agents - Create a new agent
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, displayName, description, instructions, aiModel, tools, temperature } = body;

    if (!name || !instructions) {
      return Response.json(
        { error: 'Name and instructions are required' },
        { status: 400 }
      );
    }

    const agent = await agentRepository.create({
      userId: session.user.id,
      name,
      displayName,
      description,
      instructions,
      aiModel,
      tools,
      temperature,
      isSystem: false,
    });

    return Response.json({ agent }, { status: 201 });
  } catch (error) {
    console.error('Error creating agent:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to create agent' },
      { status: 400 }
    );
  }
}
