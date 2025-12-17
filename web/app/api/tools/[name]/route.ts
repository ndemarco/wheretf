import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { toolRepository } from '@/repositories';

type RouteContext = { params: Promise<{ name: string }> };

// GET /api/tools/[name] - Get a single tool
export async function GET(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name } = await context.params;

  try {
    const tool = await toolRepository.findByName(name);
    if (!tool) {
      return Response.json({ error: 'Tool not found' }, { status: 404 });
    }
    return Response.json({ tool });
  } catch (error) {
    console.error('Error getting tool:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to get tool' },
      { status: 500 }
    );
  }
}

// PATCH /api/tools/[name] - Toggle tool active status
export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name } = await context.params;

  try {
    const tool = await toolRepository.toggleActive(name);
    return Response.json({ tool });
  } catch (error) {
    console.error('Error toggling tool:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to toggle tool' },
      { status: 400 }
    );
  }
}
