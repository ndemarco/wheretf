import { Types } from 'mongoose';
import { templateRepository } from '@/repositories/templateRepository';
import { moduleRepository, CreateModuleInput } from '@/repositories/moduleRepository';
import { insertRepository, CreateInsertInput } from '@/repositories/insertRepository';
import { itemRepository } from '@/repositories/itemRepository';
import { assignmentRepository } from '@/repositories/assignmentRepository';
import type { IOverride } from '@/models/Module';
import { auditLog } from './logger';

type ToolHandler = (args: Record<string, unknown>, userId: string) => Promise<unknown>;

// ── ID resolvers ────────────────────────────────────────────────────
// The AI often passes names instead of ObjectId hex strings. These helpers
// accept either form and resolve names via a DB lookup.

function isObjectId(value: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(value);
}

async function resolveTemplateId(nameOrId: string, userId: string): Promise<Types.ObjectId> {
  if (isObjectId(nameOrId)) return new Types.ObjectId(nameOrId);
  const results = await templateRepository.search(new Types.ObjectId(userId), { name: nameOrId });
  if (results.length === 0) throw new Error(`Template "${nameOrId}" not found`);
  return results[0]._id as Types.ObjectId;
}

async function resolveModuleId(nameOrId: string, userId: string): Promise<Types.ObjectId> {
  if (isObjectId(nameOrId)) return new Types.ObjectId(nameOrId);
  const results = await moduleRepository.search(new Types.ObjectId(userId), { name: nameOrId });
  if (results.length === 0) throw new Error(`Module "${nameOrId}" not found`);
  return results[0]._id as Types.ObjectId;
}

async function resolveItemId(nameOrId: string, userId: string): Promise<Types.ObjectId> {
  if (isObjectId(nameOrId)) return new Types.ObjectId(nameOrId);
  const results = await itemRepository.search(new Types.ObjectId(userId), { name: nameOrId });
  if (results.length === 0) throw new Error(`Item "${nameOrId}" not found`);
  return results[0]._id as Types.ObjectId;
}

async function resolveInsertId(nameOrId: string, userId: string): Promise<Types.ObjectId> {
  if (isObjectId(nameOrId)) return new Types.ObjectId(nameOrId);
  const results = await insertRepository.search(new Types.ObjectId(userId), { name: nameOrId });
  if (results.length === 0) throw new Error(`Insert "${nameOrId}" not found`);
  return results[0]._id as Types.ObjectId;
}

// ── Template handlers ────────────────────────────────────────────────

