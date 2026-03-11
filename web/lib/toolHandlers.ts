import { Types } from 'mongoose';
import { templateRepository } from '@/repositories/templateRepository';
import { moduleRepository, CreateModuleInput } from '@/repositories/moduleRepository';
import { insertRepository, CreateInsertInput } from '@/repositories/insertRepository';
import { itemRepository } from '@/repositories/itemRepository';
import { assignmentRepository } from '@/repositories/assignmentRepository';
import type { IOverride } from '@/models/Module';

type ToolHandler = (args: Record<string, unknown>, userId: string) => Promise<unknown>;

// ── Template handlers ────────────────────────────────────────────────

const templateHandlers: Record<string, ToolHandler> = {
  async create(args, userId) {
    const template = await templateRepository.create({
      name: args.name as string,
      kind: args.kind as 'fixed' | 'parametric',
      userId: new Types.ObjectId(userId),
      description: args.description as string | undefined,
      rows: args.rows as number,
      cols: args.cols as number,
      rowLabeling: args.rowLabeling as { type: 'numeric' | 'alpha' | 'custom'; prefix?: string; labels?: string[]; startAt?: number },
      colLabeling: args.colLabeling as { type: 'numeric' | 'alpha' | 'custom'; prefix?: string; labels?: string[]; startAt?: number },
      rowConstraints: args.rowConstraints as { min?: number; max?: number; softMin?: number; softMax?: number } | undefined,
      colConstraints: args.colConstraints as { min?: number; max?: number; softMin?: number; softMax?: number } | undefined,
      unitSizeMm: args.unitSizeMm as number | undefined,
      primaryAxis: args.primaryAxis as 'row' | 'col' | undefined,
      subdivisionOptions: args.subdivisionOptions as { name: string; description?: string; resultingLabels: string[]; accessoryProduct?: string }[] | undefined,
      interfaceTypesAccepted: args.interfaceTypesAccepted as string[] | undefined,
      interfaceTypeProvided: args.interfaceTypeProvided as string | undefined,
      metadata: args.metadata as Record<string, unknown> | undefined,
    });
    return { id: template._id, name: template.name, kind: template.kind, rows: template.rows, cols: template.cols };
  },

  async list(args, userId) {
    const templates = await templateRepository.search(new Types.ObjectId(userId), {
      name: args.name as string | undefined,
      kind: args.kind as 'fixed' | 'parametric' | undefined,
      interfaceTypeProvided: args.interfaceTypeProvided as string | undefined,
    });
    return templates.map((t) => ({ id: t._id, name: t.name, kind: t.kind, description: t.description, rows: t.rows, cols: t.cols }));
  },

  async get(args, userId) {
    const uid = new Types.ObjectId(userId);
    let template;
    if (args.id) {
      template = await templateRepository.findById(args.id as string, uid);
    } else if (args.name) {
      template = await templateRepository.findByName(args.name as string, uid);
    }
    if (!template) return { error: 'Template not found' };
    return template.toObject();
  },

  async update(args, userId) {
    const updated = await templateRepository.update(args.id as string, new Types.ObjectId(userId), args.updates as Record<string, unknown>);
    if (!updated) return { error: 'Template not found' };
    return { id: updated._id, name: updated.name, updated: true };
  },

  async delete(args, userId) {
    const uid = new Types.ObjectId(userId);
    const modules = await moduleRepository.search(uid);
    for (const mod of modules) {
      for (const val of mod.primaryDimension.values) {
        if (hasTemplateRef(val.location, args.id as string)) {
          return { error: `Template is in use by module "${mod.name}". Remove template references first.` };
        }
      }
    }
    const deleted = await templateRepository.remove(args.id as string, uid);
    return { deleted };
  },
};

function hasTemplateRef(location: { templateId?: Types.ObjectId; children: unknown[] }, templateId: string): boolean {
  if (location.templateId?.toString() === templateId) return true;
  for (const child of location.children as { templateId?: Types.ObjectId; children: unknown[] }[]) {
    if (hasTemplateRef(child, templateId)) return true;
  }
  return false;
}

