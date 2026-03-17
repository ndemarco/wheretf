import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { moduleRepository, assignmentRepository, insertRepository, templateRepository } from '@/repositories';
import Item from '@/models/Item';

// GET /api/modules/:id/grid?path=3 - Get grid/location data for a specific path
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const pathParam = request.nextUrl.searchParams.get('path') || '';
  const path = pathParam.split(',').filter(Boolean);

  if (path.length === 0) {
    return Response.json({ error: 'Path parameter is required' }, { status: 400 });
  }

  await dbConnect();

  const mod = await moduleRepository.findById(id, session.user.id);
  if (!mod) {
    return Response.json({ error: 'Module not found' }, { status: 404 });
  }

  const location = moduleRepository.resolveLocation(mod, path);
  if (!location) {
    return Response.json({ error: 'Location not found' }, { status: 404 });
  }

  // Find inserts placed at this location
  const inserts = await insertRepository.findByModuleLocation(
    session.user.id,
    mod._id,
    path
  );

  // Find assignments at/under this location
  const assignments = await assignmentRepository.findByLocationPrefix(
    session.user.id,
    mod._id,
    path
  );

  // Enrich assignments with item names
  const itemIds = [...new Set(assignments.map((a) => a.itemId.toString()))];
  const items = await Item.find({ _id: { $in: itemIds } }).select('name description parameters');
  const itemMap = new Map(items.map((i) => [i._id.toString(), i]));

  const enrichedAssignments = assignments.map((a) => {
    const item = itemMap.get(a.itemId.toString());
    return {
      id: a._id.toString(),
      itemId: a.itemId.toString(),
      itemName: item?.name || 'Unknown',
      itemDescription: item?.description,
      itemParameters: item?.parameters,
      locationPath: a.locationPath,
      insertId: a.insertId?.toString(),
      insertLocationPath: a.insertLocationPath,
      assignedAt: a.createdAt,
    };
  });

  // Determine if this is a grid location or flat
  if (location.children.length > 0 && location.templateRows && location.templateCols) {
    // Grid location — build row/col structure
    const rows = new Set<string>();
    const cols = new Set<string>();
    const occupiedCells: string[] = [];
    const cellItems: Record<string, { itemName: string; itemDescription?: string }> = {};

    for (const child of location.children) {
      // Labels are "rowLabel,colLabel" format from applyTemplate
      const parts = child.label.split(',');
      if (parts.length === 2) {
        rows.add(parts[0]);
        cols.add(parts[1]);
      }
    }

    // Map assignments to cells
    for (const a of enrichedAssignments) {
      // Assignment path relative to current location
      const relPath = a.locationPath.slice(path.length);
      if (relPath.length === 1) {
        const cellKey = `row-${relPath[0].split(',')[0]}:col-${relPath[0].split(',')[1]}`;
        occupiedCells.push(cellKey);
        cellItems[cellKey] = {
          itemName: a.itemName,
          itemDescription: a.itemDescription,
        };
      }
    }

    return Response.json({
      location: {
        label: location.label,
        type: location.type,
        disabled: location.disabled,
      },
      grid: {
        rows: [...rows].sort(),
        cols: [...cols].sort((a, b) => parseInt(a) - parseInt(b)),
      },
      occupiedCells,
      cellItems,
      inserts: inserts.map((i) => ({
        id: i._id.toString(),
        name: i.name,
        footprint: i.footprint,
      })),
      totalAssignments: enrichedAssignments.length,
    });
  }

  // Check if an insert at this location has a grid
  if (inserts.length > 0) {
    const insert = inserts[0];

    // If insert has no locations but has a templateId, generate them on the fly
    if ((!insert.locations || insert.locations.length === 0) && insert.templateId) {
      const template = await templateRepository.findById(insert.templateId, session.user.id);
      if (template) {
        const genLabel = (labeling: { type: string; prefix?: string; labels?: string[]; startAt?: number }, idx: number) => {
          const prefix = labeling.prefix || '';
          if (labeling.type === 'alpha') return `${prefix}${String.fromCharCode(65 + idx)}`;
          if (labeling.type === 'custom') return labeling.labels?.[idx] || `${idx}`;
          return `${prefix}${(labeling.startAt || 0) + idx}`;
        };
        const locs = [];
        for (let r = 0; r < template.rows; r++) {
          for (let c = 0; c < template.cols; c++) {
            locs.push({ label: `${genLabel(template.rowLabeling, r)},${genLabel(template.colLabeling, c)}`, disabled: false, children: [] });
          }
        }
        insert.locations = locs;
        await insert.save();
      }
    }

    if (insert.locations && insert.locations.length > 0) {
      const rows = new Set<string>();
      const cols = new Set<string>();
      const occupiedCells: string[] = [];
      const cellItems: Record<string, { itemName: string; itemDescription?: string }> = {};

      for (const loc of insert.locations) {
        const parts = loc.label.split(',');
        if (parts.length === 2) {
          rows.add(parts[0]);
          cols.add(parts[1]);
        }
      }

      // Assignments that target this insert
      const insertAssignments = enrichedAssignments.filter(
        (a) => a.insertId === insert._id.toString()
      );
      for (const a of insertAssignments) {
        if (a.insertLocationPath && a.insertLocationPath.length === 1) {
          let segment = a.insertLocationPath[0];
          // Normalize "A2" → "A,2" if not already comma-separated
          if (!segment.includes(',')) {
            const match = segment.match(/^([A-Za-z]+)(\d+)$/);
            if (match) segment = `${match[1]},${match[2]}`;
          }
          const parts = segment.split(',');
          if (parts.length === 2) {
            const cellKey = `row-${parts[0]}:col-${parts[1]}`;
            occupiedCells.push(cellKey);
            cellItems[cellKey] = {
              itemName: a.itemName,
              itemDescription: a.itemDescription,
            };
          }
        }
      }

      return Response.json({
        location: {
          label: location.label,
          type: location.type,
          disabled: location.disabled,
        },
        insert: {
          id: insert._id.toString(),
          name: insert.name,
          footprint: insert.footprint,
        },
        grid: {
          rows: [...rows].sort(),
          cols: [...cols].sort((a, b) => parseInt(a) - parseInt(b)),
        },
        occupiedCells,
        cellItems,
        totalAssignments: insertAssignments.length,
      });
    }
  }

  // Flat location — just list what's here
  return Response.json({
    location: {
      label: location.label,
      type: location.type,
      disabled: location.disabled,
      childCount: location.children.length,
    },
    flat: true,
    items: enrichedAssignments.map((a) => ({
      itemName: a.itemName,
      itemDescription: a.itemDescription,
      itemParameters: a.itemParameters,
      assignedAt: a.assignedAt,
    })),
    inserts: inserts.map((i) => ({
      id: i._id.toString(),
      name: i.name,
      footprint: i.footprint,
    })),
    children: location.children.map((c) => ({
      label: c.label,
      type: c.type,
      disabled: c.disabled,
    })),
  });
}
