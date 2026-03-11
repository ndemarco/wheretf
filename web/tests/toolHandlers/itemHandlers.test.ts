import { describe, it, expect, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { getToolHandler } from '@/lib/toolHandlers';
import { itemRepository } from '@/repositories/itemRepository';
import { moduleRepository } from '@/repositories/moduleRepository';
import { assignmentRepository } from '@/repositories/assignmentRepository';

const userId = new Types.ObjectId().toString();
const uid = new Types.ObjectId(userId);

describe('Item tool handlers', () => {
  describe('items.create', () => {
    it('creates an item with name and parameters', async () => {
      const handler = getToolHandler('items.create')!;
      const result = (await handler({
        name: '10k resistor',
        description: 'Through-hole 10k ohm resistor',
        parameters: [
          { key: 'resistance', value: '10k', unit: 'ohm' },
          { key: 'tolerance', value: '5', unit: '%' },
        ],
      }, userId)) as Record<string, unknown>;
      expect(result.id).toBeDefined();
      expect(result.name).toBe('10k resistor');
    });

    it('creates a minimal item with just a name', async () => {
      const handler = getToolHandler('items.create')!;
      const result = (await handler({ name: 'Wire' }, userId)) as Record<string, unknown>;
      expect(result.name).toBe('Wire');
    });
  });

  describe('items.find', () => {
    beforeEach(async () => {
      await itemRepository.create({ name: '10k resistor', userId: uid, description: 'Through-hole', parameters: [{ key: 'resistance', value: '10k', unit: 'ohm' }] });
      await itemRepository.create({ name: '4.7k resistor', userId: uid, parameters: [{ key: 'resistance', value: '4.7k', unit: 'ohm' }] });
      await itemRepository.create({ name: 'M3 screw', userId: uid, parameters: [{ key: 'thread_size', value: 'M3' }] });
    });

    it('finds by name', async () => {
      const handler = getToolHandler('items.find')!;
      const result = (await handler({ name: 'resistor' }, userId)) as unknown[];
      expect(result).toHaveLength(2);
    });

    it('finds by parameter key', async () => {
      const handler = getToolHandler('items.find')!;
      const result = (await handler({ parameterKey: 'thread_size' }, userId)) as unknown[];
      expect(result).toHaveLength(1);
    });

    it('finds by parameter key and value', async () => {
      const handler = getToolHandler('items.find')!;
      const result = (await handler({ parameterKey: 'resistance', parameterValue: '10k' }, userId)) as unknown[];
      expect(result).toHaveLength(1);
    });

    it('returns empty for no matches', async () => {
      const handler = getToolHandler('items.find')!;
      const result = (await handler({ name: 'capacitor' }, userId)) as unknown[];
      expect(result).toHaveLength(0);
    });
  });

  describe('items.get', () => {
    it('gets by name', async () => {
      await itemRepository.create({ name: 'M3 screw', userId: uid });
      const handler = getToolHandler('items.get')!;
      const result = (await handler({ name: 'M3 screw' }, userId)) as Record<string, unknown>;
      expect(result.name).toBe('M3 screw');
    });

    it('returns error for missing', async () => {
      const handler = getToolHandler('items.get')!;
      const result = (await handler({ name: 'nothing' }, userId)) as Record<string, unknown>;
      expect(result.error).toBeDefined();
    });
  });

  describe('items.update', () => {
    it('updates name and description', async () => {
      const item = await itemRepository.create({ name: 'Old Name', userId: uid });
      const handler = getToolHandler('items.update')!;
      const result = (await handler({
        id: item._id.toString(),
        name: 'New Name',
        description: 'Added description',
      }, userId)) as Record<string, unknown>;
      expect(result.updated).toBe(true);
      expect(result.name).toBe('New Name');
    });

    it('adds a parameter', async () => {
      const item = await itemRepository.create({ name: 'Widget', userId: uid });
      const handler = getToolHandler('items.update')!;
      await handler({
        id: item._id.toString(),
        addParameter: { key: 'color', value: 'red' },
      }, userId);

      const updated = await itemRepository.findById(item._id, uid);
      expect(updated!.parameters).toHaveLength(1);
      expect(updated!.parameters[0].key).toBe('color');
    });

    it('removes a parameter', async () => {
      const item = await itemRepository.create({
        name: 'Widget', userId: uid,
        parameters: [{ key: 'color', value: 'red' }, { key: 'size', value: 'large' }],
      });
      const handler = getToolHandler('items.update')!;
      await handler({
        id: item._id.toString(),
        removeParameterKey: 'color',
      }, userId);

      const updated = await itemRepository.findById(item._id, uid);
      expect(updated!.parameters).toHaveLength(1);
      expect(updated!.parameters[0].key).toBe('size');
    });
  });

  describe('items.delete', () => {
    it('deletes an item and its assignments', async () => {
      const mod = await moduleRepository.create({
        name: 'MOD', userId: uid,
        primaryDimension: {
          name: 'level', labeling: { type: 'numeric', startAt: 1 },
          values: [{ label: '1', location: { label: '1', type: 'leaf' } }],
        },
      });
      const item = await itemRepository.create({ name: 'Doomed', userId: uid });
      await assignmentRepository.create({
        userId: uid, itemId: item._id, moduleId: mod._id, locationPath: ['1'],
      });

      const handler = getToolHandler('items.delete')!;
      const result = (await handler({ id: item._id.toString() }, userId)) as Record<string, unknown>;
      expect(result.deleted).toBe(true);

      // Verify assignments cleaned up
      const assignments = await assignmentRepository.findByItem(uid, item._id);
      expect(assignments).toHaveLength(0);
    });
  });
});
