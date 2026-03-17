import { auth } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { moduleRepository, assignmentRepository, insertRepository } from '@/repositories';

// GET /api/modules - List all modules for the current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const userId = session.user.id;

  const modules = await moduleRepository.search(userId);
  const summaries = await Promise.all(
    modules.map(async (m) => {
      const assignmentCount = await assignmentRepository.countByModule(userId, m._id);
      const leafPaths = moduleRepository.getLeafPaths(m);
      const inserts = await insertRepository.findByModule(userId, m._id);

      // Build per-value summaries
      const valueSummaries = await Promise.all(
        m.primaryDimension.values.map(async (v) => {
          const path = [v.label];
          const valAssignments = await assignmentRepository.findByLocationPrefix(userId, m._id, path);
          const valInserts = inserts.filter(
            (ins) => ins.locationPath && ins.locationPath.length > 0 && ins.locationPath[0] === v.label
          );
          return {
            label: v.label,
            type: v.location.type,
            disabled: v.location.disabled,
            childCount: v.location.children.length,
            hasTemplate: !!v.location.templateId,
            assignmentCount: valAssignments.length,
            inserts: valInserts.map((ins) => ins.name || 'Unnamed insert'),
          };
        })
      );

      return {
        id: m._id.toString(),
        name: m.name,
        description: m.description,
        dimensionName: m.primaryDimension.name,
        valueCount: m.primaryDimension.values.length,
        values: valueSummaries,
        totalLocations: leafPaths.length,
        assignedLocations: assignmentCount,
      };
    })
  );

  return Response.json({ modules: summaries });
}
