import {
  itemRepository,
  moduleRepository,
  parameterKeyRepository,
  unitRepository,
  storageTypeRepository,
  auditRepository,
} from '@/repositories';
import { validatePath } from '@/lib/pathValidator';
import { IMergeConstraints } from '@/models/StorageType';
import { AuditAction } from '@/models/AuditLog';

type ToolHandler = (args: Record<string, unknown>, userId: string) => Promise<unknown>;

// Helper to log audit events
async function audit(
  userId: string,
  action: AuditAction,
  entityType: 'item' | 'module',
  entityName: string,
  before: unknown,
  after: unknown,
  options?: { location?: string; metadata?: Record<string, unknown> }
) {
  try {
    await auditRepository.log({
      userId,
      action,
      entityType,
      entityName,
      location: options?.location,
      before: auditRepository.serializeForAudit(before),
      after: auditRepository.serializeForAudit(after),
      metadata: options?.metadata,
    });
  } catch (error) {
    // Log but don't fail the operation if audit logging fails
    console.error('Audit logging failed:', error);
  }
}

const handlers: Record<string, ToolHandler> = {
  // Item tools
  'db.items.search': async (args, userId) => {
    const { query, location, parameters } = args as {
      query?: string;
      location?: string;
      parameters?: { key: string; value: string }[];
    };
    return itemRepository.search({ userId, query, location, parameters });
  },

  'db.items.create': async (args, userId) => {
    const { name, description, parameters, location } = args as {
      name: string;
      description?: string;
      parameters?: { key: string; value: string; unit?: string }[];
      location: string;
    };
    const result = await itemRepository.create({ userId, name, description, parameters, location });
    await audit(userId, 'item.create', 'item', name, null, result, { location });
    return result;
  },

  'db.items.update': async (args, userId) => {
    const { location, updates } = args as {
      location: string;
      updates: Record<string, unknown>;
    };
    // Get before state
    const beforeItems = await itemRepository.search({ userId, location });
    const before = beforeItems.length > 0 ? beforeItems[0] : null;
    const result = await itemRepository.update({ userId, location, updates });
    await audit(userId, 'item.update', 'item', before?.name || location, before, result, { location });
    return result;
  },

  'db.items.delete': async (args, userId) => {
    const { location } = args as { location: string };
    // Get before state
    const beforeItems = await itemRepository.search({ userId, location });
    const before = beforeItems.length > 0 ? beforeItems[0] : null;
    const result = await itemRepository.remove(userId, location);
    await audit(userId, 'item.delete', 'item', before?.name || location, before, null, { location });
    return result;
  },

  'db.items.move': async (args, userId) => {
    const { fromLocation, toLocation } = args as { fromLocation: string; toLocation: string };
    // Get before state
    const beforeItems = await itemRepository.search({ userId, location: fromLocation });
    const before = beforeItems.length > 0 ? beforeItems[0] : null;
    const result = await itemRepository.move(userId, fromLocation, toLocation);
    await audit(userId, 'item.move', 'item', before?.name || fromLocation, before, result, {
      location: toLocation,
      metadata: { fromLocation, toLocation },
    });
    return result;
  },

  // Module tools
  'db.modules.search': async (args) => {
    const { query, name } = args as { query?: string; name?: string };
    return moduleRepository.search({ query, name });
  },

  'db.modules.create': async (args, userId) => {
    const { name, description, dimensions } = args as {
      name: string;
      description?: string;
      dimensions: { label: string; values: string[] }[];
    };
    const result = await moduleRepository.create({ userId, name, description, dimensions });
    await audit(userId, 'module.create', 'module', name, null, result);
    return result;
  },

  'db.modules.update': async (args, userId) => {
    const { name, updates } = args as {
      name: string;
      updates: Record<string, unknown>;
    };
    // Get before state
    const beforeModules = await moduleRepository.search({ name });
    const before = beforeModules.length > 0 ? beforeModules[0] : null;
    const result = await moduleRepository.update(name, updates);
    await audit(userId, 'module.update', 'module', name, before, result);
    return result;
  },

  'db.modules.delete': async (args, userId) => {
    const { name } = args as { name: string };

    // Check if user has items in this module
    const itemCount = await itemRepository.countByModule(userId, name);
    if (itemCount > 0) {
      return {
        blocked: true,
        error: `Cannot delete module "${name.toUpperCase()}" - you have ${itemCount} item${itemCount > 1 ? 's' : ''} stored in it. Move or delete these items first, then try again.`,
        itemCount,
        suggestion: `Use searchItems with location "${name.toUpperCase()}" to see what's there, then use moveItem to relocate them one by one.`,
      };
    }

    // Get before state
    const beforeModules = await moduleRepository.search({ name });
    const before = beforeModules.length > 0 ? beforeModules[0] : null;
    const result = await moduleRepository.remove(name);
    await audit(userId, 'module.delete', 'module', name, before, null);
    return result;
  },

  'db.modules.setSubdimensions': async (args, userId) => {
    const { moduleName, dimensionLabel, dimensionValue, storageType, subdimensions } = args as {
      moduleName: string;
      dimensionLabel: string;
      dimensionValue: string;
      storageType?: string;
      subdimensions?: { label: string; values: string[] }[];
    };

    // Get before state
    const beforeModules = await moduleRepository.search({ name: moduleName });
    const before = beforeModules.length > 0 ? beforeModules[0] : null;

    // If storageType provided, look it up and use its configuration
    if (storageType) {
      const storageTypeDoc = await storageTypeRepository.findByNameOrAlias(storageType);
      if (!storageTypeDoc) {
        throw new Error(`Storage type "${storageType}" not found. Use searchStorageTypes to see available types.`);
      }

      // Use provided subdimensions or fall back to storageType's defaultGrid
      const dimensions = subdimensions || storageTypeDoc.defaultGrid?.dimensions;
      if (!dimensions) {
        throw new Error(`Storage type "${storageType}" has no default grid. Provide subdimensions manually.`);
      }

      const result = await moduleRepository.setSubdimensions(moduleName, dimensionLabel, dimensionValue, {
        dimensions,
        cellGroups: [],
        storageType: storageTypeDoc.name,
        mergeConstraints: storageTypeDoc.mergeConstraints,
      });
      await audit(userId, 'module.setSubdimensions', 'module', moduleName, before, result, {
        metadata: { dimensionLabel, dimensionValue, storageType },
      });
      return result;
    }

    // No storageType - require subdimensions
    if (!subdimensions) {
      throw new Error('Either storageType or subdimensions must be provided');
    }

    const result = await moduleRepository.setSubdimensions(moduleName, dimensionLabel, dimensionValue, {
      dimensions: subdimensions,
      cellGroups: [],
    });
    await audit(userId, 'module.setSubdimensions', 'module', moduleName, before, result, {
      metadata: { dimensionLabel, dimensionValue },
    });
    return result;
  },

  'db.modules.mergeCells': async (args, userId) => {
    const { moduleName, dimensionLabel, dimensionValue, cells } = args as {
      moduleName: string;
      dimensionLabel: string;
      dimensionValue: string;
      cells: string[];
    };

    if (cells.length < 2) {
      throw new Error('Must specify at least 2 cells to merge');
    }

    // Get the module to check merge constraints
    const modules = await moduleRepository.search({ name: moduleName });
    if (modules.length === 0) {
      throw new Error(`Module "${moduleName}" not found`);
    }
    const storageModule = modules[0];

    // Find the dimension and check subdimensions for merge constraints
    const dimension = storageModule.dimensions.find(
      (d: { label: string }) => d.label.toLowerCase() === dimensionLabel.toLowerCase()
    );
    if (!dimension) {
      throw new Error(`Dimension "${dimensionLabel}" not found in module "${moduleName}"`);
    }

    // subdimensions is a Map from Mongoose, need to access it appropriately
    const subdimensionsMap = dimension.subdimensions as unknown as Map<string, { mergeConstraints?: IMergeConstraints }> | undefined;
    const subdims = subdimensionsMap?.get(dimensionValue.toLowerCase());
    const mergeConstraints = subdims?.mergeConstraints;

    // Validate against merge constraints if present
    if (mergeConstraints) {
      // Check max merge size
      if (mergeConstraints.maxMergeSize && cells.length > mergeConstraints.maxMergeSize) {
        return {
          blocked: true,
          error: `Cannot merge ${cells.length} cells - maximum merge size is ${mergeConstraints.maxMergeSize}`,
          reason: mergeConstraints.reason,
        };
      }

      // Check allowed axes
      if (mergeConstraints.allowedAxes && mergeConstraints.allowedAxes.length > 0) {
        // Parse cells to determine which axes are being merged
        // Cells format: "row-1:col-2" - parse and find which dimensions vary
        const parsedCells = cells.map(cell => {
          const parts: Record<string, string> = {};
          cell.split(':').forEach(part => {
            const [label, value] = part.split('-');
            parts[label.toLowerCase()] = value;
          });
          return parts;
        });

        // Find which dimensions have varying values
        const varyingAxes: string[] = [];
        const firstCell = parsedCells[0];
        for (const axis of Object.keys(firstCell)) {
          const values = new Set(parsedCells.map(c => c[axis]));
          if (values.size > 1) {
            varyingAxes.push(axis);
          }
        }

        // Check if any varying axis is not allowed
        const disallowedAxes = varyingAxes.filter(axis => !mergeConstraints.allowedAxes!.includes(axis));
        if (disallowedAxes.length > 0) {
          return {
            blocked: true,
            error: `Cannot merge across ${disallowedAxes.join(', ')} axis - only ${mergeConstraints.allowedAxes.join(', ')} merges allowed`,
            reason: mergeConstraints.reason,
            suggestion: `This storage type has fixed ${disallowedAxes.join('/')} dividers. Only merge cells within the same ${disallowedAxes.join('/')}.`,
          };
        }
      }
    }

    // Check for items in the merge range
    const itemsInRange: { location: string; name: string }[] = [];
    for (const cell of cells) {
      const fullPath = `${moduleName.toUpperCase()}:${dimensionLabel}-${dimensionValue}:${cell}`;
      const items = await itemRepository.search({ userId, location: fullPath });
      for (const item of items) {
        itemsInRange.push({ location: item.location, name: item.name });
      }
    }

    // Handle items in merge range
    if (itemsInRange.length > 1) {
      return {
        blocked: true,
        error: `Cannot merge cells - found ${itemsInRange.length} items in the range:`,
        items: itemsInRange,
        suggestion: 'Move or delete items so at most one remains, then try again.',
      };
    }

    // If one item exists, move it to the canonical address
    const canonical = cells[0];
    if (itemsInRange.length === 1) {
      const canonicalPath = `${moduleName.toUpperCase()}:${dimensionLabel}-${dimensionValue}:${canonical}`;
      if (itemsInRange[0].location !== canonicalPath) {
        await itemRepository.move(userId, itemsInRange[0].location, canonicalPath);
      }
    }

    // Create the cell group
    const cellGroup = {
      canonical,
      members: cells,
    };

    const result = await moduleRepository.addCellGroup(moduleName, dimensionLabel, dimensionValue, cellGroup);

    await audit(userId, 'module.mergeCells', 'module', moduleName, storageModule, result, {
      metadata: { dimensionLabel, dimensionValue, cells, canonical },
    });

    return {
      success: true,
      message: `Merged ${cells.length} cells. Canonical address: ${canonical}`,
      itemMoved: itemsInRange.length === 1 ? itemsInRange[0].name : null,
      cellGroup,
      module: result,
    };
  },

  'db.modules.unmergeCells': async (args, userId) => {
    const { moduleName, dimensionLabel, dimensionValue, canonical } = args as {
      moduleName: string;
      dimensionLabel: string;
      dimensionValue: string;
      canonical: string;
    };

    // Get before state
    const beforeModules = await moduleRepository.search({ name: moduleName });
    const before = beforeModules.length > 0 ? beforeModules[0] : null;

    // Check if there's an item at the canonical address
    const canonicalPath = `${moduleName.toUpperCase()}:${dimensionLabel}-${dimensionValue}:${canonical}`;
    const items = await itemRepository.search({ userId, location: canonicalPath });

    const result = await moduleRepository.removeCellGroup(moduleName, dimensionLabel, dimensionValue, canonical);

    await audit(userId, 'module.unmergeCells', 'module', moduleName, before, result, {
      metadata: { dimensionLabel, dimensionValue, canonical },
    });

    return {
      success: true,
      message: `Unmerged cell group with canonical address: ${canonical}`,
      itemAtCanonical: items.length > 0 ? items[0].name : null,
      note: items.length > 0 ? `Item "${items[0].name}" remains at ${canonicalPath}` : null,
      module: result,
    };
  },

  'db.modules.getCellInfo': async (args) => {
    const { moduleName, dimensionLabel, dimensionValue, cellAddress } = args as {
      moduleName: string;
      dimensionLabel: string;
      dimensionValue: string;
      cellAddress: string;
    };

    const cellGroup = await moduleRepository.findCellGroup(moduleName, dimensionLabel, dimensionValue, cellAddress);

    if (cellGroup) {
      return {
        merged: true,
        canonical: cellGroup.canonical,
        isCanonical: cellGroup.canonical === cellAddress,
        members: cellGroup.members,
        memberCount: cellGroup.members.length,
      };
    }

    return {
      merged: false,
      address: cellAddress,
    };
  },

  'db.modules.renameDimensionValue': async (args, userId) => {
    const { moduleName, dimensionLabel, oldValue, newValue } = args as {
      moduleName: string;
      dimensionLabel: string;
      oldValue: string;
      newValue: string;
    };

    // Get before state
    const beforeModules = await moduleRepository.search({ name: moduleName });
    const before = beforeModules.length > 0 ? beforeModules[0] : null;

    const result = await moduleRepository.renameDimensionValue(
      moduleName,
      dimensionLabel,
      oldValue,
      newValue
    );

    // Update all items with locations matching the old path prefix
    const itemsUpdated = await itemRepository.updateLocationPrefix(
      userId,
      result.oldPathPrefix,
      result.newPathPrefix
    );

    await audit(userId, 'module.renameDimensionValue', 'module', moduleName, before, result.module, {
      metadata: { dimensionLabel, oldValue, newValue, itemsUpdated },
    });

    return {
      success: true,
      message: `Renamed ${dimensionLabel} "${oldValue}" to "${newValue}"`,
      oldPath: result.oldPathPrefix,
      newPath: result.newPathPrefix,
      itemsUpdated,
      module: result.module,
    };
  },

  'db.modules.addDimensionValue': async (args, userId) => {
    const { moduleName, dimensionLabel, newValue, position } = args as {
      moduleName: string;
      dimensionLabel: string;
      newValue: string;
      position?: number;
    };

    // Get before state
    const beforeModules = await moduleRepository.search({ name: moduleName });
    const before = beforeModules.length > 0 ? beforeModules[0] : null;

    const storageModule = await moduleRepository.addDimensionValue(
      moduleName,
      dimensionLabel,
      newValue,
      position
    );

    await audit(userId, 'module.addDimensionValue', 'module', moduleName, before, storageModule, {
      metadata: { dimensionLabel, newValue, position },
    });

    return {
      success: true,
      message: `Added "${newValue}" to ${dimensionLabel}`,
      module: storageModule,
    };
  },

  'db.modules.removeDimensionValue': async (args, userId) => {
    const { moduleName, dimensionLabel, value } = args as {
      moduleName: string;
      dimensionLabel: string;
      value: string;
    };

    // Check if any items exist at this location
    const pathPrefix = `${moduleName.toUpperCase()}:${dimensionLabel}-${value}`;
    const items = await itemRepository.search({ userId, location: pathPrefix });

    if (items.length > 0) {
      return {
        blocked: true,
        error: `Cannot remove ${dimensionLabel} "${value}" - ${items.length} item(s) exist at this location`,
        items: items.map((i) => ({ name: i.name, location: i.location })),
        suggestion: 'Move or delete these items first, then try again.',
      };
    }

    // Get before state
    const beforeModules = await moduleRepository.search({ name: moduleName });
    const before = beforeModules.length > 0 ? beforeModules[0] : null;

    const storageModule = await moduleRepository.removeDimensionValue(
      moduleName,
      dimensionLabel,
      value
    );

    await audit(userId, 'module.removeDimensionValue', 'module', moduleName, before, storageModule, {
      metadata: { dimensionLabel, value },
    });

    return {
      success: true,
      message: `Removed "${value}" from ${dimensionLabel}`,
      module: storageModule,
    };
  },

  // Storage Type tools
  'db.storageTypes.search': async (args) => {
    const { query, name } = args as { query?: string; name?: string };
    return storageTypeRepository.search({ query, name });
  },

  'db.storageTypes.create': async (args) => {
    const { name, aliases, description, defaultGrid, mergeConstraints, notes } = args as {
      name: string;
      aliases?: string[];
      description?: string;
      defaultGrid?: { dimensions: { label: string; values: string[] }[] };
      mergeConstraints?: IMergeConstraints;
      notes?: string;
    };
    return storageTypeRepository.create({
      name,
      aliases,
      description,
      defaultGrid,
      mergeConstraints,
      notes,
    });
  },

  'db.storageTypes.update': async (args) => {
    const { name, updates } = args as {
      name: string;
      updates: Record<string, unknown>;
    };
    return storageTypeRepository.update(name, updates);
  },

  // Parameter tools
  'db.params.search': async (args) => {
    const { query, category } = args as { query?: string; category?: string };
    return parameterKeyRepository.search({ query, category });
  },

  'db.params.create': async (args) => {
    const { key, description, category, commonUnits } = args as {
      key: string;
      description?: string;
      category?: string;
      commonUnits?: string[];
    };
    return parameterKeyRepository.create({ key, description, category, commonUnits });
  },

  // Unit tools
  'db.units.search': async (args) => {
    const { query, type } = args as { query?: string; type?: string };
    return unitRepository.search({ query, type });
  },

  'db.units.create': async (args) => {
    const { name, fullName, type } = args as {
      name: string;
      fullName?: string;
      type?: string;
    };
    return unitRepository.create({ name, fullName, type });
  },

  // Utility tools
  'util.validatePath': async (args) => {
    const { path } = args as { path: string };
    return validatePath(path);
  },
};

export async function executeHandler(
  handlerName: string,
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  const handler = handlers[handlerName];
  if (!handler) {
    throw new Error(`Unknown handler: ${handlerName}`);
  }
  return handler(args, userId);
}

export default handlers;
