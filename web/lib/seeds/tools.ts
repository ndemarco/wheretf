import { toolRepository } from '@/repositories';
import { IToolParameter } from '@/models/Tool';

export interface DefaultTool {
  name: string;
  description: string;
  category: 'agents' | 'items' | 'modules' | 'templates' | 'params' | 'units' | 'utility';
  parameters: IToolParameter[];
  handler: string;
}

export const defaultTools: DefaultTool[] = [
  // Agent runner tools
  {
    name: 'runModuleAgent',
    description:
      'Invoke when user wants to create or modify storage modules, cabinets, shelves, or dimension templates',
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
    description: 'Create a new storage module',
    category: 'modules',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: 'Module name (uppercase)',
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
        description: 'Array of dimension definitions. Each has label, values, and optional templateMapping to link dimension values to templates for sub-dimensions.',
        required: true,
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'Dimension label (level, row, col, bin, drawer)' },
            values: { type: 'array', description: 'Valid values for this dimension', items: { type: 'string' } },
            templateMapping: { type: 'object', description: 'Maps dimension values to template names. E.g. {"2": "plano-3700", "3": "plano-3700"} to add row/col sub-dimensions for those values' },
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

  // Template tools
  {
    name: 'searchTemplates',
    description: 'Search for existing dimension templates',
    category: 'templates',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Search query',
        required: false,
      },
    ],
    handler: 'db.templates.search',
  },
  {
    name: 'createTemplate',
    description: 'Create a new dimension template',
    category: 'templates',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: 'Template name (lowercase, hyphenated)',
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
        description: 'Array of dimension definitions [{label, values}]',
        required: true,
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'Dimension label' },
            values: { type: 'array', description: 'Valid values for this dimension', items: { type: 'string' } },
          },
        },
      },
    ],
    handler: 'db.templates.create',
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
    description: 'Validate a location path against module definitions',
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
