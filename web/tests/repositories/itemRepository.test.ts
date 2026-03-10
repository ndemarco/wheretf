import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { itemRepository } from '@/repositories/itemRepository';

const userId = new mongoose.Types.ObjectId();

function resistor(overrides = {}) {
  return {
    name: '10k 0805 resistor',
    description: '10k ohm 0805 SMD resistor, 1% tolerance',
    userId,
    parameters: [
      { key: 'resistance', value: '10k', unit: 'ohm' },
      { key: 'package', value: '0805' },
      { key: 'tolerance', value: '1', unit: '%' },
    ],
    ...overrides,
  };
}

describe('itemRepository', () => {
  describe('CRUD', () => {
    it('creates an item with parameters', async () => {
      const item = await itemRepository.create(resistor());
      expect(item.name).toBe('10k 0805 resistor');
      expect(item.parameters).toHaveLength(3);
      expect(item.parameters[0].key).toBe('resistance');
      expect(item.parameters[0].unit).toBe('ohm');
    });

    it('creates an item with no parameters', async () => {
      const item = await itemRepository.create({
        name: 'Mystery box',
        userId,
      });
      expect(item.parameters).toEqual([]);
    });

    it('finds by id', async () => {
      const item = await itemRepository.create(resistor());
      const found = await itemRepository.findById(item._id, userId);
      expect(found).not.toBeNull();
      expect(found!.name).toBe('10k 0805 resistor');
    });

    it('finds by name', async () => {
      await itemRepository.create(resistor());
      const found = await itemRepository.findByName('10k 0805 resistor', userId);
      expect(found).not.toBeNull();
    });

    it('scopes to user', async () => {
      const item = await itemRepository.create(resistor());
      const otherUser = new mongoose.Types.ObjectId();
      expect(await itemRepository.findById(item._id, otherUser)).toBeNull();
    });

    it('updates item fields', async () => {
      const item = await itemRepository.create(resistor());
      const updated = await itemRepository.update(item._id, userId, {
        description: 'Updated description',
      });
      expect(updated!.description).toBe('Updated description');
      expect(updated!.name).toBe('10k 0805 resistor');
    });

    it('removes an item', async () => {
      const item = await itemRepository.create(resistor());
      expect(await itemRepository.remove(item._id, userId)).toBe(true);
      expect(await itemRepository.findById(item._id, userId)).toBeNull();
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await itemRepository.create(resistor());
      await itemRepository.create(resistor({
        name: '4.7k 0402 resistor',
        parameters: [
          { key: 'resistance', value: '4.7k', unit: 'ohm' },
          { key: 'package', value: '0402' },
        ],
      }));
      await itemRepository.create({
        name: 'M3x10 SHCS',
        description: 'M3 socket head cap screw, stainless steel',
        userId,
        parameters: [
          { key: 'thread', value: 'M3' },
          { key: 'length', value: '10', unit: 'mm' },
          { key: 'material', value: 'stainless steel' },
        ],
      });
    });

    it('searches by name substring', async () => {
      const results = await itemRepository.search(userId, { name: 'resistor' });
      expect(results).toHaveLength(2);
    });

    it('searches case-insensitively', async () => {
      const results = await itemRepository.search(userId, { name: 'SHCS' });
      expect(results).toHaveLength(1);
    });

    it('returns all items with no filter', async () => {
      const results = await itemRepository.search(userId);
      expect(results).toHaveLength(3);
    });

    it('searches by parameter key', async () => {
      const results = await itemRepository.search(userId, { parameterKey: 'material' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('M3x10 SHCS');
    });

    it('searches by parameter key + value', async () => {
      const results = await itemRepository.search(userId, {
        parameterKey: 'resistance',
        parameterValue: '10k',
      });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('10k 0805 resistor');
    });

    it('returns empty for other user', async () => {
      const otherUser = new mongoose.Types.ObjectId();
      const results = await itemRepository.search(otherUser);
      expect(results).toHaveLength(0);
    });
  });

  describe('parameter operations', () => {
    it('adds a parameter', async () => {
      const item = await itemRepository.create(resistor());
      const updated = await itemRepository.addParameter(item._id, userId, {
        key: 'manufacturer',
        value: 'Würth Elektronik',
      });
      expect(updated!.parameters).toHaveLength(4);
      expect(updated!.parameters[3].key).toBe('manufacturer');
    });

    it('removes a parameter by key', async () => {
      const item = await itemRepository.create(resistor());
      const updated = await itemRepository.removeParameter(item._id, userId, 'tolerance');
      expect(updated!.parameters).toHaveLength(2);
      expect(updated!.parameters.find((p) => p.key === 'tolerance')).toBeUndefined();
    });
  });

  describe('UTF-8 support', () => {
    it('handles unicode names', async () => {
      const item = await itemRepository.create({
        name: 'Würth WE-CBF 742 792 510',
        description: 'EMI-Ferrit für flexible Leiterplatten',
        userId,
        parameters: [{ key: 'type', value: 'フェライト' }],
      });
      expect(item.name).toBe('Würth WE-CBF 742 792 510');
      expect(item.parameters[0].value).toBe('フェライト');
    });

    it('handles emoji in description', async () => {
      const item = await itemRepository.create({
        name: 'Test Item 🔧',
        userId,
      });
      expect(item.name).toBe('Test Item 🔧');
    });
  });
});
