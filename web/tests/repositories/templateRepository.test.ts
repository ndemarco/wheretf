import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { templateRepository } from '@/repositories/templateRepository';

const userId = new mongoose.Types.ObjectId();

function validInput(overrides = {}) {
  return {
    name: 'Plano 3600',
    kind: 'fixed' as const,
    userId,
    rows: 4,
    cols: 6,
    primaryAxis: 'row' as const,
    origin: { row: 0, col: 0 },
    rowLabeling: { type: 'numeric' as const, startAt: 1 },
    colLabeling: { type: 'numeric' as const, startAt: 1 },
    ...overrides,
  };
}

describe('templateRepository', () => {
  describe('create', () => {
    it('creates and returns a template', async () => {
      const result = await templateRepository.create(validInput());
      expect(result.name).toBe('Plano 3600');
      expect(result._id).toBeDefined();
    });
  });

  describe('findById', () => {
    it('finds a template by id and userId', async () => {
      const created = await templateRepository.create(validInput());
      const found = await templateRepository.findById(created._id, userId);
      expect(found).not.toBeNull();
      expect(found!.name).toBe('Plano 3600');
    });

    it('returns null for wrong userId', async () => {
      const created = await templateRepository.create(validInput());
      const otherUser = new mongoose.Types.ObjectId();
      const found = await templateRepository.findById(created._id, otherUser);
      expect(found).toBeNull();
    });

    it('returns null for nonexistent id', async () => {
      const found = await templateRepository.findById(new mongoose.Types.ObjectId(), userId);
      expect(found).toBeNull();
    });
  });

  describe('findByName', () => {
    it('finds a template by exact name', async () => {
      await templateRepository.create(validInput());
      const found = await templateRepository.findByName('Plano 3600', userId);
      expect(found).not.toBeNull();
      expect(found!.name).toBe('Plano 3600');
    });

    it('returns null for wrong name', async () => {
      await templateRepository.create(validInput());
      const found = await templateRepository.findByName('Plano 3700', userId);
      expect(found).toBeNull();
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await templateRepository.create(validInput({ name: 'Plano 3600' }));
      await templateRepository.create(validInput({ name: 'Plano 3700', rows: 4, cols: 4 }));
      await templateRepository.create(
        validInput({
          name: 'Gridfinity Baseplate',
          kind: 'parametric',
          unitSizeMm: 42,
        })
      );
    });

    it('returns all templates for user with no query', async () => {
      const results = await templateRepository.search(userId);
      expect(results).toHaveLength(3);
    });

    it('filters by name substring (case-insensitive)', async () => {
      const results = await templateRepository.search(userId, { name: 'plano' });
      expect(results).toHaveLength(2);
    });

    it('filters by kind', async () => {
      const results = await templateRepository.search(userId, { kind: 'parametric' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Gridfinity Baseplate');
    });

    it('returns empty for other user', async () => {
      const otherUser = new mongoose.Types.ObjectId();
      const results = await templateRepository.search(otherUser);
      expect(results).toHaveLength(0);
    });

    it('sorts by name', async () => {
      const results = await templateRepository.search(userId);
      const names = results.map((t) => t.name);
      expect(names).toEqual(['Gridfinity Baseplate', 'Plano 3600', 'Plano 3700']);
    });
  });

  describe('findByInterfaceAccepted', () => {
    it('finds templates that accept a given interface type', async () => {
      await templateRepository.create(
        validInput({
          name: 'GF Baseplate',
          interfaceTypesAccepted: ['gridfinity-42mm'],
        })
      );
      await templateRepository.create(validInput({ name: 'Plain Shelf' }));

      const results = await templateRepository.findByInterfaceAccepted(userId, 'gridfinity-42mm');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('GF Baseplate');
    });
  });

  describe('update', () => {
    it('updates and returns the modified template', async () => {
      const created = await templateRepository.create(validInput());
      const updated = await templateRepository.update(created._id, userId, {
        description: 'Standard Plano Stowaway',
        rows: 5,
      });
      expect(updated).not.toBeNull();
      expect(updated!.description).toBe('Standard Plano Stowaway');
      expect(updated!.rows).toBe(5);
      expect(updated!.name).toBe('Plano 3600'); // unchanged
    });

    it('returns null for wrong userId', async () => {
      const created = await templateRepository.create(validInput());
      const otherUser = new mongoose.Types.ObjectId();
      const updated = await templateRepository.update(created._id, otherUser, {
        description: 'Nope',
      });
      expect(updated).toBeNull();
    });
  });

  describe('remove', () => {
    it('removes and returns true', async () => {
      const created = await templateRepository.create(validInput());
      const result = await templateRepository.remove(created._id, userId);
      expect(result).toBe(true);
      const found = await templateRepository.findById(created._id, userId);
      expect(found).toBeNull();
    });

    it('returns false for nonexistent template', async () => {
      const result = await templateRepository.remove(new mongoose.Types.ObjectId(), userId);
      expect(result).toBe(false);
    });

    it('returns false for wrong userId', async () => {
      const created = await templateRepository.create(validInput());
      const otherUser = new mongoose.Types.ObjectId();
      const result = await templateRepository.remove(created._id, otherUser);
      expect(result).toBe(false);
    });
  });
});
