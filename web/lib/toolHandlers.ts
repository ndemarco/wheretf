import {
  itemRepository,
  moduleRepository,
  templateRepository,
  parameterKeyRepository,
  unitRepository,
} from '@/repositories';
import { validatePath } from '@/lib/pathValidator';

type ToolHandler = (args: Record<string, unknown>, userId: string) => Promise<unknown>;

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
    return itemRepository.create({ userId, name, description, parameters, location });
  },

  'db.items.update': async (args, userId) => {
    const { location, updates } = args as {
      location: string;
      updates: Record<string, unknown>;
    };
    return itemRepository.update({ userId, location, updates });
  },

  'db.items.delete': async (args, userId) => {
    const { location } = args as { location: string };
    return itemRepository.remove(userId, location);
  },

  'db.items.move': async (args, userId) => {
    const { fromLocation, toLocation } = args as { fromLocation: string; toLocation: string };
    return itemRepository.move(userId, fromLocation, toLocation);
  },

  // Module tools
  'db.modules.search': async (args) => {
    const { query, name } = args as { query?: string; name?: string };
    return moduleRepository.search({ query, name });
  },

  'db.modules.create': async (args) => {
    const { name, description, dimensions } = args as {
      name: string;
      description?: string;
      dimensions: { label: string; values: string[]; templateMapping?: Record<string, string> }[];
    };
    return moduleRepository.create({ name, description, dimensions });
  },

  'db.modules.update': async (args) => {
    const { name, updates } = args as {
      name: string;
      updates: Record<string, unknown>;
    };
    return moduleRepository.update(name, updates);
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

    return moduleRepository.remove(name);
  },

  // Template tools
  'db.templates.search': async (args) => {
    const { query } = args as { query?: string };
    return templateRepository.search({ query });
  },

  'db.templates.create': async (args) => {
    const { name, description, dimensions } = args as {
      name: string;
      description?: string;
      dimensions: { label: string; values: string[] }[];
    };
    return templateRepository.create({ name, description, dimensions });
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
