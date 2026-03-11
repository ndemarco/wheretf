import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { getToolHandler } from '@/lib/toolHandlers';
import { moduleRepository } from '@/repositories/moduleRepository';
import { insertRepository } from '@/repositories/insertRepository';
import { assignmentRepository } from '@/repositories/assignmentRepository';
import { itemRepository } from '@/repositories/itemRepository';

const userId = new Types.ObjectId().toString();
const uid = new Types.ObjectId(userId);

async function createTestModule() {
  return moduleRepository.create({
    name: 'MUSE',
    userId: uid,
    primaryDimension: {
      name: 'level',
      labeling: { type: 'numeric', startAt: 1 },
      values: [
        { label: '1', location: { label: '1', type: 'receptacle', interfaceTypeAccepted: 'gridfinity-42mm' } },
        { label: '2', location: { label: '2', type: 'receptacle', interfaceTypeAccepted: 'gridfinity-42mm' } },
      ],
    },
  });
}

describe('Insert tool handlers', () => {
  describe('inserts.create', () => {
    it('creates an insert with name', async () => {
      const handler = getToolHandler('inserts.create')!;
      const result = (await handler({
        name: 'GF Bin #1',
        interfaceTypeProvided: 'gridfinity-42mm',
        footprint: { rows: 1, cols: 2 },
      }, userId)) as Record<string, unknown>;
      expect(result.id).toBeDefined();
      expect(result.name).toBe('GF Bin #1');
    });

    it('creates an insert with structural definition', async () => {
      const handler = getToolHandler('inserts.create')!;
      const result = (await handler({
        name: 'Custom Divider',
        structuralDefinition: {
          rows: 2, cols: 3,
          rowLabeling: { type: 'numeric', startAt: 1 },
          colLabeling: { type: 'alpha' },
        },
      }, userId)) as Record<string, unknown>;
      expect(result.id).toBeDefined();
    });
  });

  describe('inserts.list', () => {
    it('lists all inserts', async () => {
      await insertRepository.create({ userId: uid, name: 'Insert A' });
      await insertRepository.create({ userId: uid, name: 'Insert B' });

      const handler = getToolHandler('inserts.list')!;
      const result = (await handler({}, userId)) as unknown[];
      expect(result).toHaveLength(2);
    });

    it('filters by name', async () => {
      await insertRepository.create({ userId: uid, name: 'Plano #1' });
      await insertRepository.create({ userId: uid, name: 'GF Bin #1' });

      const handler = getToolHandler('inserts.list')!;
      const result = (await handler({ name: 'Plano' }, userId)) as unknown[];
      expect(result).toHaveLength(1);
    });

    it('filters for unassigned inserts', async () => {
      const mod = await createTestModule();
      await insertRepository.create({ userId: uid, name: 'Placed', moduleId: mod._id, locationPath: ['1'] });
      await insertRepository.create({ userId: uid, name: 'Unplaced' });

      const handler = getToolHandler('inserts.list')!;
      const result = (await handler({ unassigned: true }, userId)) as Record<string, unknown>[];
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Unplaced');
    });
  });

  describe('inserts.place', () => {
    it('places an insert at a module location', async () => {
      const mod = await createTestModule();
      const insert = await insertRepository.create({ userId: uid, name: 'GF Bin' });

      const handler = getToolHandler('inserts.place')!;
      const result = (await handler({
        insertId: insert._id.toString(),
        moduleId: mod._id.toString(),
        locationPath: ['1'],
      }, userId)) as Record<string, unknown>;
      expect(result.placed).toBe(true);
      expect(result.locationPath).toEqual(['1']);
    });
  });

  describe('inserts.remove (unplace)', () => {
    it('removes an insert from its location', async () => {
      const mod = await createTestModule();
      const insert = await insertRepository.create({
        userId: uid, name: 'GF Bin', moduleId: mod._id, locationPath: ['1'],
      });

      const handler = getToolHandler('inserts.remove')!;
      const result = (await handler({ insertId: insert._id.toString() }, userId)) as Record<string, unknown>;
      expect(result.unplaced).toBe(true);
    });
  });

  describe('inserts.relocate', () => {
    it('relocates an insert and reassigns its assignments', async () => {
      const mod = await createTestModule();
      const insert = await insertRepository.create({
        userId: uid, name: 'GF Bin', moduleId: mod._id, locationPath: ['1'],
      });
      const item = await itemRepository.create({ name: 'Resistor', userId: uid });
      await assignmentRepository.create({
        userId: uid, itemId: item._id, moduleId: mod._id, locationPath: ['1'],
        insertId: insert._id, insertLocationPath: ['A'],
      });

      const handler = getToolHandler('inserts.relocate')!;
      const result = (await handler({
        insertId: insert._id.toString(),
        newModuleId: mod._id.toString(),
        newLocationPath: ['2'],
      }, userId)) as Record<string, unknown>;
      expect(result.locationPath).toEqual(['2']);
      expect(result.reassignedCount).toBe(1);
    });
  });

  describe('inserts.delete', () => {
    it('deletes an insert without assignments', async () => {
      const insert = await insertRepository.create({ userId: uid, name: 'Empty' });
      const handler = getToolHandler('inserts.delete')!;
      const result = (await handler({ insertId: insert._id.toString() }, userId)) as Record<string, unknown>;
      expect(result.deleted).toBe(true);
    });

    it('blocks deletion with assignments', async () => {
      const mod = await createTestModule();
      const insert = await insertRepository.create({
        userId: uid, name: 'Full', moduleId: mod._id, locationPath: ['1'],
      });
      const item = await itemRepository.create({ name: 'Stuff', userId: uid });
      await assignmentRepository.create({
        userId: uid, itemId: item._id, moduleId: mod._id, locationPath: ['1'],
        insertId: insert._id, insertLocationPath: ['A'],
      });

      const handler = getToolHandler('inserts.delete')!;
      const result = (await handler({ insertId: insert._id.toString() }, userId)) as Record<string, unknown>;
      expect(result.error).toContain('assignments');
    });

    it('force deletes with assignments', async () => {
      const mod = await createTestModule();
      const insert = await insertRepository.create({
        userId: uid, name: 'Full', moduleId: mod._id, locationPath: ['1'],
      });
      const item = await itemRepository.create({ name: 'Stuff', userId: uid });
      await assignmentRepository.create({
        userId: uid, itemId: item._id, moduleId: mod._id, locationPath: ['1'],
        insertId: insert._id, insertLocationPath: ['A'],
      });

      const handler = getToolHandler('inserts.delete')!;
      const result = (await handler({ insertId: insert._id.toString(), force: true }, userId)) as Record<string, unknown>;
      expect(result.deleted).toBe(true);
    });
  });
});
