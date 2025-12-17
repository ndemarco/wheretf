import { auth } from '@/lib/auth';
import { toolRepository } from '@/repositories';
import { seedGlobalDefaults } from '@/lib/seeds';

// GET /api/tools - List all tools
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Ensure tools are seeded
    await seedGlobalDefaults();

    const tools = await toolRepository.list();
    return Response.json({ tools });
  } catch (error) {
    console.error('Error listing tools:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to list tools' },
      { status: 500 }
    );
  }
}