// ── Module handlers ──────────────────────────────────────────────────

const moduleHandlers: Record<string, ToolHandler> = {
  async create(args, userId) {
    const mod = await moduleRepository.create({
      name: args.name as string,
      description: args.description as string | undefined,
      userId: new Types.ObjectId(userId),
      primaryDimension: args.primaryDimension as CreateModuleInput['primaryDimension'],
      metadata: args.metadata as Record<string, unknown> | undefined,
    });
    return {
      id: mod._id,
      name: mod.name,
      primaryDimension: mod.primaryDimension.name,
      values: mod.primaryDimension.values.map((v) => v.label),
    };
  },

  async list(args, userId) {
    const modules = await moduleRepository.search(new Types.ObjectId(userId), {
      name: args.name as string | undefined,
    });
    return modules.map((m) => ({
      id: m._id,
      name: m.name,
      description: m.description,
      primaryDimension: m.primaryDimension.name,
      values: m.primaryDimension.values.map((v) => v.label),
    }));
  },

  async get(args, userId) {
    const uid = new Types.ObjectId(userId);
    let mod;
    if (args.id) {
      mod = await moduleRepository.findById(args.id as string, uid);
    } else if (args.name) {
      mod = await moduleRepository.findByName(args.name as string, uid);
    }
    if (!mod) return { error: 'Module not found' };
    return mod.toObject();
  },

  async delete(args, userId) {
    const uid = new Types.ObjectId(userId);
    const moduleId = args.id as string;
    const force = args.force === true;

    const assignmentCount = await assignmentRepository.countByModule(uid, moduleId);
    const inserts = await insertRepository.findByModule(uid, moduleId);

    if ((assignmentCount > 0 || inserts.length > 0) && !force) {
      return {
        error: 'Module has existing data. Use force=true to delete anyway.',
        assignmentCount,
        insertCount: inserts.length,
      };
    }

    if (force) {
      await assignmentRepository.removeByModule(uid, moduleId);
      for (const ins of inserts) {
        await insertRepository.unplace(ins._id, uid);
      }
    }

    const deleted = await moduleRepository.remove(moduleId, uid);
    return { deleted };
  },

  async addDimensionValue(args, userId) {
    const uid = new Types.ObjectId(userId);
    const locationType = (args.locationType as string) || 'leaf';
    const mod = await moduleRepository.addPrimaryDimensionValue(
      args.moduleId as string,
      uid,
      args.label as string,
      {
        type: locationType as 'receptacle' | 'fixed' | 'leaf',
        interfaceTypeAccepted: args.interfaceTypeAccepted as string | undefined,
      }
    );
    if (!mod) return { error: 'Module not found' };
    return { name: mod.name, values: mod.primaryDimension.values.map((v) => v.label) };
  },

  async removeDimensionValue(args, userId) {
    const uid = new Types.ObjectId(userId);
    const moduleId = args.moduleId as string;
    const label = args.label as string;
    const force = args.force === true;

    const mod = await moduleRepository.findById(moduleId, uid);
    if (!mod) return { error: 'Module not found' };

    if (!force) {
      const assignments = await assignmentRepository.findByLocationPrefix(uid, mod._id, [label]);
      if (assignments.length > 0) {
        return { error: `${assignments.length} assignments exist under "${label}". Use force=true to remove them.` };
      }
    } else {
      const assignments = await assignmentRepository.findByLocationPrefix(uid, mod._id, [label]);
      for (const a of assignments) {
        await assignmentRepository.remove(a._id, uid);
      }
    }

    const updated = await moduleRepository.removePrimaryDimensionValue(moduleId, uid, label);
    if (!updated) return { error: 'Module not found' };
    return { name: updated.name, values: updated.primaryDimension.values.map((v) => v.label) };
  },

  async applyTemplate(args, userId) {
    const uid = new Types.ObjectId(userId);
    const templateId = new Types.ObjectId(args.templateId as string);
    const template = await templateRepository.findById(templateId, uid);
    if (!template) return { error: 'Template not found' };

    const rows = (args.rows as number) || template.rows;
    const cols = (args.cols as number) || template.cols;

    const mod = await moduleRepository.applyTemplate(
      args.moduleId as string,
      uid,
      args.path as string[],
      templateId,
      rows,
      cols,
      template.rowLabeling,
      template.colLabeling,
      (args.childLocationType as 'receptacle' | 'fixed' | 'leaf') || 'leaf',
      template.interfaceTypesAccepted?.[0]
    );
    if (!mod) return { error: 'Module or location not found' };
    return { name: mod.name, template: template.name, rows, cols, applied: true };
  },

  async overrideLocation(args, userId) {
    const uid = new Types.ObjectId(userId);
    const moduleId = args.moduleId as string;
    const path = args.path as string[];
    const type = args.type as string;

    if (type === 'disable') {
      const mod = await moduleRepository.disableLocation(moduleId, uid, path, args.reason as string | undefined);
      if (!mod) return { error: 'Module or location not found' };
      return { disabled: true, path };
    }

    const override: Record<string, unknown> = { type };
    if (type === 'merge') {
      override.originPosition = { row: 0, col: 0 };
      override.mergedPositions = args.mergedPositions || [];
    } else if (type === 'divide') {
      override.position = { row: 0, col: 0 };
      override.method = 'custom';
      override.customLabels = args.divideInto || [];
    }

    const mod = await moduleRepository.addOverride(moduleId, uid, path, override as unknown as IOverride);
    if (!mod) return { error: 'Module or location not found' };
    return { overrideApplied: true, type, path };
  },

  async setLocationEnabled(args, userId) {
    const uid = new Types.ObjectId(userId);
    const moduleId = args.moduleId as string;
    const path = args.path as string[];
    const enabled = args.enabled as boolean;

    let mod;
    if (enabled) {
      mod = await moduleRepository.enableLocation(moduleId, uid, path);
    } else {
      mod = await moduleRepository.disableLocation(moduleId, uid, path, args.reason as string | undefined);
    }
    if (!mod) return { error: 'Module or location not found' };
    return { path, enabled };
  },

  async getModuleMap(args, userId) {
    const uid = new Types.ObjectId(userId);
    let mod;
    if (args.moduleId) {
      mod = await moduleRepository.findById(args.moduleId as string, uid);
    } else if (args.moduleName) {
      mod = await moduleRepository.findByName(args.moduleName as string, uid);
    }
    if (!mod) return { error: 'Module not found' };
    const leafPaths = moduleRepository.getLeafPaths(mod);
    return { name: mod.name, leafPaths, totalLocations: leafPaths.length };
  },
};

