import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { moduleRepository, itemRepository } from '@/repositories';

// GET /api/modules/grid - Get grid structure and occupancy for a module dimension
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const moduleName = searchParams.get('module');
  const dimensionLabel = searchParams.get('dimensionLabel');
  const dimensionValue = searchParams.get('dimensionValue');

  if (!moduleName || !dimensionLabel || !dimensionValue) {
    return Response.json(
      { error: 'Missing required parameters: module, dimensionLabel, dimensionValue' },
      { status: 400 }
    );
  }

  try {
    // Get subdimensions for this location
    const subdimensions = await moduleRepository.getSubdimensions(
      moduleName,
      dimensionLabel,
      dimensionValue
    );

    // No subdimensions means this is a flat location (no grid)
    // Return a "flat" response instead of 404
    if (!subdimensions) {
      // Get items at this flat location
      const locationPrefix = `${moduleName.toUpperCase()}:${dimensionLabel}-${dimensionValue}`;
      const items = await itemRepository.search({
        userId: session.user.id,
        location: locationPrefix,
      });

      return Response.json({
        flat: true,
        location: locationPrefix,
        items: items.map((item) => ({
          name: item.name,
          location: item.location,
          description: item.description,
          parameters: item.parameters,
        })),
      });
    }

    // Extract row/col dimensions
    const rowDim = subdimensions.dimensions.find((d) => d.label === 'row');
    const colDim = subdimensions.dimensions.find((d) => d.label === 'col');

    if (!rowDim || !colDim) {
      return Response.json(
        { error: 'Grid must have row and col dimensions' },
        { status: 400 }
      );
    }

    // Get all items at this location to determine occupied cells
    const locationPrefix = `${moduleName.toUpperCase()}:${dimensionLabel}-${dimensionValue}`;
    const items = await itemRepository.search({
      userId: session.user.id,
      location: locationPrefix,
    });

    // Build set of occupied cell keys
    const occupiedCells: string[] = [];
    for (const item of items) {
      // Parse location to extract row and col
      // Format: MODULE:dim-value:row-X:col-Y
      const parts = item.location.split(':');
      let row: string | undefined;
      let col: string | undefined;

      for (const part of parts) {
        if (part.startsWith('row-')) {
          row = part.substring(4);
        } else if (part.startsWith('col-')) {
          col = part.substring(4);
        }
      }

      if (row && col) {
        occupiedCells.push(`row-${row}:col-${col}`);
      }
    }

    return Response.json({
      grid: {
        rows: rowDim.values,
        cols: colDim.values,
      },
      occupiedCells,
      cellGroups: subdimensions.cellGroups || [],
      storageType: subdimensions.storageType,
    });
  } catch (error) {
    console.error('Error getting grid info:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to get grid info' },
      { status: 500 }
    );
  }
}
