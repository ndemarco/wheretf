import { describe, it, expect, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { getToolHandler } from '@/lib/toolHandlers';
import { moduleRepository } from '@/repositories/moduleRepository';
import { templateRepository } from '@/repositories/templateRepository';
import { assignmentRepository } from '@/repositories/assignmentRepository';
import { insertRepository } from '@/repositories/insertRepository';
import { itemRepository } from '@/repositories/itemRepository';

const userId = new Types.ObjectId().toString();
const uid = new Types.ObjectId(userId);

async function createTestModule(name = 'MUSE') {
  return moduleRepository.create({
    name,
    userId: uid,
    primaryDimension: {
      name: 'level',
      labeling: { type: 'numeric', startAt: 1 },
      values: [
        { label: '1', location: { label: '1', type: 'leaf' } },
        { label: '2', location: { label: '2', type: 'leaf' } },
        { label: '3', location: { label: '3', type: 'receptacle', interfaceTypeAccepted: 'gridfinity-42mm' } },
      ],
    },
  });
}

describe('Module tool handlers', () => {
  describe('modules.create', () => {
    it('creates a module and returns summary', async () => {
      const handler = getToolHandler('modules.create')!;
      const result = (await handler({
        name: 'MUSE',
        primaryDimension: {
          name: 'level',
          labeling: { type: 'numeric', startAt: 1 },
          values: [
            { label: '1', location: { label: '1', type: 'leaf' } },
            { label: '2', location: { label: '2', type: 'leaf' } },
          ],
        },
      }, userId)) as Record<string, unknown>;
      expect(result.id).toBeDefined();
      expect(result.name).toBe('MUSE');
      expect(result.primaryDimension).toBe('level');
      expect(result.values).toEqual(['1', '2']);
    });
  });

  describe('modules.list', () => {
    beforeEach(async () => {
      await createTestModule('MUSE');
      await createTestModule('ALEX');
    });

    it('lists all modules', async () => {
      const handler = getToolHandler('modules.list')!;
      const result = (await handler({}, userId)) as unknown[];
      expect(result).toHaveLength(2);
    });

    it('filters by name', async () => {
      const handler = getToolHandler('modules.list')!;
      const result = (await handler({ name: 'MUSE' }, userId)) as unknown[];
      expect(result).toHaveLength(1);
    });
  });

  describe('modules.get', () => {
    it('gets by name', async () => {
      await createTestModule();
      const handler = getToolHandler('modules.get')!;
      const result = (await handler({ name: 'MUSE' }, userId)) as Record<string, unknown>;
      expect(result.name).toBe('MUSE');
    });

    it('returns error for missing module', async () => {
      const handler = getToolHandler('modules.get')!;
      const result = (await handler({ name: 'MISSING' }, userId)) as Record<string, unknown>;
      expect(result.error).toBeDefined();
    });
  });

  describe('modules.delete', () => {
    it('deletes an empty module', async () => {
      const mod = await createTestModule();
      const handler = getToolHandler('modules.delete')!;
      const result = (await handler({ id: mod._id.toString() }, userId)) as Record<string, unknown>;
      expect(result.deleted).toBe(true);
    });

    it('blocks deletion with existing assignments', async () => {
      const mod = await createTestModule();
      const item = await itemRepository.create({ name: 'Test Item', userId: uid });
      await assignmentRepository.create({
        userId: uid, itemId: item._id, moduleId: mod._id, locationPath: ['1'],
      });

      const handler = getToolHandler('modules.delete')!;
      const result = (await handler({ id: mod._id.toString() }, userId)) as Record<string, unknown>;
      expect(result.error).toContain('existing data');
      expect(result.assignmentCount).toBe(1);
    });

    it('force deletes with existing assignments and inserts', async () => {
      const mod = await createTestModule();
      const item = await itemRepository.create({ name: 'Test Item', userId: uid });
      await assignmentRepository.create({
        userId: uid, itemId: item._id, moduleId: mod._id, locationPath: ['1'],
      });
      await insertRepository.create({
        userId: uid, name: 'Test Insert', moduleId: mod._id, locationPath: ['3'],
      });

      const handler = getToolHandler('modules.delete')!;
      const result = (await handler({ id: mod._id.toString(), force: true }, userId)) as Record<string, unknown>;
      expect(result.deleted).toBe(true);

      // Verify cleanup
      const assignments = await assignmentRepository.findByModule(uid, mod._id);
      expect(assignments).toHaveLength(0);
    });
  });

  describe('modules.addDimensionValue', () => {
    it('adds a new value', async () => {
      const mod = await createTestModule();
      const handler = getToolHandler('modules.addDimensionValue')!;
      const result = (await handler({ moduleId: mod._id.toString(), label: '4' }, userId)) as Record<string, unknown>;
      expect(result.values).toContain('4');
      expect((result.values as string[]).length).toBe(4);
    });

    it('adds with specific location type', async () => {
      const mod = await createTestModule();
      const handler = getToolHandler('modules.addDimensionValue')!;
      const result = (await handler({
        moduleId: mod._id.toString(),
        label: '4',
        locationType: 'receptacle',
        interfaceTypeAccepted: 'gridfinity-42mm',
      }, userId)) as Record<string, unknown>;
      expect(result.values).toContain('4');
    });
  });

  describe('modules.removeDimensionValue', () => {
    it('removes an empty value', async () => {
      const mod = await createTestModule();
      const handler = getToolHandler('modules.removeDimensionValue')!;
      const result = (await handler({ moduleId: mod._id.toString(), label: '2' }, userId)) as Record<string, unknown>;
      expect(result.values).not.toContain('2');
    });

    it('blocks removal with existing assignments', async () => {
      const mod = await createTestModule();
      const item = await itemRepository.create({ name: 'Test', userId: uid });
      await assignmentRepository.create({
        userId: uid, itemId: item._id, moduleId: mod._id, locationPath: ['2'],
      });

      const handler = getToolHandler('modules.removeDimensionValue')!;
      const result = (await handler({ moduleId: mod._id.toString(), label: '2' }, userId)) as Record<string, unknown>;
      expect(result.error).toContain('assignments exist');
    });

    it('force removes with assignments', async () => {
      const mod = await createTestModule();
      const item = await itemRepository.create({ name: 'Test', userId: uid });
      await assignmentRepository.create({
        userId: uid, itemId: item._id, moduleId: mod._id, locationPath: ['2'],
      });

      const handler = getToolHandler('modules.removeDimensionValue')!;
      const result = (await handler({ moduleId: mod._id.toString(), label: '2', force: true }, userId)) as Record<string, unknown>;
      expect(result.values).not.toContain('2');
    });
  });

  describe('modules.applyTemplate', () => {
    it('applies a template to a location', async () => {
      const template = await templateRepository.create({
        name: 'test-grid', kind: 'fixed', userId: uid, rows: 3, cols: 4,
        rowLabeling: { type: 'numeric', startAt: 1 }, colLabeling: { type: 'alpha' },
      });
      const mod = await createTestModule();

      const handler = getToolHandler('modules.applyTemplate')!;
      const result = (await handler({
        moduleId: mod._id.toString(),
        path: ['1'],
        templateId: template._id.toString(),
      }, userId)) as Record<string, unknown>;
      expect(result.applied).toBe(true);
      expect(result.rows).toBe(3);
      expect(result.cols).toBe(4);
    });
  });

  describe('modules.setLocationEnabled', () => {
    it('disables a location', async () => {
      const mod = await createTestModule();
      const handler = getToolHandler('modules.setLocationEnabled')!;
      const result = (await handler({
        moduleId: mod._id.toString(),
        path: ['1'],
        enabled: false,
        reason: 'Broken shelf',
      }, userId)) as Record<string, unknown>;
      expect(result.enabled).toBe(false);
    });

    it('re-enables a disabled location', async () => {
      const mod = await createTestModule();
      await moduleRepository.disableLocation(mod._id, uid, ['1'], 'Broken');

      const handler = getToolHandler('modules.setLocationEnabled')!;
      const result = (await handler({
        moduleId: mod._id.toString(),
        path: ['1'],
        enabled: true,
      }, userId)) as Record<string, unknown>;
      expect(result.enabled).toBe(true);
    });
  });

  describe('modules.getModuleMap', () => {
    it('returns all leaf paths', async () => {
      const mod = await createTestModule();
      const handler = getToolHandler('modules.getModuleMap')!;
      const result = (await handler({ moduleName: 'MUSE' }, userId)) as Record<string, unknown>;
      expect(result.name).toBe('MUSE');
      expect(result.totalLocations).toBe(3);
      expect(result.leafPaths).toHaveLength(3);
    });

    it('returns error for missing module', async () => {
      const handler = getToolHandler('modules.getModuleMap')!;
      const result = (await handler({ moduleName: 'MISSING' }, userId)) as Record<string, unknown>;
      expect(result.error).toBeDefined();
    });
  });
});