// ── Insert handlers ──────────────────────────────────────────────────

const insertHandlers: Record<string, ToolHandler> = {
  async create(args, userId) {
    const insert = await insertRepository.create({
      name: args.name as string | undefined,
      userId: new Types.ObjectId(userId),
      templateId: args.templateId ? new Types.ObjectId(args.templateId as string) : undefined,
      structuralDefinition: args.structuralDefinition as CreateInsertInput['structuralDefinition'],
      footprint: args.footprint as { rows: number; cols: number } | undefined,
      interfaceTypeProvided: args.interfaceTypeProvided as string | undefined,
      metadata: args.metadata as Record<string, unknown> | undefined,
    });
    return { id: insert._id, name: insert.name };
  },

  async list(args, userId) {
    const inserts = await insertRepository.search(new Types.ObjectId(userId), {
      name: args.name as string | undefined,
      templateId: args.templateId as string | undefined,
      moduleId: args.moduleId as string | undefined,
      unassigned: args.unassigned as boolean | undefined,
    });
    return inserts.map((i) => ({
      id: i._id,
      name: i.name,
      templateId: i.templateId,
      moduleId: i.moduleId,
      locationPath: i.locationPath,
      footprint: i.footprint,
    }));
  },

  async place(args, userId) {
    const uid = new Types.ObjectId(userId);
    const insert = await insertRepository.place(
      args.insertId as string,
      uid,
      new Types.ObjectId(args.moduleId as string),
      args.locationPath as string[]
    );
    if (!insert) return { error: 'Insert not found' };
    return { id: insert._id, name: insert.name, moduleId: insert.moduleId, locationPath: insert.locationPath, placed: true };
  },

  async remove(args, userId) {
    const uid = new Types.ObjectId(userId);
    const insert = await insertRepository.unplace(args.insertId as string, uid);
    if (!insert) return { error: 'Insert not found' };
    return { id: insert._id, name: insert.name, unplaced: true };
  },

  async relocate(args, userId) {
    const uid = new Types.ObjectId(userId);
    const newModuleId = new Types.ObjectId(args.newModuleId as string);
    const newLocationPath = args.newLocationPath as string[];

    const insert = await insertRepository.relocate(args.insertId as string, uid, newModuleId, newLocationPath);
    if (!insert) return { error: 'Insert not found' };

    const reassigned = await assignmentRepository.reassignInsert(uid, insert._id, newModuleId, newLocationPath);
    return { id: insert._id, name: insert.name, moduleId: newModuleId, locationPath: newLocationPath, reassignedCount: reassigned };
  },

  async delete(args, userId) {
    const uid = new Types.ObjectId(userId);
    const insertId = args.insertId as string;
    const force = args.force === true;

    const assignments = await assignmentRepository.findByInsert(uid, insertId);
    if (assignments.length > 0 && !force) {
      return { error: `Insert has ${assignments.length} assignments. Use force=true to delete anyway.` };
    }

    if (force && assignments.length > 0) {
      for (const a of assignments) {
        await assignmentRepository.remove(a._id, uid);
      }
    }

    const deleted = await insertRepository.remove(insertId, uid);
    return { deleted };
  },
};

