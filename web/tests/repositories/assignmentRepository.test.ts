import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import mongoose from 'mongoose';
import Assignment from '@/models/v2/Assignment';
import { assignmentRepository } from '@/repositories/v2/assignmentRepository';

const userId = new mongoose.Types.ObjectId();
const moduleId = new mongoose.Types.ObjectId();
const itemId1 = new mongoose.Types.ObjectId();
const itemId2 = new mongoose.Types.ObjectId();
const itemId3 = new mongoose.Types.ObjectId();
const insertId = new mongoose.Types.ObjectId();

describe('assignmentRepository', () => {
  beforeAll(async () => {
    await Assignment.ensureIndexes();
  });

  describe('create', () => {
    it('creates a module-level assignment', async () => {
      const assignment = await assignmentRepository.create({
        userId,
        itemId: itemId1,
        moduleId,
        locationPath: ['3', '2,5'],
      });
      expect(assignment._id).toBeDefined();
      expect(assignment.itemId.toString()).toBe(itemId1.toString());
      expect(assignment.locationPath).toEqual(['3', '2,5']);
      expect(assignment.assignedAt).toBeInstanceOf(Date);
    });

    it('creates an insert-level assignment', async () => {
      const assignment = await assignmentRepository.create({
        userId,
        itemId: itemId1,
        moduleId,
        locationPath: ['3'],
        insertId,
        insertLocationPath: ['1,1'],
      });
      expect(assignment.insertId?.toString()).toBe(insertId.toString());
      expect(assignment.insertLocationPath).toEqual(['1,1']);
    });

    it('enforces one assignment per location (unique index)', async () => {
      await assignmentRepository.create({
        userId,
        itemId: itemId1,
        moduleId,
        locationPath: ['1'],
      });
      await expect(
        assignmentRepository.create({
          userId,
          itemId: itemId2,
          moduleId,
          locationPath: ['1'],
        })
      ).rejects.toThrow();
    });

    it('allows same item at different locations', async () => {
      await assignmentRepository.create({
        userId,
        itemId: itemId1,
        moduleId,
        locationPath: ['1'],
      });
      const a2 = await assignmentRepository.create({
        userId,
        itemId: itemId1,
        moduleId,
        locationPath: ['2'],
      });
      expect(a2.itemId.toString()).toBe(itemId1.toString());
    });
  });

  describe('queries', () => {
    beforeEach(async () => {
      // resistors at MUSE level 3, cell 2,5
      await assignmentRepository.create({
        userId,
        itemId: itemId1,
        moduleId,
        locationPath: ['3', '2,5'],
      });
      // resistors at MUSE level 5, cell 1,1
      await assignmentRepository.create({
        userId,
        itemId: itemId1,
        moduleId,
        locationPath: ['5', '1,1'],
      });
      // screws at MUSE level 3, cell 2,6
      await assignmentRepository.create({
        userId,
        itemId: itemId2,
        moduleId,
        locationPath: ['3', '2,6'],
      });
      // glue at MUSE level 10
      await assignmentRepository.create({
        userId,
        itemId: itemId3,
        moduleId,
        locationPath: ['10'],
      });
    });

    it('finds assignment at exact location', async () => {
      const found = await assignmentRepository.findAtLocation(userId, moduleId, ['3', '2,5']);
      expect(found).not.toBeNull();
      expect(found!.itemId.toString()).toBe(itemId1.toString());
    });

    it('returns null for empty location', async () => {
      const found = await assignmentRepository.findAtLocation(userId, moduleId, ['3', '4,4']);
      expect(found).toBeNull();
    });

    it('finds all assignments for an item', async () => {
      const found = await assignmentRepository.findByItem(userId, itemId1);
      expect(found).toHaveLength(2);
    });

    it('finds all assignments in a module', async () => {
      const found = await assignmentRepository.findByModule(userId, moduleId);
      expect(found).toHaveLength(4);
    });

    it('finds assignments by location prefix', async () => {
      const found = await assignmentRepository.findByLocationPrefix(userId, moduleId, ['3']);
      expect(found).toHaveLength(2); // 3/2,5 and 3/2,6
    });

    it('checks if location is occupied', async () => {
      expect(await assignmentRepository.isLocationOccupied(userId, moduleId, ['3', '2,5'])).toBe(true);
      expect(await assignmentRepository.isLocationOccupied(userId, moduleId, ['3', '4,4'])).toBe(false);
    });

    it('scopes to user', async () => {
      const otherUser = new mongoose.Types.ObjectId();
      const found = await assignmentRepository.findByModule(otherUser, moduleId);
      expect(found).toHaveLength(0);
    });
  });

  describe('insert-level queries', () => {
    beforeEach(async () => {
      await assignmentRepository.create({
        userId,
        itemId: itemId1,
        moduleId,
        locationPath: ['3'],
        insertId,
        insertLocationPath: ['1,1'],
      });
      await assignmentRepository.create({
        userId,
        itemId: itemId2,
        moduleId,
        locationPath: ['3'],
        insertId,
        insertLocationPath: ['1,2'],
      });
    });

    it('finds assignments within an insert', async () => {
      const found = await assignmentRepository.findByInsert(userId, insertId);
      expect(found).toHaveLength(2);
    });

    it('finds assignment at insert location', async () => {
      const found = await assignmentRepository.findAtLocation(
        userId, moduleId, ['3'], insertId, ['1,1']
      );
      expect(found).not.toBeNull();
      expect(found!.itemId.toString()).toBe(itemId1.toString());
    });
  });

  describe('reassign', () => {
    it('moves an assignment to a new location', async () => {
      const assignment = await assignmentRepository.create({
        userId,
        itemId: itemId1,
        moduleId,
        locationPath: ['3', '2,5'],
      });
      const reassigned = await assignmentRepository.reassign(assignment._id, userId, {
        moduleId,
        locationPath: ['5', '1,1'],
      });
      expect(reassigned!.locationPath).toEqual(['5', '1,1']);
    });

    it('moves an assignment to a different module', async () => {
      const otherModule = new mongoose.Types.ObjectId();
      const assignment = await assignmentRepository.create({
        userId,
        itemId: itemId1,
        moduleId,
        locationPath: ['3'],
      });
      const reassigned = await assignmentRepository.reassign(assignment._id, userId, {
        moduleId: otherModule,
        locationPath: ['1'],
      });
      expect(reassigned!.moduleId.toString()).toBe(otherModule.toString());
    });
  });

  describe('reassignInsert (bulk relocate)', () => {
    it('updates all assignments for a relocated insert', async () => {
      await assignmentRepository.create({
        userId,
        itemId: itemId1,
        moduleId,
        locationPath: ['3'],
        insertId,
        insertLocationPath: ['1,1'],
      });
      await assignmentRepository.create({
        userId,
        itemId: itemId2,
        moduleId,
        locationPath: ['3'],
        insertId,
        insertLocationPath: ['1,2'],
      });

      const newModule = new mongoose.Types.ObjectId();
      const count = await assignmentRepository.reassignInsert(
        userId,
        insertId,
        newModule,
        ['5']
      );
      expect(count).toBe(2);

      const found = await assignmentRepository.findByInsert(userId, insertId);
      expect(found.every((a) => a.moduleId.toString() === newModule.toString())).toBe(true);
      expect(found.every((a) => a.locationPath[0] === '5')).toBe(true);
    });
  });

  describe('remove operations', () => {
    it('removes a single assignment', async () => {
      const assignment = await assignmentRepository.create({
        userId,
        itemId: itemId1,
        moduleId,
        locationPath: ['1'],
      });
      expect(await assignmentRepository.remove(assignment._id, userId)).toBe(true);
    });

    it('removes all assignments at a location', async () => {
      await assignmentRepository.create({
        userId,
        itemId: itemId1,
        moduleId,
        locationPath: ['3', '2,5'],
      });
      const count = await assignmentRepository.removeAtLocation(userId, moduleId, ['3', '2,5']);
      expect(count).toBe(1);
    });

    it('removes all assignments for an item', async () => {
      await assignmentRepository.create({
        userId,
        itemId: itemId1,
        moduleId,
        locationPath: ['1'],
      });
      await assignmentRepository.create({
        userId,
        itemId: itemId1,
        moduleId,
        locationPath: ['2'],
      });
      const count = await assignmentRepository.removeByItem(userId, itemId1);
      expect(count).toBe(2);
    });

    it('removes all assignments in a module', async () => {
      await assignmentRepository.create({
        userId,
        itemId: itemId1,
        moduleId,
        locationPath: ['1'],
      });
      await assignmentRepository.create({
        userId,
        itemId: itemId2,
        moduleId,
        locationPath: ['2'],
      });
      const count = await assignmentRepository.removeByModule(userId, moduleId);
      expect(count).toBe(2);
    });

    it('counts assignments in a module', async () => {
      await assignmentRepository.create({
        userId,
        itemId: itemId1,
        moduleId,
        locationPath: ['1'],
      });
      await assignmentRepository.create({
        userId,
        itemId: itemId2,
        moduleId,
        locationPath: ['2'],
      });
      expect(await assignmentRepository.countByModule(userId, moduleId)).toBe(2);
    });
  });

  describe('findUnassignedItemIds', () => {
    it('returns IDs of items that have assignments', async () => {
      await assignmentRepository.create({
        userId,
        itemId: itemId1,
        moduleId,
        locationPath: ['1'],
      });
      const assignedIds = await assignmentRepository.findUnassignedItemIds(userId);
      expect(assignedIds.map((id) => id.toString())).toContain(itemId1.toString());
    });
  });
});
