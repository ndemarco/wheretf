import { toolRepository } from '@/repositories';
import { IToolParameter } from '@/models/Tool';

export interface DefaultTool {
  name: string;
  description: string;
  category: 'agents' | 'templates' | 'modules' | 'inserts' | 'items' | 'assignments';
  parameters: IToolParameter[];
  handler: string;
}

export const defaultTools: DefaultTool[] = [
  // ── Agent routing tools ──────────────────────────────────────────────

  {
    name: 'runStorageAgent',
    description:
      'Delegate to the storage specialist. Use for: creating/modifying/inspecting templates, modules, inserts, storage layout, AND for placing items into storage or moving items between locations.',
    category: 'agents',
    parameters: [
      {
        name: 'task',
        type: 'string',
        description: 'The user\'s message or a summary of what they want to do',
        required: true,
      },
    ],
    handler: 'agents.runStorage',
  },
  {
    name: 'runInventoryAgent',
    description:
      'Delegate to the inventory specialist. Use when the user wants to add, find, move, or manage items, OR when asking what is stored at a location (e.g., "what\'s in level 1 of MUSE").',
    category: 'agents',
    parameters: [
      {
        name: 'task',
        type: 'string',
        description: 'The user\'s message or a summary of what they want to do',
        required: true,
      },
    ],
    handler: 'agents.runInventory',
  },

  // ── Template tools ───────────────────────────────────────────────────

  {
    name: 'createTemplate',
    description:
      'Create a new storage template (fixed or parametric). Templates define the blueprint for a grid of locations — row/col counts, labeling schemes, subdivision options, and interface types.',
    category: 'templates',
    parameters: [
      { name: 'name', type: 'string', description: 'Template name (e.g., "Plano Stowaway 3600", "gridfinity-42mm")', required: true },
      { name: 'kind', type: 'string', description: 'Template kind', required: true, enum: ['fixed', 'parametric'] },
      { name: 'description', type: 'string', description: 'Human-readable description', required: false },
      { name: 'rows', type: 'number', description: 'Number of rows (or default rows for parametric)', required: true },
      { name: 'cols', type: 'number', description: 'Number of columns (or default cols for parametric)', required: true },
      {
        name: 'rowLabeling', type: 'object', description: 'Row labeling scheme: { type: "numeric"|"alpha"|"custom", prefix?, startAt?, labels? }. Defaults to alpha (A, B, C, ...)', required: false,
      },
      {
        name: 'colLabeling', type: 'object', description: 'Column labeling scheme: { type: "numeric"|"alpha"|"custom", prefix?, startAt?, labels? }. Defaults to numeric (1, 2, 3, ...)', required: false,
      },
      {
        name: 'rowConstraints', type: 'object', description: 'Row dimension constraints: { min?, max?, softMin?, softMax? }', required: false,
      },
      {
        name: 'colConstraints', type: 'object', description: 'Column dimension constraints: { min?, max?, softMin?, softMax? }', required: false,
      },
      { name: 'unitSizeMm', type: 'number', description: 'Base unit size in mm (e.g., 42 for Gridfinity)', required: false },
      { name: 'primaryAxis', type: 'string', description: 'Primary axis for labeling ("row" or "col")', required: false },
      {
        name: 'subdivisionOptions', type: 'array', description: 'Available subdivision configurations: [{ name, description?, resultingLabels, accessoryProduct? }]', required: false,
        items: { type: 'object', properties: { name: { type: 'string', description: 'Subdivision name' } } },
      },
      {
        name: 'interfaceTypesAccepted', type: 'array', description: 'Interface types this template\'s locations can accept (for receptacle locations)', required: false,
        items: { type: 'string' },
      },
      { name: 'interfaceTypeProvided', type: 'string', description: 'Interface type this template provides (for inserts)', required: false },
      { name: 'metadata', type: 'object', description: 'Arbitrary key-value metadata', required: false },
    ],
    handler: 'templates.create',
  },
  {
    name: 'listTemplates',
    description:
      'Search and list templates. Filter by name, kind (fixed/parametric), or interface type provided. Returns all templates if no filters given.',
    category: 'templates',
    parameters: [
      { name: 'name', type: 'string', description: 'Filter by name (partial, case-insensitive)', required: false },
      { name: 'kind', type: 'string', description: 'Filter by kind', required: false, enum: ['fixed', 'parametric'] },
      { name: 'interfaceTypeProvided', type: 'string', description: 'Filter by interface type provided', required: false },
    ],
    handler: 'templates.list',
  },
  {
    name: 'getTemplate',
    description:
      'Get a single template by exact name or ID. Returns full details including labeling schemes, constraints, and subdivision options.',
    category: 'templates',
    parameters: [
      { name: 'name', type: 'string', description: 'Exact template name', required: false },
      { name: 'id', type: 'string', description: 'Template ID', required: false },
    ],
    handler: 'templates.get',
  },
  {
    name: 'updateTemplate',
    description: 'Update an existing template. Only provided fields are changed.',
    category: 'templates',
    parameters: [
      { name: 'id', type: 'string', description: 'Template ID to update', required: true },
      { name: 'updates', type: 'object', description: 'Fields to update (name, description, rows, cols, labeling, constraints, etc.)', required: true },
    ],
    handler: 'templates.update',
  },
  {
    name: 'deleteTemplate',
    description: 'Delete a template. Will fail if any modules or inserts reference this template.',
    category: 'templates',
    parameters: [
      { name: 'id', type: 'string', description: 'Template ID to delete', required: true },
    ],
    handler: 'templates.delete',
  },

  // ── Module tools ─────────────────────────────────────────────────────

  {
    name: 'createModule',
    description:
      'Create a new storage module (cabinet, shelf unit, drawer bank, etc.). You MUST construct the primaryDimension object yourself from context — never ask the user about it. Example: "MUSE with 11 levels" → primaryDimension: { name: "level", labeling: { type: "numeric", startAt: 1 }, values: [{ label: "1", location: { label: "1", type: "leaf" } }, { label: "2", location: { label: "2", type: "leaf" } }, ...] }. For drawers: name: "drawer". For shelves: name: "shelf". Default location type is "leaf" unless the user mentions inserts/organizers (use "receptacle").',
    category: 'modules',
    parameters: [
      { name: 'name', type: 'string', description: 'Module name (e.g., "MUSE", "ALEX-1")', required: true },
      { name: 'description', type: 'string', description: 'Human-readable description', required: false },
      {
        name: 'primaryDimension', type: 'object', required: true,
        description: 'Construct this from context. Structure: { name: "level"|"drawer"|"shelf"|etc., labeling: { type: "numeric"|"alpha"|"custom", startAt?: number }, values: [{ label: string, location: { label: string, type: "receptacle"|"fixed"|"leaf" } }] }. Generate one value entry per level/drawer/shelf the user described.',
      },
      { name: 'metadata', type: 'object', description: 'Arbitrary key-value metadata', required: false },
    ],
    handler: 'modules.create',
  },
  {
    name: 'listModules',
    description: 'List all modules, optionally filtering by name. Returns module names, descriptions, and their dimension values (levels, drawers, etc.).',
    category: 'modules',
    parameters: [
      { name: 'name', type: 'string', description: 'Filter by name (partial, case-insensitive)', required: false },
    ],
    handler: 'modules.list',
  },
  {
    name: 'getModule',
    description: 'Get a module by exact name or ID. Returns full structure including all locations.',
    category: 'modules',
    parameters: [
      { name: 'name', type: 'string', description: 'Exact module name', required: false },
      { name: 'id', type: 'string', description: 'Module ID', required: false },
    ],
    handler: 'modules.get',
  },
  {
    name: 'deleteModule',
    description:
      'Delete a module. Checks for existing assignments and inserts first — returns an error with counts if any exist, requiring explicit force=true to proceed.',
    category: 'modules',
    parameters: [
      { name: 'id', type: 'string', description: 'Module ID to delete', required: true },
      { name: 'force', type: 'boolean', description: 'If true, also removes all assignments and unplaces all inserts. Default false.', required: false },
    ],
    handler: 'modules.delete',
  },
  {
    name: 'addDimensionValue',
    description:
      'Add a new value to a module\'s primary dimension (e.g., add shelf 6 to a 5-shelf unit). Creates a leaf location by default.',
    category: 'modules',
    parameters: [
      { name: 'moduleId', type: 'string', description: 'Module ID', required: true },
      { name: 'label', type: 'string', description: 'Label for the new value (e.g., "6", "top")', required: true },
      { name: 'locationType', type: 'string', description: 'Location type for this value', required: false, enum: ['receptacle', 'fixed', 'leaf'] },
      { name: 'interfaceTypeAccepted', type: 'string', description: 'Interface type accepted (for receptacle locations)', required: false },
    ],
    handler: 'modules.addDimensionValue',
  },
  {
    name: 'removeDimensionValue',
    description:
      'Remove a value from a module\'s primary dimension. Fails if assignments exist under this value unless force=true.',
    category: 'modules',
    parameters: [
      { name: 'moduleId', type: 'string', description: 'Module ID', required: true },
      { name: 'label', type: 'string', description: 'Label of the value to remove', required: true },
      { name: 'force', type: 'boolean', description: 'If true, also removes assignments under this value. Default false.', required: false },
    ],
    handler: 'modules.removeDimensionValue',
  },
  {
    name: 'applyTemplate',
    description:
      'Apply a template to a location within a module, generating a grid of child locations. The location becomes "fixed" with children derived from the template\'s row/col configuration.',
    category: 'modules',
    parameters: [
      { name: 'moduleId', type: 'string', description: 'Module ID', required: true },
      { name: 'path', type: 'array', description: 'Path to the target location (e.g., ["3"] for level 3)', required: true, items: { type: 'string' } },
      { name: 'templateId', type: 'string', description: 'Template ID to apply', required: true },
      { name: 'rows', type: 'number', description: 'Number of rows (overrides template default for parametric templates)', required: false },
      { name: 'cols', type: 'number', description: 'Number of columns (overrides template default for parametric templates)', required: false },
      { name: 'childLocationType', type: 'string', description: 'Type for generated child locations (default: "leaf")', required: false, enum: ['receptacle', 'fixed', 'leaf'] },
    ],
    handler: 'modules.applyTemplate',
  },
  {
    name: 'overrideLocation',
    description:
      'Apply an override to a location: merge adjacent locations, divide a location into sub-locations, or disable a location entirely.',
    category: 'modules',
    parameters: [
      { name: 'moduleId', type: 'string', description: 'Module ID', required: true },
      { name: 'path', type: 'array', description: 'Path to the target location', required: true, items: { type: 'string' } },
      { name: 'type', type: 'string', description: 'Override type', required: true, enum: ['merge', 'divide', 'disable'] },
      { name: 'reason', type: 'string', description: 'Reason for the override (especially useful for disable)', required: false },
      {
        name: 'mergedPositions', type: 'array', description: 'For merge: array of {row, col} positions to merge with the target', required: false,
        items: { type: 'object', properties: { row: { type: 'string', description: 'Row' }, col: { type: 'string', description: 'Col' } } },
      },
      {
        name: 'divideInto', type: 'array', description: 'For divide: labels for the resulting sub-locations', required: false,
        items: { type: 'string' },
      },
    ],
    handler: 'modules.overrideLocation',
  },
  {
    name: 'setLocationEnabled',
    description: 'Enable or disable a location. Disabled locations cannot receive assignments.',
    category: 'modules',
    parameters: [
      { name: 'moduleId', type: 'string', description: 'Module ID', required: true },
      { name: 'path', type: 'array', description: 'Path to the target location', required: true, items: { type: 'string' } },
      { name: 'enabled', type: 'boolean', description: 'True to enable, false to disable', required: true },
      { name: 'reason', type: 'string', description: 'Reason (for disabling)', required: false },
    ],
    handler: 'modules.setLocationEnabled',
  },
  {
    name: 'getModuleMap',
    description:
      'Get all leaf (assignable) location paths in a module. Useful for understanding the full structure before placing items.',
    category: 'modules',
    parameters: [
      { name: 'moduleId', type: 'string', description: 'Module ID (or use moduleName)', required: false },
      { name: 'moduleName', type: 'string', description: 'Module name (alternative to moduleId)', required: false },
    ],
    handler: 'modules.getModuleMap',
  },

  // ── Insert tools ─────────────────────────────────────────────────────

  {
    name: 'createInsert',
    description:
      'Create a new insert (a physical organizer that can be placed into a receptacle location). Can be defined from a template or with a structural definition.',
    category: 'inserts',
    parameters: [
      { name: 'name', type: 'string', description: 'Insert name (e.g., "Plano 3700 #1", "GF bin A")', required: false },
      { name: 'templateId', type: 'string', description: 'Template ID to base this insert on', required: false },
      {
        name: 'structuralDefinition', type: 'object', required: false,
        description: 'Manual structure (if no template): { rows, cols, rowLabeling: { type, prefix?, startAt? }, colLabeling: { type, prefix?, startAt? } }',
      },
      {
        name: 'footprint', type: 'object', description: 'How many receptacle units this insert occupies: { rows, cols }', required: false,
      },
      { name: 'interfaceTypeProvided', type: 'string', description: 'Interface type this insert provides', required: false },
      { name: 'metadata', type: 'object', description: 'Arbitrary key-value metadata', required: false },
    ],
    handler: 'inserts.create',
  },
  {
    name: 'listInserts',
    description:
      'Search and list inserts. Filter by name, template, current module, or find unplaced inserts.',
    category: 'inserts',
    parameters: [
      { name: 'name', type: 'string', description: 'Filter by name (partial, case-insensitive)', required: false },
      { name: 'templateId', type: 'string', description: 'Filter by template ID', required: false },
      { name: 'moduleId', type: 'string', description: 'Filter by current module ID', required: false },
      { name: 'unassigned', type: 'boolean', description: 'If true, only return inserts not placed in any module', required: false },
    ],
    handler: 'inserts.list',
  },
  {
    name: 'updateInsert',
    description:
      'Update an insert\'s name or metadata. Use this to rename an insert.',
    category: 'inserts',
    parameters: [
      { name: 'insertId', type: 'string', description: 'Insert ID or name', required: true },
      { name: 'name', type: 'string', description: 'New name for the insert', required: false },
      { name: 'metadata', type: 'object', description: 'New metadata', required: false },
    ],
    handler: 'inserts.update',
  },
  {
    name: 'placeInsert',
    description:
      'Place an insert into a receptacle location within a module. The location must accept the insert\'s interface type.',
    category: 'inserts',
    parameters: [
      { name: 'insertId', type: 'string', description: 'Insert ID to place', required: true },
      { name: 'moduleId', type: 'string', description: 'Target module ID', required: true },
      { name: 'locationPath', type: 'array', description: 'Path to the receptacle location', required: true, items: { type: 'string' } },
    ],
    handler: 'inserts.place',
  },
  {
    name: 'removeInsert',
    description:
      'Remove an insert from its current module location (unplace it). The insert and its internal assignments remain intact.',
    category: 'inserts',
    parameters: [
      { name: 'insertId', type: 'string', description: 'Insert ID to remove', required: true },
    ],
    handler: 'inserts.remove',
  },
  {
    name: 'relocateInsert',
    description:
      'Move an insert from one location to another. All assignments within the insert move with it.',
    category: 'inserts',
    parameters: [
      { name: 'insertId', type: 'string', description: 'Insert ID to relocate', required: true },
      { name: 'newModuleId', type: 'string', description: 'Target module ID', required: true },
      { name: 'newLocationPath', type: 'array', description: 'Path to the new receptacle location', required: true, items: { type: 'string' } },
    ],
    handler: 'inserts.relocate',
  },
  {
    name: 'deleteInsert',
    description:
      'Delete an insert entirely. Fails if assignments exist within the insert unless force=true.',
    category: 'inserts',
    parameters: [
      { name: 'insertId', type: 'string', description: 'Insert ID to delete', required: true },
      { name: 'force', type: 'boolean', description: 'If true, also removes all assignments within the insert. Default false.', required: false },
    ],
    handler: 'inserts.delete',
  },

  // ── Item tools ───────────────────────────────────────────────────────

  {
    name: 'createItem',
    description:
      'Create a new item (component, part, material, supply). Items have a short name, optional description, and key-value parameters (e.g., resistance: 10k ohm).',
    category: 'items',
    parameters: [
      { name: 'name', type: 'string', description: 'Short, scannable item name (e.g., "10k resistor", "M3x8 socket head cap screw")', required: true },
      { name: 'description', type: 'string', description: 'Longer description with additional detail', required: false },
      {
        name: 'parameters', type: 'array', description: 'Technical parameters: [{ key, value, unit? }]', required: false,
        items: { type: 'object', properties: { key: { type: 'string', description: 'Parameter key' }, value: { type: 'string', description: 'Parameter value' }, unit: { type: 'string', description: 'Unit (optional)' } } },
      },
      { name: 'metadata', type: 'object', description: 'Arbitrary key-value metadata', required: false },
    ],
    handler: 'items.create',
  },
  {
    name: 'findItems',
    description:
      'Search for items by text (searches name + description), exact name, or parameter key/value. Use text search for fuzzy queries like "resistor" or "M3 screw".',
    category: 'items',
    parameters: [
      { name: 'text', type: 'string', description: 'Full-text search across name and description', required: false },
      { name: 'name', type: 'string', description: 'Filter by name (partial, case-insensitive)', required: false },
      { name: 'parameterKey', type: 'string', description: 'Filter by parameter key (e.g., "resistance")', required: false },
      { name: 'parameterValue', type: 'string', description: 'Filter by parameter value (requires parameterKey)', required: false },
    ],
    handler: 'items.find',
  },
  {
    name: 'getItem',
    description: 'Get a single item by exact name or ID, including all parameters.',
    category: 'items',
    parameters: [
      { name: 'name', type: 'string', description: 'Exact item name', required: false },
      { name: 'id', type: 'string', description: 'Item ID', required: false },
    ],
    handler: 'items.get',
  },
  {
    name: 'updateItem',
    description:
      'Update an item\'s name, description, or parameters. For parameters, you can replace the entire array or use addParameter/removeParameter for surgical edits.',
    category: 'items',
    parameters: [
      { name: 'id', type: 'string', description: 'Item ID to update', required: true },
      { name: 'name', type: 'string', description: 'New name', required: false },
      { name: 'description', type: 'string', description: 'New description', required: false },
      {
        name: 'parameters', type: 'array', description: 'Replace all parameters with this array', required: false,
        items: { type: 'object', properties: { key: { type: 'string', description: 'Parameter key' }, value: { type: 'string', description: 'Parameter value' }, unit: { type: 'string', description: 'Unit (optional)' } } },
      },
      { name: 'addParameter', type: 'object', description: 'Add a single parameter: { key, value, unit? }', required: false },
      { name: 'removeParameterKey', type: 'string', description: 'Remove all parameters with this key', required: false },
    ],
    handler: 'items.update',
  },
  {
    name: 'deleteItem',
    description:
      'Delete an item. Also removes all assignments for this item.',
    category: 'items',
    parameters: [
      { name: 'id', type: 'string', description: 'Item ID to delete', required: true },
    ],
    handler: 'items.delete',
  },

  {
    name: 'mergeItems',
    description:
      'Merge duplicate items into one. Keeps the specified item, reassigns all assignments from duplicates to the keeper, then deletes the duplicates. Use this instead of manually deleting and reassigning.',
    category: 'items',
    parameters: [
      { name: 'keeperId', type: 'string', description: 'ID of the item to keep', required: true },
      { name: 'duplicateIds', type: 'array', description: 'IDs of duplicate items to merge into the keeper', required: true, items: { type: 'string' } },
      { name: 'keeperName', type: 'string', description: 'Optional: update the keeper item name', required: false },
      { name: 'keeperDescription', type: 'string', description: 'Optional: update the keeper item description', required: false },
      { name: 'keeperParameters', type: 'array', description: 'Optional: replace the keeper item parameters', required: false, items: { type: 'object' } },
    ],
    handler: 'items.merge',
  },

  // ── Assignment tools ─────────────────────────────────────────────────

  {
    name: 'assignItem',
    description:
      'Assign an item to a location (module location or insert internal location). One assignment per location — fails if the location is already occupied.',
    category: 'assignments',
    parameters: [
      { name: 'itemId', type: 'string', description: 'Item ID to assign', required: true },
      { name: 'moduleId', type: 'string', description: 'Module ID', required: true },
      { name: 'locationPath', type: 'array', description: 'Path within the module (e.g., ["3", "2,5"])', required: true, items: { type: 'string' } },
      { name: 'insertId', type: 'string', description: 'Insert ID (if assigning within an insert)', required: false },
      { name: 'insertLocationPath', type: 'array', description: 'Path within the insert (if assigning within an insert)', required: false, items: { type: 'string' } },
    ],
    handler: 'assignments.assign',
  },
  {
    name: 'unassignItem',
    description: 'Remove an item\'s assignment at a specific location.',
    category: 'assignments',
    parameters: [
      { name: 'assignmentId', type: 'string', description: 'Assignment ID to remove', required: true },
    ],
    handler: 'assignments.unassign',
  },
  {
    name: 'moveItem',
    description:
      'Move an assignment from one location to another. The item stays the same, only the location changes.',
    category: 'assignments',
    parameters: [
      { name: 'assignmentId', type: 'string', description: 'Assignment ID to move', required: true },
      { name: 'newModuleId', type: 'string', description: 'Target module ID', required: true },
      { name: 'newLocationPath', type: 'array', description: 'New path within the module', required: true, items: { type: 'string' } },
      { name: 'newInsertId', type: 'string', description: 'New insert ID (if moving into an insert)', required: false },
      { name: 'newInsertLocationPath', type: 'array', description: 'New path within the insert', required: false, items: { type: 'string' } },
    ],
    handler: 'assignments.move',
  },
  {
    name: 'findItemLocations',
    description:
      'Find all locations where an item is assigned. Answers "where are my M3 screws?" Returns assignment details with full paths.',
    category: 'assignments',
    parameters: [
      { name: 'itemId', type: 'string', description: 'Item ID to find', required: true },
    ],
    handler: 'assignments.findByItem',
  },
  {
    name: 'inspectLocation',
    description:
      'Inspect a location: structure, overrides, inserts, and assignments. Answers "what\'s in MUSE level 3?" or "what\'s in wire connectors A1?". For insert-internal queries, provide insertName/insertId and insertPath.',
    category: 'assignments',
    parameters: [
      { name: 'moduleId', type: 'string', description: 'Module ID (or use moduleName)', required: false },
      { name: 'moduleName', type: 'string', description: 'Module name (alternative to moduleId)', required: false },
      { name: 'path', type: 'array', description: 'Path to the module location (e.g., ["2"] for level 2)', required: true, items: { type: 'string' } },
      { name: 'insertName', type: 'string', description: 'Insert name to inspect inside (e.g., "wire connectors")', required: false },
      { name: 'insertId', type: 'string', description: 'Insert ID to inspect inside', required: false },
      { name: 'insertPath', type: 'array', description: 'Path within the insert (e.g., ["A,1"] for row A col 1)', required: false, items: { type: 'string' } },
    ],
    handler: 'assignments.inspectLocation',
  },
  {
    name: 'findUnassigned',
    description: 'Find items that have no assignments anywhere — homeless items.',
    category: 'assignments',
    parameters: [],
    handler: 'assignments.findUnassigned',
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