// ── Item handlers ────────────────────────────────────────────────────

const itemHandlers: Record<string, ToolHandler> = {
  async create(args, userId) {
    const item = await itemRepository.create({
      name: args.name as string,
      description: args.description as string | undefined,
      userId: new Types.ObjectId(userId),
      parameters: args.parameters as { key: string; value: string; unit?: string }[] | undefined,
      metadata: args.metadata as Record<string, unknown> | undefined,
    });
    return { id: item._id, name: item.name };
  },

  async find(args, userId) {
    const items = await itemRepository.search(new Types.ObjectId(userId), {
      text: args.text as string | undefined,
      name: args.name as string | undefined,
      parameterKey: args.parameterKey as string | undefined,
      parameterValue: args.parameterValue as string | undefined,
    });
    return items.map((i) => ({
      id: i._id,
      name: i.name,
      description: i.description,
      parameters: i.parameters,
    }));
  },

  async get(args, userId) {
    const uid = new Types.ObjectId(userId);
    let item;
    if (args.id) {
      item = await itemRepository.findById(args.id as string, uid);
    } else if (args.name) {
      item = await itemRepository.findByName(args.name as string, uid);
    }
    if (!item) return { error: 'Item not found' };
    return item.toObject();
  },

  async update(args, userId) {
    const uid = new Types.ObjectId(userId);
    const id = args.id as string;

    if (args.addParameter) {
      const param = args.addParameter as { key: string; value: string; unit?: string };
      const item = await itemRepository.addParameter(id, uid, param);
      if (!item) return { error: 'Item not found' };
      return { id: item._id, name: item.name, updated: true };
    }

    if (args.removeParameterKey) {
      const item = await itemRepository.removeParameter(id, uid, args.removeParameterKey as string);
      if (!item) return { error: 'Item not found' };
      return { id: item._id, name: item.name, updated: true };
    }

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.parameters !== undefined) updates.parameters = args.parameters;

    const item = await itemRepository.update(id, uid, updates);
    if (!item) return { error: 'Item not found' };
    return { id: item._id, name: item.name, updated: true };
  },

  async delete(args, userId) {
    const uid = new Types.ObjectId(userId);
    const itemId = args.id as string;
    await assignmentRepository.removeByItem(uid, itemId);
    const deleted = await itemRepository.remove(itemId, uid);
    return { deleted };
  },
};

