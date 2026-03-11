import { describe, it, expect, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { getToolHandler } from '@/lib/toolHandlers';
import { moduleRepository } from '@/repositories/moduleRepository';
import { itemRepository } from '@/repositories/itemRepository';
import { assignmentRepository } from '@/repositories/assignmentRepository';
import { insertRepository } from '@/repositories/insertRepository';
import Assignment from '@/models/Assignment';

const userId = new Types.ObjectId().toString();
const uid = new Types.ObjectId(userId);

let mod: Awaited<ReturnType<typeof moduleRepository.create>>;
let item1: Awaited<ReturnType<typeof itemRepository.create>>;
let item2: Awaited<ReturnType<typeof itemRepository.create>>;

beforeEach(async () => {
  await Assignment.ensureIndexes();
  mod = await moduleRepository.create({
    name: 'MUSE',
    userId: uid,
    primaryDimension: {
      name: 'level',
      labeling: { type: 'numeric', startAt: 1 },
      values: [
        { label: '1', location: { label: '1', type: 'leaf' } },
        { label: '2', location: { label: '2', type: 'leaf' } },
        { label: '3', location: { label: '3', type: 'leaf' } },
      ],
    },
  });
  item1 = await itemRepository.create({ name: '10k resistor', userId: uid });
  item2 = await itemRepository.create({ name: 'M3 screw', userId: uid });
});

describe('Assignment tool handlers', () => {
  describe('assignments.assign', () => {
    it('assigns an item to a location', async () => {
      const handler = getToolHandler('assignments.assign')!;
      const result = (await handler({
        itemId: item1._id.toString(),
        moduleId: mod._id.toString(),
        locationPath: ['1'],
      }, userId)) as Record<string, unknown>;
      expect(result.assigned).toBe(true);
      expect(result.id).toBeDefined();
    });

    it('blocks double-assignment to same location', async () => {
      const handler = getToolHandler('assignments.assign')!;
      await handler({
        itemId: item1._id.toString(),
        moduleId: mod._id.toString(),
        locationPath: ['1'],
      }, userId);

      const result = (await handler({
        itemId: item2._id.toString(),
        moduleId: mod._id.toString(),
        locationPath: ['1'],
      }, userId)) as Record<string, unknown>;
      expect(result.error).toContain('already occupied');
    });

    it('allows same item at different locations', async () => {
      const handler = getToolHandler('assignments.assign')!;
      const r1 = (await handler({
        itemId: item1._id.toString(),
        moduleId: mod._id.toString(),
        locationPath: ['1'],
      }, userId)) as Record<string, unknown>;
      const r2 = (await handler({
        itemId: item1._id.toString(),
        moduleId: mod._id.toString(),
        locationPath: ['2'],
      }, userId)) as Record<string, unknown>;
      expect(r1.assigned).toBe(true);
      expect(r2.assigned).toBe(true);
    });

    it('assigns within an insert', async () => {
      const insert = await insertRepository.create({
        userId: uid, name: 'Bin', moduleId: mod._id, locationPath: ['1'],
      });

      const handler = getToolHandler('assignments.assign')!;
      const result = (await handler({
        itemId: item1._id.toString(),
        moduleId: mod._id.toString(),
        locationPath: ['1'],
        insertId: insert._id.toString(),
        insertLocationPath: ['A', '1'],
      }, userId)) as Record<string, unknown>;
      expect(result.assigned).toBe(true);
    });
  });

  describe('assignments.unassign', () => {
    it('removes an assignment', async () => {
      const assignment = await assignmentRepository.create({
        userId: uid, itemId: item1._id, moduleId: mod._id, locationPath: ['1'],
      });

      const handler = getToolHandler('assignments.unassign')!;
      const result = (await handler({ assignmentId: assignment._id.toString() }, userId)) as Record<string, unknown>;
      expect(result.deleted).toBe(true);
    });
  });

  describe('assignments.move', () => {
    it('moves an assignment to a new location', async () => {
      const assignment = await assignmentRepository.create({
        userId: uid, itemId: item1._id, moduleId: mod._id, locationPath: ['1'],
      });

      const handler = getToolHandler('assignments.move')!;
      const result = (await handler({
        assignmentId: assignment._id.toString(),
        newModuleId: mod._id.toString(),
        newLocationPath: ['2'],
      }, userId)) as Record<string, unknown>;
      expect(result.moved).toBe(true);
    });

    it('blocks move to occupied location', async () => {
      const a1 = await assignmentRepository.create({
        userId: uid, itemId: item1._id, moduleId: mod._id, locationPath: ['1'],
      });
      await assignmentRepository.create({
        userId: uid, itemId: item2._id, moduleId: mod._id, locationPath: ['2'],
      });

      const handler = getToolHandler('assignments.move')!;
      const result = (await handler({
        assignmentId: a1._id.toString(),
        newModuleId: mod._id.toString(),
        newLocationPath: ['2'],
      }, userId)) as Record<string, unknown>;
      expect(result.error).toContain('occupied');
    });
  });

  describe('assignments.findByItem', () => {
    it('finds all locations for an item', async () => {
      await assignmentRepository.create({ userId: uid, itemId: item1._id, moduleId: mod._id, locationPath: ['1'] });
      await assignmentRepository.create({ userId: uid, itemId: item1._id, moduleId: mod._id, locationPath: ['2'] });

      const handler = getToolHandler('assignments.findByItem')!;
      const result = (await handler({ itemId: item1._id.toString() }, userId)) as Record<string, unknown>;
      expect(result.totalLocations).toBe(2);
      expect((result.item as Record<string, unknown>).name).toBe('10k resistor');
    });

    it('returns empty for unassigned item', async () => {
      const handler = getToolHandler('assignments.findByItem')!;
      const result = (await handler({ itemId: item1._id.toString() }, userId)) as Record<string, unknown>;
      expect(result.totalLocations).toBe(0);
    });
  });

  describe('assignments.inspectLocation', () => {
    it('returns structure and assignments at a location', async () => {
      await assignmentRepository.create({
        userId: uid, itemId: item1._id, moduleId: mod._id, locationPath: ['1'],
      });

      const handler = getToolHandler('assignments.inspectLocation')!;
      const result = (await handler({
        moduleName: 'MUSE',
        path: ['1'],
      }, userId)) as Record<string, unknown>;
      expect(result.module).toBe('MUSE');
      expect((result.location as Record<string, unknown>).type).toBe('leaf');
      expect(result.totalAssignments).toBe(1);
      expect((result.assignments as Record<string, unknown>[])[0].itemName).toBe('10k resistor');
    });

    it('shows inserts at a location', async () => {
      await insertRepository.create({
        userId: uid, name: 'GF Bin', moduleId: mod._id, locationPath: ['1'],
      });

      const handler = getToolHandler('assignments.inspectLocation')!;
      const result = (await handler({
        moduleId: mod._id.toString(),
        path: ['1'],
      }, userId)) as Record<string, unknown>;
      expect((result.inserts as unknown[]).length).toBe(1);
    });

    it('returns error for invalid path', async () => {
      const handler = getToolHandler('assignments.inspectLocation')!;
      const result = (await handler({
        moduleName: 'MUSE',
        path: ['99'],
      }, userId)) as Record<string, unknown>;
      expect(result.error).toContain('not found');
    });
  });

  describe('assignments.findUnassigned', () => {
    it('finds items with no assignments', async () => {
      // item1 is assigned, item2 is not
      await assignmentRepository.create({
        userId: uid, itemId: item1._id, moduleId: mod._id, locationPath: ['1'],
      });

      const handler = getToolHandler('assignments.findUnassigned')!;
      const result = (await handler({}, userId)) as Record<string, unknown>;
      expect(result.totalUnassigned).toBe(1);
      expect((result.items as Record<string, unknown>[])[0].name).toBe('M3 screw');
    });

    it('returns all items when none are assigned', async () => {
      const handler = getToolHandler('assignments.findUnassigned')!;
      const result = (await handler({}, userId)) as Record<string, unknown>;
      expect(result.totalUnassigned).toBe(2);
    });
  });
});
