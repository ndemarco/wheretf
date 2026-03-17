import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { moduleRepository } from '@/repositories';

// GET /api/modules/:id - Get full module detail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  await dbConnect();

  const mod = await moduleRepository.findById(id, session.user.id);
  if (!mod) {
    return Response.json({ error: 'Module not found' }, { status: 404 });
  }

  return Response.json({
    module: {
      id: mod._id.toString(),
      name: mod.name,
      description: mod.description,
      primaryDimension: {
        name: mod.primaryDimension.name,
        labeling: mod.primaryDimension.labeling,
        values: mod.primaryDimension.values.map((v) => ({
          label: v.label,
          location: {
            label: v.location.label,
            type: v.location.type,
            disabled: v.location.disabled,
            childCount: v.location.children.length,
            hasTemplate: !!v.location.templateId,
            templateRows: v.location.templateRows,
            templateCols: v.location.templateCols,
          },
        })),
      },
    },
  });
}