// ── Assignment handlers ──────────────────────────────────────────────

const assignmentHandlers: Record<string, ToolHandler> = {
  async assign(args, userId) {
    const uid = new Types.ObjectId(userId);

    const occupied = await assignmentRepository.isLocationOccupied(
      uid,
      args.moduleId as string,
      args.locationPath as string[],
      args.insertId ? new Types.ObjectId(args.insertId as string) : undefined,
      args.insertLocationPath as string[] | undefined
    );
    if (occupied) {
      return { error: 'Location is already occupied by another assignment' };
    }

    const assignment = await assignmentRepository.create({
      userId: uid,
      itemId: new Types.ObjectId(args.itemId as string),
      moduleId: new Types.ObjectId(args.moduleId as string),
      locationPath: args.locationPath as string[],
      insertId: args.insertId ? new Types.ObjectId(args.insertId as string) : undefined,
      insertLocationPath: args.insertLocationPath as string[] | undefined,
    });
    return { id: assignment._id, assigned: true };
  },

  async unassign(args, userId) {
    const uid = new Types.ObjectId(userId);
    const deleted = await assignmentRepository.remove(args.assignmentId as string, uid);
    return { deleted };
  },

  async move(args, userId) {
    const uid = new Types.ObjectId(userId);
    const newLocation = {
      moduleId: new Types.ObjectId(args.newModuleId as string),
      locationPath: args.newLocationPath as string[],
      insertId: args.newInsertId ? new Types.ObjectId(args.newInsertId as string) : undefined,
      insertLocationPath: args.newInsertLocationPath as string[] | undefined,
    };

    const occupied = await assignmentRepository.isLocationOccupied(
      uid,
      args.newModuleId as string,
      args.newLocationPath as string[],
      newLocation.insertId,
      newLocation.insertLocationPath
    );
    if (occupied) {
      return { error: 'Destination location is already occupied' };
    }

    const assignment = await assignmentRepository.reassign(args.assignmentId as string, uid, newLocation);
    if (!assignment) return { error: 'Assignment not found' };
    return { id: assignment._id, moved: true };
  },

  async findByItem(args, userId) {
    const uid = new Types.ObjectId(userId);
    const assignments = await assignmentRepository.findByItem(uid, args.itemId as string);
    const item = await itemRepository.findById(args.itemId as string, uid);

    return {
      item: item ? { id: item._id, name: item.name } : null,
      assignments: assignments.map((a) => ({
        id: a._id,
        moduleId: a.moduleId,
        locationPath: a.locationPath,
        insertId: a.insertId,
        insertLocationPath: a.insertLocationPath,
        assignedAt: a.assignedAt,
      })),
      totalLocations: assignments.length,
    };
  },

  async inspectLocation(args, userId) {
    const uid = new Types.ObjectId(userId);

    let mod;
    if (args.moduleId) {
      mod = await moduleRepository.findById(args.moduleId as string, uid);
    } else if (args.moduleName) {
      mod = await moduleRepository.findByName(args.moduleName as string, uid);
    }
    if (!mod) return { error: 'Module not found' };

    const path = args.path as string[];
    const location = moduleRepository.resolveLocation(mod, path);
    if (!location) return { error: `Location not found at path: ${path.join(' / ')}` };

    const assignments = await assignmentRepository.findByLocationPrefix(uid, mod._id, path);
    const inserts = await insertRepository.findByModuleLocation(uid, mod._id, path);

    const enriched = await Promise.all(
      assignments.map(async (a) => {
        const item = await itemRepository.findById(a.itemId, uid);
        return {
          id: a._id,
          itemId: a.itemId,
          itemName: item?.name || 'Unknown',
          locationPath: a.locationPath,
          insertId: a.insertId,
          insertLocationPath: a.insertLocationPath,
          assignedAt: a.assignedAt,
        };
      })
    );

    return {
      module: mod.name,
      path,
      location: {
        label: location.label,
        type: location.type,
        disabled: location.disabled,
        disableReason: location.disableReason,
        overrides: location.overrides,
        childCount: location.children.length,
        children: location.children.map((c) => ({ label: c.label, type: c.type, disabled: c.disabled })),
      },
      inserts: inserts.map((i) => ({ id: i._id, name: i.name, footprint: i.footprint })),
      assignments: enriched,
      totalAssignments: enriched.length,
    };
  },

  async findUnassigned(_args, userId) {
    const uid = new Types.ObjectId(userId);
    const assignedItemIds = await assignmentRepository.findUnassignedItemIds(uid);
    const allItems = await itemRepository.search(uid);
    const assignedSet = new Set(assignedItemIds.map((id) => id.toString()));
    const unassigned = allItems.filter((item) => !assignedSet.has(item._id.toString()));

    return {
      items: unassigned.map((i) => ({ id: i._id, name: i.name, description: i.description })),
      totalUnassigned: unassigned.length,
    };
  },
};

