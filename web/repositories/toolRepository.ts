import Tool, { ITool, IToolParameter } from '@/models/Tool';
import dbConnect from '@/lib/mongodb';

export interface CreateToolInput {
  name: string;
  description?: string;
  category: 'agents' | 'items' | 'modules' | 'templates' | 'params' | 'units' | 'utility';
  parameters: IToolParameter[];
  handler: string;
  isSystem?: boolean;
}

export interface SearchToolsInput {
  category?: string;
  active?: boolean;
}

export async function create(input: CreateToolInput): Promise<ITool> {
  await dbConnect();

  const existing = await Tool.findOne({ name: input.name });
  if (existing) {
    throw new Error(`Tool "${input.name}" already exists`);
  }

  const tool = await Tool.create({
    name: input.name,
    description: input.description,
    category: input.category,
    parameters: input.parameters,
    handler: input.handler,
    isSystem: input.isSystem ?? true,
    active: true,
  });

  return tool;
}

export async function findByName(name: string): Promise<ITool | null> {
  await dbConnect();
  return Tool.findOne({ name });
}

export async function findByNames(names: string[]): Promise<ITool[]> {
  await dbConnect();
  return Tool.find({ name: { $in: names }, active: true });
}

export async function list(): Promise<ITool[]> {
  await dbConnect();
  return Tool.find().sort({ category: 1, name: 1 });
}

export async function listActive(): Promise<ITool[]> {
  await dbConnect();
  return Tool.find({ active: true }).sort({ category: 1, name: 1 });
}

export async function listByCategory(category: string): Promise<ITool[]> {
  await dbConnect();
  return Tool.find({ category, active: true }).sort({ name: 1 });
}

export async function toggleActive(name: string): Promise<ITool> {
  await dbConnect();

  const tool = await Tool.findOne({ name });
  if (!tool) {
    throw new Error(`Tool "${name}" not found`);
  }

  tool.active = !tool.active;
  await tool.save();

  return tool;
}

export async function update(
  name: string,
  updates: Partial<CreateToolInput>
): Promise<ITool> {
  await dbConnect();

  const tool = await Tool.findOne({ name });
  if (!tool) {
    throw new Error(`Tool "${name}" not found`);
  }

  Object.assign(tool, updates);
  await tool.save();

  return tool;
}

/**
 * Upsert a tool - create if not exists, update parameters if exists (for system tools)
 */
export async function upsertDefault(input: CreateToolInput): Promise<ITool> {
  await dbConnect();

  const result = await Tool.findOneAndUpdate(
    { name: input.name },
    {
      $set: {
        description: input.description,
        category: input.category,
        parameters: input.parameters,
        handler: input.handler,
        isSystem: input.isSystem ?? true,
      },
      $setOnInsert: { active: true },
    },
    { upsert: true, new: true }
  );

  return result;
}

/**
 * Format tool for OpenAI function calling
 */
export function formatForOpenAI(tool: ITool): {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required: string[];
    };
  };
} {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const param of tool.parameters) {
    const paramSchema: Record<string, unknown> = {
      type: param.type,
      description: param.description,
    };

    if (param.enum) {
      paramSchema.enum = param.enum;
    }

    // OpenAI requires 'items' schema for array types
    if (param.type === 'array' && param.items) {
      paramSchema.items = param.items;
    } else if (param.type === 'array') {
      // Default to object items if not specified
      paramSchema.items = { type: 'object' };
    }

    properties[param.name] = paramSchema;

    if (param.required) {
      required.push(param.name);
    }
  }

  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description || '',
      parameters: {
        type: 'object',
        properties,
        required,
      },
    },
  };
}