const templateHandlers: Record<string, ToolHandler> = {
  async create(args, userId) {
    const defaultRowLabeling = { type: 'alpha' as const };
    const defaultColLabeling = { type: 'numeric' as const, startAt: 1 };
    const template = await templateRepository.create({
      name: args.name as string,
      kind: args.kind as 'fixed' | 'parametric',
      userId: new Types.ObjectId(userId),
      description: args.description as string | undefined,
      rows: args.rows as number,
      cols: args.cols as number,
      rowLabeling: (args.rowLabeling as { type: 'numeric' | 'alpha' | 'custom'; prefix?: string; labels?: string[]; startAt?: number }) || defaultRowLabeling,
      colLabeling: (args.colLabeling as { type: 'numeric' | 'alpha' | 'custom'; prefix?: string; labels?: string[]; startAt?: number }) || defaultColLabeling,
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
    const id = (args.id || args.moduleId) as string | undefined;
    const name = (args.name || args.moduleName) as string | undefined;
    if (id) {
      const resolvedId = await resolveModuleId(id, userId);
      mod = await moduleRepository.findById(resolvedId.toString(), uid);
    } else if (name) {
      mod = await moduleRepository.findByName(name, uid);
    }
    if (!mod) return { error: 'Module not found' };
    return mod.toObject();
  },

  async delete(args, userId) {
    const uid = new Types.ObjectId(userId);
    const moduleId = (await resolveModuleId(args.id as string, userId)).toString();
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
    const moduleId = await resolveModuleId(args.moduleId as string, userId);
    const locationType = (args.locationType as string) || 'leaf';
    const mod = await moduleRepository.addPrimaryDimensionValue(
      moduleId.toString(),
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
    const moduleId = (await resolveModuleId(args.moduleId as string, userId)).toString();
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
    const templateId = await resolveTemplateId(args.templateId as string, userId);
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
    const moduleId = (await resolveModuleId(args.moduleId as string, userId)).toString();
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
    const moduleId = (await resolveModuleId(args.moduleId as string, userId)).toString();
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

function generateLabel(
  labeling: { type: 'numeric' | 'alpha' | 'custom'; prefix?: string; labels?: string[]; startAt?: number },
  index: number
): string {
  const prefix = labeling.prefix || '';
  switch (labeling.type) {
    case 'numeric':
      return `${prefix}${(labeling.startAt || 0) + index}`;
    case 'alpha':
      return `${prefix}${String.fromCharCode(65 + index)}`;
    case 'custom':
      return labeling.labels?.[index] || `${index}`;
    default:
      return `${index}`;
  }
}

function generateInsertLocations(
  rows: number,
  cols: number,
  rowLabeling: { type: 'numeric' | 'alpha' | 'custom'; prefix?: string; labels?: string[]; startAt?: number },
  colLabeling: { type: 'numeric' | 'alpha' | 'custom'; prefix?: string; labels?: string[]; startAt?: number },
) {
  const locations = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rowLabel = generateLabel(rowLabeling, r);
      const colLabel = generateLabel(colLabeling, c);
      locations.push({ label: `${rowLabel},${colLabel}`, disabled: false, children: [] });
    }
  }
  return locations;
}

const insertHandlers: Record<string, ToolHandler> = {
  async create(args, userId) {
    const resolvedTemplateId = args.templateId ? await resolveTemplateId(args.templateId as string, userId) : undefined;

    // Generate locations from template or structural definition
    let locations;
    let footprint = args.footprint as { rows: number; cols: number } | undefined;
    if (resolvedTemplateId) {
      const template = await templateRepository.findById(resolvedTemplateId, new Types.ObjectId(userId));
      if (template) {
        locations = generateInsertLocations(template.rows, template.cols, template.rowLabeling, template.colLabeling);
        if (!footprint) footprint = { rows: 1, cols: 1 };
      }
    } else if (args.structuralDefinition) {
      const sd = args.structuralDefinition as CreateInsertInput['structuralDefinition'];
      if (sd) {
        locations = generateInsertLocations(sd.rows, sd.cols, sd.rowLabeling, sd.colLabeling);
      }
    }

    const insert = await insertRepository.create({
      name: args.name as string | undefined,
      userId: new Types.ObjectId(userId),
      templateId: resolvedTemplateId,
      structuralDefinition: args.structuralDefinition as CreateInsertInput['structuralDefinition'],
      footprint,
      interfaceTypeProvided: args.interfaceTypeProvided as string | undefined,
      locations,
      metadata: args.metadata as Record<string, unknown> | undefined,
    });

    // Verify
    const verified = await insertRepository.findById(insert._id, new Types.ObjectId(userId));
    const locCount = verified?.locations?.length || 0;
    auditLog.mutation('inserts.create', 'create', 'insert', insert._id.toString(), args,
      { id: insert._id, name: insert.name, locations: locCount }, !!verified, 0);
    return { id: insert._id, name: insert.name, locations: locCount, verified: !!verified };
  },

  async list(args, userId) {
    const resolvedTemplateId = args.templateId ? await resolveTemplateId(args.templateId as string, userId) : undefined;
    const resolvedModuleId = args.moduleId ? await resolveModuleId(args.moduleId as string, userId) : undefined;
    const inserts = await insertRepository.search(new Types.ObjectId(userId), {
      name: args.name as string | undefined,
      templateId: resolvedTemplateId,
      moduleId: resolvedModuleId,
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
    const moduleId = await resolveModuleId(args.moduleId as string, userId);
    const insert = await insertRepository.place(
      args.insertId as string,
      uid,
      moduleId,
      args.locationPath as string[]
    );
    if (!insert) return { error: 'Insert not found' };

    // Verify placement persisted
    const verified = await insertRepository.findById(insert._id, uid);
    const ok = verified?.moduleId?.toString() === moduleId.toString();
    auditLog.mutation('inserts.place', 'place', 'insert', insert._id.toString(), args,
      { moduleId: insert.moduleId, locationPath: insert.locationPath }, ok, 0);
    return { id: insert._id, name: insert.name, moduleId: insert.moduleId, locationPath: insert.locationPath, placed: true, verified: ok };
  },

  async update(args, userId) {
    const uid = new Types.ObjectId(userId);
    const insertId = await resolveInsertId(args.insertId as string, userId);
    const updates: { name?: string; metadata?: Map<string, unknown> } = {};
    if (args.name !== undefined) updates.name = args.name as string;
    if (args.metadata !== undefined) updates.metadata = new Map(Object.entries(args.metadata as Record<string, unknown>));
    const insert = await insertRepository.update(insertId, uid, updates);
    if (!insert) return { error: 'Insert not found' };
    return { id: insert._id, name: insert.name, updated: true };
  },

  async remove(args, userId) {
    const uid = new Types.ObjectId(userId);
    const insert = await insertRepository.unplace(args.insertId as string, uid);
    if (!insert) return { error: 'Insert not found' };
    return { id: insert._id, name: insert.name, unplaced: true };
  },

  async relocate(args, userId) {
    const uid = new Types.ObjectId(userId);
    const newModuleId = await resolveModuleId(args.newModuleId as string, userId);
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

  /**
   * Atomic merge: keep one item, reassign all assignments from duplicates to keeper, delete duplicates.
   */
  async merge(args, userId) {
    const uid = new Types.ObjectId(userId);
    const keeperId = args.keeperId as string;
    const duplicateIds = args.duplicateIds as string[];

    if (!keeperId || !duplicateIds || duplicateIds.length === 0) {
      return { error: 'Must provide keeperId and at least one duplicateId' };
    }

    if (duplicateIds.includes(keeperId)) {
      return { error: 'keeperId must not appear in duplicateIds' };
    }

    // Verify keeper exists
    const keeper = await itemRepository.findById(keeperId, uid);
    if (!keeper) return { error: `Keeper item ${keeperId} not found` };

    // Optionally update keeper name/description/parameters
    if (args.keeperName || args.keeperDescription || args.keeperParameters) {
      const updates: Record<string, unknown> = {};
      if (args.keeperName) updates.name = args.keeperName;
      if (args.keeperDescription) updates.description = args.keeperDescription;
      if (args.keeperParameters) updates.parameters = args.keeperParameters;
      await itemRepository.update(keeperId, uid, updates);
    }

    let reassigned = 0;
    let deleted = 0;

    for (const dupId of duplicateIds) {
      // Find all assignments for this duplicate
      const assignments = await assignmentRepository.findByItem(uid, dupId);

      // Reassign each to the keeper by re-creating at same location
      for (const assignment of assignments) {
        // Check if keeper already has an assignment at this exact location
        const occupied = await assignmentRepository.isLocationOccupied(
          uid,
          assignment.moduleId.toString(),
          assignment.locationPath,
          assignment.insertId,
          assignment.insertLocationPath,
        );
        if (!occupied) {
          await assignmentRepository.create({
            userId: uid,
            itemId: new Types.ObjectId(keeperId),
            moduleId: assignment.moduleId,
            locationPath: assignment.locationPath,
            insertId: assignment.insertId,
            insertLocationPath: assignment.insertLocationPath,
          });
          reassigned++;
        }
        // Remove the old assignment pointing to the duplicate
        await assignmentRepository.remove(assignment._id, uid);
      }

      // Delete the duplicate item
      const ok = await itemRepository.remove(dupId, uid);
      if (ok) deleted++;
    }

    return {
      keeperId,
      keeperName: keeper.name,
      duplicatesDeleted: deleted,
      assignmentsReassigned: reassigned,
    };
  },
};

// ── Assignment handlers ──────────────────────────────────────────────

// Normalize cell references: "A2" → "A,2", "B13" → "B,13"
// Leaves already-comma-separated labels like "A,2" untouched.
function normalizeCellPath(path: string[] | undefined): string[] | undefined {
  if (!path) return undefined;
  return path.map((segment) => {
    if (segment.includes(',')) return segment;
    const match = segment.match(/^([A-Za-z]+)(\d+)$/);
    if (match) return `${match[1]},${match[2]}`;
    return segment;
  });
}

const assignmentHandlers: Record<string, ToolHandler> = {
  async assign(args, userId) {
    const uid = new Types.ObjectId(userId);
    const itemId = await resolveItemId(args.itemId as string, userId);
    const moduleId = await resolveModuleId(args.moduleId as string, userId);
    const insertId = args.insertId ? await resolveInsertId(args.insertId as string, userId) : undefined;
    const insertLocationPath = normalizeCellPath(args.insertLocationPath as string[] | undefined);

    const occupied = await assignmentRepository.isLocationOccupied(
      uid,
      moduleId.toString(),
      args.locationPath as string[],
      insertId,
      insertLocationPath
    );
    if (occupied) {
      return { error: 'Location is already occupied by another assignment' };
    }

    const assignment = await assignmentRepository.create({
      userId: uid,
      itemId,
      moduleId,
      locationPath: args.locationPath as string[],
      insertId,
      insertLocationPath,
    });

    // Verify the assignment persisted
    const verified = await assignmentRepository.findById(assignment._id, uid);
    const ok = !!verified;
    auditLog.mutation('assignments.assign', 'assign', 'assignment', assignment._id.toString(), args, { id: assignment._id }, ok, 0);
    if (!ok) return { error: 'Assignment was created but could not be verified. Data may be inconsistent.' };
    return { id: assignment._id, assigned: true, verified: true };
  },

  async unassign(args, userId) {
    const uid = new Types.ObjectId(userId);
    const deleted = await assignmentRepository.remove(args.assignmentId as string, uid);
    return { deleted };
  },

  async move(args, userId) {
    const uid = new Types.ObjectId(userId);
    const newModuleId = await resolveModuleId(args.newModuleId as string, userId);
    const newInsertId = args.newInsertId ? await resolveInsertId(args.newInsertId as string, userId) : undefined;
    const newLocation = {
      moduleId: newModuleId,
      locationPath: args.newLocationPath as string[],
      insertId: newInsertId,
      insertLocationPath: normalizeCellPath(args.newInsertLocationPath as string[] | undefined),
    };

    const occupied = await assignmentRepository.isLocationOccupied(
      uid,
      newModuleId.toString(),
      args.newLocationPath as string[],
      newInsertId,
      newLocation.insertLocationPath
    );
    if (occupied) {
      return { error: 'Destination location is already occupied' };
    }

    const assignment = await assignmentRepository.reassign(args.assignmentId as string, uid, newLocation);
    if (!assignment) return { error: 'Assignment not found' };

    // Verify the move persisted with correct location
    const verified = await assignmentRepository.findById(assignment._id, uid);
    const correctLocation = verified &&
      (verified.insertLocationPath?.join(',') ?? '') === (newLocation.insertLocationPath?.join(',') ?? '') &&
      verified.locationPath.join(',') === newLocation.locationPath.join(',');
    auditLog.mutation('assignments.move', 'move', 'assignment', assignment._id.toString(), args,
      { newLocationPath: newLocation.locationPath, newInsertLocationPath: newLocation.insertLocationPath }, !!correctLocation, 0);
    if (!correctLocation) return { error: 'Move executed but verification failed. Location may not have updated.' };
    return { id: assignment._id, moved: true, verified: true };
  },

  async findByItem(args, userId) {
    const uid = new Types.ObjectId(userId);
    const itemId = await resolveItemId(args.itemId as string, userId);
    const assignments = await assignmentRepository.findByItem(uid, itemId.toString());
    const item = await itemRepository.findById(itemId.toString(), uid);

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
      const resolvedId = await resolveModuleId(args.moduleId as string, userId);
      mod = await moduleRepository.findById(resolvedId.toString(), uid);
    } else if (args.moduleName) {
      mod = await moduleRepository.findByName(args.moduleName as string, uid);
    }
    if (!mod) return { error: 'Module not found' };

    // Resolve module path — try progressively shorter paths if the full path
    // doesn't resolve (the AI often includes insert-internal segments like "A1"
    // in the module path). The leftover segments become the insert path.
    let fullPath = args.path as string[];
    let path = fullPath;
    let autoInsertPath: string[] = [];
    let location = moduleRepository.resolveLocation(mod, path);

    if (!location && path.length > 1) {
      // Try with just the first segment — everything else is likely insert-internal
      const modulePath = path.slice(0, 1);
      location = moduleRepository.resolveLocation(mod, modulePath);
      if (location) {
        autoInsertPath = path.slice(1);
        path = modulePath;
      }
    }

    if (!location) return { error: `Location not found at path: ${fullPath.join(' / ')}` };

    const assignments = await assignmentRepository.findByLocationPrefix(uid, mod._id, path);
    const inserts = await insertRepository.findByModuleLocation(uid, mod._id, path);

    // Determine insert context — explicit params, or auto-detected from path overflow
    const insertName = args.insertName as string | undefined;
    const insertId = args.insertId as string | undefined;
    let insertPath = normalizeCellPath((args.insertPath as string[] | undefined) || (autoInsertPath.length > 0 ? autoInsertPath : undefined));

    if (insertName || insertId || autoInsertPath.length > 0) {
      let targetInsert;
      if (insertId) {
        const resolvedInsertId = await resolveInsertId(insertId, userId);
        targetInsert = inserts.find((i) => i._id.toString() === resolvedInsertId.toString());
      } else if (insertName) {
        const name = insertName.toLowerCase();
        targetInsert = inserts.find((i) => i.name?.toLowerCase() === name);
      } else if (inserts.length === 1) {
        // Auto-detect: only one insert at this location, assume that's the target
        targetInsert = inserts[0];
      } else if (inserts.length > 1 && autoInsertPath.length > 0) {
        // Multiple inserts — try to match by checking which insert has a location matching the autoInsertPath
        for (const ins of inserts) {
          if (ins.locations?.some((l) => l.label === autoInsertPath[0] || l.label === autoInsertPath.join(','))) {
            targetInsert = ins;
            break;
          }
        }
        if (!targetInsert) {
          return {
            module: mod.name,
            path,
            error: `Multiple inserts at this location. Specify which one: ${inserts.map((i) => i.name || i._id).join(', ')}`,
            inserts: inserts.map((i) => ({ id: i._id, name: i.name })),
          };
        }
      }

      if (!targetInsert) {
        if (inserts.length === 0) {
          return { error: `No inserts found at ${mod.name} ${path.join(' / ')}` };
        }
        return { error: `Insert not found at this location. Available: ${inserts.map((i) => i.name || i._id).join(', ')}` };
      }

      // Filter assignments to this insert
      const insertAssignments = assignments.filter(
        (a) => a.insertId?.toString() === targetInsert._id.toString()
      );

      const enriched = await Promise.all(
        insertAssignments.map(async (a) => {
          const item = await itemRepository.findById(a.itemId, uid);
          return {
            id: a._id,
            itemId: a.itemId,
            itemName: item?.name || 'Unknown',
            locationPath: a.locationPath,
            insertLocationPath: a.insertLocationPath,
            assignedAt: a.assignedAt,
          };
        })
      );

      // If a specific cell within the insert was requested
      if (insertPath && insertPath.length > 0) {
        const cellAssignments = enriched.filter((a) =>
          a.insertLocationPath && a.insertLocationPath.length === insertPath.length &&
          a.insertLocationPath.every((p, i) => p === insertPath[i])
        );
        return {
          module: mod.name,
          path,
          insert: { id: targetInsert._id, name: targetInsert.name },
          insertPath,
          assignments: cellAssignments,
          totalAssignments: cellAssignments.length,
        };
      }

      return {
        module: mod.name,
        path,
        insert: { id: targetInsert._id, name: targetInsert.name, footprint: targetInsert.footprint },
        locations: targetInsert.locations?.map((l) => l.label) || [],
        assignments: enriched,
        totalAssignments: enriched.length,
      };
    }

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
  'inserts.update': insertHandlers.update,
  'inserts.place': insertHandlers.place,
  'inserts.remove': insertHandlers.remove,
  'inserts.relocate': insertHandlers.relocate,
  'inserts.delete': insertHandlers.delete,

  'items.create': itemHandlers.create,
  'items.find': itemHandlers.find,
  'items.get': itemHandlers.get,
  'items.update': itemHandlers.update,
  'items.delete': itemHandlers.delete,
  'items.merge': itemHandlers.merge,

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