// ── Handler registry ─────────────────────────────────────────────────

const handlerMap: Record<string, ToolHandler> = {
  'templates.create': templateHandlers.create,
  'templates.list': templateHandlers.list,
  'templates.get': templateHandlers.get,
  'templates.update': templateHandlers.update,
  'templates.delete': templateHandlers.delete,

  'modules.create': moduleHandlers.create,
  'modules.list': moduleHandlers.list,
  'modules.get': moduleHandlers.get,
  'modules.delete': moduleHandlers.delete,
  'modules.addDimensionValue': moduleHandlers.addDimensionValue,
  'modules.removeDimensionValue': moduleHandlers.removeDimensionValue,
  'modules.applyTemplate': moduleHandlers.applyTemplate,
  'modules.overrideLocation': moduleHandlers.overrideLocation,
  'modules.setLocationEnabled': moduleHandlers.setLocationEnabled,
  'modules.getModuleMap': moduleHandlers.getModuleMap,

  'inserts.create': insertHandlers.create,
  'inserts.list': insertHandlers.list,
  'inserts.place': insertHandlers.place,
  'inserts.remove': insertHandlers.remove,
  'inserts.relocate': insertHandlers.relocate,
  'inserts.delete': insertHandlers.delete,

  'items.create': itemHandlers.create,
  'items.find': itemHandlers.find,
  'items.get': itemHandlers.get,
  'items.update': itemHandlers.update,
  'items.delete': itemHandlers.delete,

  'assignments.assign': assignmentHandlers.assign,
  'assignments.unassign': assignmentHandlers.unassign,
  'assignments.move': assignmentHandlers.move,
  'assignments.findByItem': assignmentHandlers.findByItem,
  'assignments.inspectLocation': assignmentHandlers.inspectLocation,
  'assignments.findUnassigned': assignmentHandlers.findUnassigned,
};

export function getToolHandler(name: string): ToolHandler | undefined {
  return handlerMap[name];
}

/**
 * Execute a tool handler by name. Called by agentRunner.
 */
export async function executeHandler(
  handlerName: string,
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  const handler = handlerMap[handlerName];
  if (!handler) {
    console.error(`[handler] UNKNOWN: ${handlerName}`);
    return { error: `Unknown handler: ${handlerName}` };
  }
  const start = Date.now();
  try {
    const result = await handler(args, userId);
    const hasError = result && typeof result === 'object' && 'error' in result;
    console.log(`[handler] ${handlerName} ${hasError ? 'FAIL' : 'OK'} ${Date.now() - start}ms`);
    return result;
  } catch (err) {
    console.error(`[handler] ${handlerName} ERROR ${Date.now() - start}ms:`, err);
    throw err;
  }
}

export default handlerMap;
