import Assignment, { IAssignment, buildLocationKey } from '@/models/v2/Assignment';
import { Types } from 'mongoose';

export interface CreateAssignmentInput {
  userId: Types.ObjectId;
  itemId: Types.ObjectId;
  moduleId: Types.ObjectId;
  locationPath: string[];
  insertId?: Types.ObjectId;
  insertLocationPath?: string[];
}

export const assignmentRepository = {
  async create(input: CreateAssignmentInput): Promise<IAssignment> {
    return Assignment.create({
      ...input,
      locationKey: buildLocationKey(input),
      assignedAt: new Date(),
    });
  },

  async findById(id: Types.ObjectId | string, userId: Types.ObjectId | string): Promise<IAssignment | null> {
    return Assignment.findOne({ _id: id, userId });
  },

  /**
   * Find the assignment at a specific location (one per location enforced).
   */
  async findAtLocation(
    userId: Types.ObjectId | string,
    moduleId: Types.ObjectId | string,
    locationPath: string[],
    insertId?: Types.ObjectId | string,
    insertLocationPath?: string[]
  ): Promise<IAssignment | null> {
    const filter: Record<string, unknown> = {
      userId,
      moduleId,
      locationPath,
    };
    if (insertId) {
      filter.insertId = insertId;
      filter.insertLocationPath = insertLocationPath || [];
    } else {
      filter.insertId = { $exists: false };
    }
    return Assignment.findOne(filter);
  },

  /**
   * Find all assignments for a given item ("where are all my 10k resistors?").
   */
  async findByItem(
    userId: Types.ObjectId | string,
    itemId: Types.ObjectId | string
  ): Promise<IAssignment[]> {
    return Assignment.find({ userId, itemId }).sort({ assignedAt: -1 });
  },

  /**
   * Find all assignments within a module.
   */
  async findByModule(
    userId: Types.ObjectId | string,
    moduleId: Types.ObjectId | string
  ): Promise<IAssignment[]> {
    return Assignment.find({ userId, moduleId }).sort({ locationPath: 1 });
  },

  /**
   * Find all assignments under a location prefix (e.g., all assignments on level 3).
   */
  async findByLocationPrefix(
    userId: Types.ObjectId | string,
    moduleId: Types.ObjectId | string,
    pathPrefix: string[]
  ): Promise<IAssignment[]> {
    if (pathPrefix.length === 0) {
      return this.findByModule(userId, moduleId);
    }

    // Match assignments whose locationPath starts with the prefix
    const filter: Record<string, unknown> = { userId, moduleId };
    pathPrefix.forEach((segment, i) => {
      filter[`locationPath.${i}`] = segment;
    });
    return Assignment.find(filter).sort({ locationPath: 1 });
  },

  /**
   * Find all assignments within a specific insert.
   */
  async findByInsert(
    userId: Types.ObjectId | string,
    insertId: Types.ObjectId | string
  ): Promise<IAssignment[]> {
    return Assignment.find({ userId, insertId }).sort({ insertLocationPath: 1 });
  },

  /**
   * Find all unassigned items (items with no assignments).
   * Returns item IDs that have no assignment records.
   */
  async findUnassignedItemIds(userId: Types.ObjectId | string): Promise<Types.ObjectId[]> {
    const assignedItemIds = await Assignment.distinct('itemId', { userId });
    // This returns IDs of items that DO have assignments.
    // The caller should use this to find items NOT in this set.
    return assignedItemIds;
  },

  /**
   * Reassign: move an assignment to a new location.
   */
  async reassign(
    id: Types.ObjectId | string,
    userId: Types.ObjectId | string,
    newLocation: {
      moduleId: Types.ObjectId;
      locationPath: string[];
      insertId?: Types.ObjectId;
      insertLocationPath?: string[];
    }
  ): Promise<IAssignment | null> {
    const update: Record<string, unknown> = {
      moduleId: newLocation.moduleId,
      locationPath: newLocation.locationPath,
      locationKey: buildLocationKey(newLocation),
      assignedAt: new Date(),
    };
    if (newLocation.insertId) {
      update.insertId = newLocation.insertId;
      update.insertLocationPath = newLocation.insertLocationPath || [];
    }
    return Assignment.findOneAndUpdate(
      { _id: id, userId },
      { $set: update },
      { new: true }
    );
  },

  /**
   * Bulk reassign all assignments for an insert (used when relocating an insert).
   */
  async reassignInsert(
    userId: Types.ObjectId | string,
    insertId: Types.ObjectId | string,
    newModuleId: Types.ObjectId,
    newLocationPath: string[]
  ): Promise<number> {
    const assignments = await Assignment.find({ userId, insertId });
    let count = 0;
    for (const assignment of assignments) {
      assignment.moduleId = newModuleId;
      assignment.locationPath = newLocationPath;
      assignment.locationKey = buildLocationKey({
        moduleId: newModuleId,
        locationPath: newLocationPath,
        insertId: assignment.insertId,
        insertLocationPath: assignment.insertLocationPath,
      });
      await assignment.save();
      count++;
    }
    return count;
  },

  async remove(id: Types.ObjectId | string, userId: Types.ObjectId | string): Promise<boolean> {
    const result = await Assignment.deleteOne({ _id: id, userId });
    return result.deletedCount === 1;
  },

  /**
   * Remove all assignments at a specific module location (for overrides that invalidate locations).
   */
  async removeAtLocation(
    userId: Types.ObjectId | string,
    moduleId: Types.ObjectId | string,
    locationPath: string[]
  ): Promise<number> {
    const result = await Assignment.deleteMany({ userId, moduleId, locationPath });
    return result.deletedCount;
  },

  /**
   * Remove all assignments for an item.
   */
  async removeByItem(
    userId: Types.ObjectId | string,
    itemId: Types.ObjectId | string
  ): Promise<number> {
    const result = await Assignment.deleteMany({ userId, itemId });
    return result.deletedCount;
  },

  /**
   * Remove all assignments within a module (for module deletion).
   */
  async removeByModule(
    userId: Types.ObjectId | string,
    moduleId: Types.ObjectId | string
  ): Promise<number> {
    const result = await Assignment.deleteMany({ userId, moduleId });
    return result.deletedCount;
  },

  /**
   * Count assignments in a module (for deletion guard).
   */
  async countByModule(
    userId: Types.ObjectId | string,
    moduleId: Types.ObjectId | string
  ): Promise<number> {
    return Assignment.countDocuments({ userId, moduleId });
  },

  /**
   * Check if a location is occupied.
   */
  async isLocationOccupied(
    userId: Types.ObjectId | string,
    moduleId: Types.ObjectId | string,
    locationPath: string[],
    insertId?: Types.ObjectId | string,
    insertLocationPath?: string[]
  ): Promise<boolean> {
    const existing = await this.findAtLocation(userId, moduleId, locationPath, insertId, insertLocationPath);
    return existing !== null;
  },
};
