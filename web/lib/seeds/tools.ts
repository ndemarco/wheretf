import { toolRepository } from '@/repositories';
import { IToolParameter } from '@/models/Tool';

export interface DefaultTool {
  name: string;
  description: string;
  category: 'agents' | 'items' | 'modules' | 'storage-types' | 'params' | 'units' | 'utility';
  parameters: IToolParameter[];
  handler: string;
}

export const defaultTools: DefaultTool[] = [
  // Agent runner tools
  {
    name: 'runModuleAgent',
    description:
      'Invoke when user wants to create or modify storage modules, cabinets, shelves, or configure storage layouts',
    category: 'agents',
    parameters: [
      {
        name: 'task',
        type: 'string',
        description: 'Summary of what the user wants to do',
        required: true,
      },
    ],
    handler: 'agents.runModule',
  },
  {
    name: 'runInventoryAgent',
    description:
      'Invoke when user wants to add, update, or describe items in storage locations',
    category: 'agents',
    parameters: [
      {
        name: 'task',
        type: 'string',
        description: 'Summary of what the user wants to do',
        required: true,
      },
    ],
    handler: 'agents.runInventory',
  },
  {
    name: 'runSearchAgent',
    description: 'Invoke when user wants to find items or check what is in a location',
    category: 'agents',
    parameters: [
      {
        name: 'task',
        type: 'string',
        description: 'Summary of what the user wants to do',
        required: true,
      },
    ],
    handler: 'agents.runSearch',
  },

  // Item tools
  {
    name: 'searchItems',
    description: 'Search inventory items by name, parameters, or location',
    category: 'items',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Text search query',
        required: false,
      },
      {
        name: 'location',
        type: 'string',
        description: 'Location path or prefix',
        required: false,
      },
      {
        name: 'parameters',
        type: 'array',
        description: 'Parameter filters [{key, value}]',
        required: false,
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Parameter key' },
            value: { type: 'string', description: 'Parameter value' },
          },
        },
      },
    ],
    handler: 'db.items.search',
  },
  {
    name: 'createItem',
    description: 'Create a new inventory item',
    category: 'items',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: 'Item name',
        required: true,
      },
      {
        name: 'description',
        type: 'string',
        description: 'Item description',
        required: false,
      },
      {
        name: 'parameters',
        type: 'array',
        description: 'Array of {key, value, unit}',
        required: false,
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Parameter key' },
            value: { type: 'string', description: 'Parameter value' },
            unit: { type: 'string', description: 'Unit (optional)' },
          },
        },
      },
      {
        name: 'location',
        type: 'string',
        description: 'Location path',
        required: true,
      },
    ],
    handler: 'db.items.create',
  },
  {
    name: 'updateItem',
    description: 'Update an existing item',
    category: 'items',
    parameters: [
      {
        name: 'location',
        type: 'string',
        description: 'Location path of item to update',
        required: true,
      },
      {
        name: 'updates',
        type: 'object',
        description: 'Fields to update',
        required: true,
      },
    ],
    handler: 'db.items.update',
  },
  {
    name: 'deleteItem',
    description: 'Delete an item from inventory',
    category: 'items',
    parameters: [
      {
        name: 'location',
        type: 'string',
        description: 'Location path of item to delete',
        required: true,
      },
    ],
    handler: 'db.items.delete',
  },
  {
    name: 'moveItem',
    description: 'Move an item from one location to another',
    category: 'items',
    parameters: [
      {
        name: 'fromLocation',
        type: 'string',
        description: 'Current location path of the item',
        required: true,
      },
      {
        name: 'toLocation',
        type: 'string',
        description: 'New location path for the item',
        required: true,
      },
    ],
    handler: 'db.items.move',
  },

  // Module tools
  {
    name: 'searchModules',
    description: 'Search for existing storage modules',
    category: 'modules',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Search query (name or description)',
        required: false,
      },
      {
        name: 'name',
        type: 'string',
        description: 'Exact module name',
        required: false,
      },
    ],
    handler: 'db.modules.search',
  },
  {
    name: 'createModule',
    description: 'Create a new storage module (cabinet, shelf unit, drawer bank, etc.)',
    category: 'modules',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: 'Module name (will be uppercased)',
        required: true,
      },
      {
        name: 'description',
        type: 'string',
        description: 'Human-readable description',
        required: false,
      },
      {
        name: 'dimensions',
        type: 'array',
        description: 'Array of dimension definitions. Each has label and values. Start simple - subdimensions can be added later with setSubdimensions.',
        required: true,
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'Dimension label (level, drawer, bin, shelf, etc.)' },
            values: { type: 'array', description: 'Valid values for this dimension', items: { type: 'string' } },
          },
        },
      },
    ],
    handler: 'db.modules.create',
  },
  {
    name: 'updateModule',
    description: 'Update an existing storage module',
    category: 'modules',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: 'Module name to update',
        required: true,
      },
      {
        name: 'updates',
        type: 'object',
        description: 'Fields to update',
        required: true,
      },
    ],
    handler: 'db.modules.update',
  },
  {
    name: 'deleteModule',
    description: 'Delete an existing storage module',
    category: 'modules',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: 'Module name to delete',
        required: true,
      },
    ],
    handler: 'db.modules.delete',
  },
  {
    name: 'setSubdimensions',
    description: 'Set the subdimensions (grid layout) for a specific dimension value. Use storageType to auto-configure from a known type (e.g., "plano-3700"), or specify subdimensions manually.',
    category: 'modules',
    parameters: [
      {
        name: 'moduleName',
        type: 'string',
        description: 'Module name',
        required: true,
      },
      {
        name: 'dimensionLabel',
        type: 'string',
        description: 'The dimension label (e.g., "level", "drawer")',
        required: true,
      },
      {
        name: 'dimensionValue',
        type: 'string',
        description: 'The specific value to configure (e.g., "2" for level-2)',
        required: true,
      },
      {
        name: 'storageType',
        type: 'string',
        description: 'Name of a known storage type (e.g., "plano-3700"). If provided, grid and merge constraints are auto-configured.',
        required: false,
      },
      {
        name: 'subdimensions',
        type: 'array',
        description: 'Array of subdimension definitions [{label, values}]. Required if storageType not provided. Overrides storageType grid if both specified.',
        required: false,
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'Subdimension label (row, col, bin)' },
            values: { type: 'array', description: 'Valid values', items: { type: 'string' } },
          },
        },
      },
    ],
    handler: 'db.modules.setSubdimensions',
  },
  {
    name: 'mergeCells',
    description: 'Merge multiple cells into one (like a spreadsheet merge). The first cell becomes the canonical address. Use for items that span multiple compartments.',
    category: 'modules',
    parameters: [
      {
        name: 'moduleName',
        type: 'string',
        description: 'Module name',
        required: true,
      },
      {
        name: 'dimensionLabel',
        type: 'string',
        description: 'The dimension label where subdimensions are defined (e.g., "level")',
        required: true,
      },
      {
        name: 'dimensionValue',
        type: 'string',
        description: 'The specific value (e.g., "2" for level-2)',
        required: true,
      },
      {
        name: 'cells',
        type: 'array',
        description: 'Array of cell addresses to merge. E.g., ["row-2:col-1", "row-2:col-2", "row-2:col-3"]. First cell becomes canonical.',
        required: true,
        items: { type: 'string' },
      },
    ],
    handler: 'db.modules.mergeCells',
  },
  {
    name: 'unmergeCells',
    description: 'Unmerge a previously merged cell group back to individual cells',
    category: 'modules',
    parameters: [
      {
        name: 'moduleName',
        type: 'string',
        description: 'Module name',
        required: true,
      },
      {
        name: 'dimensionLabel',
        type: 'string',
        description: 'The dimension label where subdimensions are defined',
        required: true,
      },
      {
        name: 'dimensionValue',
        type: 'string',
        description: 'The specific value (e.g., "2" for level-2)',
        required: true,
      },
      {
        name: 'canonical',
        type: 'string',
        description: 'The canonical address of the merged group to unmerge (e.g., "row-2:col-1")',
        required: true,
      },
    ],
    handler: 'db.modules.unmergeCells',
  },
  {
    name: 'getCellInfo',
    description: 'Get information about a cell, including whether it is part of a merged group',
    category: 'modules',
    parameters: [
      {
        name: 'moduleName',
        type: 'string',
        description: 'Module name',
        required: true,
      },
      {
        name: 'dimensionLabel',
        type: 'string',
        description: 'The dimension label where subdimensions are defined',
        required: true,
      },
      {
        name: 'dimensionValue',
        type: 'string',
        description: 'The specific value (e.g., "2" for level-2)',
        required: true,
      },
      {
        name: 'cellAddress',
        type: 'string',
        description: 'The cell address to look up (e.g., "row-2:col-3")',
        required: true,
      },
    ],
    handler: 'db.modules.getCellInfo',
  },
  {
    name: 'renameDimensionValue',
    description: 'Rename a dimension value (e.g., rename level "2" to "plano-box"). Automatically updates items at that location.',
    category: 'modules',
    parameters: [
      {
        name: 'moduleName',
        type: 'string',
        description: 'Module name',
        required: true,
      },
      {
        name: 'dimensionLabel',
        type: 'string',
        description: 'The dimension label (e.g., "level", "drawer")',
        required: true,
      },
      {
        name: 'oldValue',
        type: 'string',
        description: 'Current value to rename',
        required: true,
      },
      {
        name: 'newValue',
        type: 'string',
        description: 'New value name',
        required: true,
      },
    ],
    handler: 'db.modules.renameDimensionValue',
  },
  {
    name: 'addDimensionValue',
    description: 'Add a new value to an existing dimension (e.g., add level "6" to a module with 5 levels)',
    category: 'modules',
    parameters: [
      {
        name: 'moduleName',
        type: 'string',
        description: 'Module name',
        required: true,
      },
      {
        name: 'dimensionLabel',
        type: 'string',
        description: 'The dimension label (e.g., "level", "drawer")',
        required: true,
      },
      {
        name: 'newValue',
        type: 'string',
        description: 'New value to add',
        required: true,
      },
      {
        name: 'position',
        type: 'number',
        description: 'Position to insert at (0-indexed). If omitted, adds at end.',
        required: false,
      },
    ],
    handler: 'db.modules.addDimensionValue',
  },
  {
    name: 'removeDimensionValue',
    description: 'Remove a value from an existing dimension. Will fail if items exist at that location.',
    category: 'modules',
    parameters: [
      {
        name: 'moduleName',
        type: 'string',
        description: 'Module name',
        required: true,
      },
      {
        name: 'dimensionLabel',
        type: 'string',
        description: 'The dimension label (e.g., "level", "drawer")',
        required: true,
      },
      {
        name: 'value',
        type: 'string',
        description: 'Value to remove',
        required: true,
      },
    ],
    handler: 'db.modules.removeDimensionValue',
  },

  // Storage Type tools
  {
    name: 'searchStorageTypes',
    description: 'Search for known storage types (e.g., "plano", "gridfinity"). Returns grid configurations and merge constraints.',
    category: 'storage-types',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Search query (name, alias, or description)',
        required: false,
      },
      {
        name: 'name',
        type: 'string',
        description: 'Exact storage type name',
        required: false,
      },
    ],
    handler: 'db.storageTypes.search',
  },
  {
    name: 'createStorageType',
    description: 'Define a new storage type with grid configuration and merge constraints. Use this to teach the system about new organizer types.',
    category: 'storage-types',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: 'Storage type name (lowercase, hyphenated, e.g., "plano-3700")',
        required: true,
      },
      {
        name: 'aliases',
        type: 'array',
        description: 'Alternative names users might use (e.g., ["Plano 3700", "3700 tackle box"])',
        required: false,
        items: { type: 'string' },
      },
      {
        name: 'description',
        type: 'string',
        description: 'Human-readable description',
        required: false,
      },
      {
        name: 'defaultGrid',
        type: 'object',
        description: 'Default grid configuration with dimensions array',
        required: false,
      },
      {
        name: 'mergeConstraints',
        type: 'object',
        description: 'Merge constraints: { allowedAxes?: ["row"|"col"], maxMergeSize?: number, reason?: string }',
        required: false,
      },
      {
        name: 'notes',
        type: 'string',
        description: 'Additional notes about this storage type',
        required: false,
      },
    ],
    handler: 'db.storageTypes.create',
  },
  {
    name: 'updateStorageType',
    description: 'Update an existing storage type definition',
    category: 'storage-types',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: 'Storage type name to update',
        required: true,
      },
      {
        name: 'updates',
        type: 'object',
        description: 'Fields to update (aliases, description, defaultGrid, mergeConstraints, notes)',
        required: true,
      },
    ],
    handler: 'db.storageTypes.update',
  },

  // Parameter tools
  {
    name: 'searchParams',
    description: 'Search existing parameter keys',
    category: 'params',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Search query',
        required: false,
      },
      {
        name: 'category',
        type: 'string',
        description: 'Filter by category',
        required: false,
      },
    ],
    handler: 'db.params.search',
  },
  {
    name: 'createParam',
    description: 'Create a new parameter key',
    category: 'params',
    parameters: [
      {
        name: 'key',
        type: 'string',
        description: 'Parameter key (lowercase, underscore-separated)',
        required: true,
      },
      {
        name: 'description',
        type: 'string',
        description: 'What this parameter represents',
        required: false,
      },
      {
        name: 'category',
        type: 'string',
        description: 'Category (dimension, material, electrical)',
        required: false,
      },
      {
        name: 'commonUnits',
        type: 'array',
        description: 'Common units for this parameter',
        required: false,
        items: { type: 'string' },
      },
    ],
    handler: 'db.params.create',
  },

  // Unit tools
  {
    name: 'searchUnits',
    description: 'Search existing units',
    category: 'units',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Search query',
        required: false,
      },
      {
        name: 'type',
        type: 'string',
        description: 'Filter by type (length, voltage, etc.)',
        required: false,
      },
    ],
    handler: 'db.units.search',
  },
  {
    name: 'createUnit',
    description: 'Create a new unit',
    category: 'units',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: 'Unit abbreviation (lowercase)',
        required: true,
      },
      {
        name: 'fullName',
        type: 'string',
        description: 'Full name',
        required: false,
      },
      {
        name: 'type',
        type: 'string',
        description: 'Unit type (length, voltage, etc.)',
        required: false,
      },
    ],
    handler: 'db.units.create',
  },

  // Utility tools
  {
    name: 'validatePath',
    description: 'Validate a location path against module definitions. Also resolves merged cells to their canonical address.',
    category: 'utility',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'Location path to validate',
        required: true,
      },
    ],
    handler: 'util.validatePath',
  },
];

export async function seedTools(): Promise<void> {
  console.log('Seeding tools...');

  for (const tool of defaultTools) {
    await toolRepository.upsertDefault({
      ...tool,
      isSystem: true,
    });
  }

  console.log(`Seeded ${defaultTools.length} tools`);
}
