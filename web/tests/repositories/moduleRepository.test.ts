import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { moduleRepository } from '@/repositories/v2/moduleRepository';
import Template from '@/models/v2/Template';

const userId = new mongoose.Types.ObjectId();

function leafLoc(label: string, overrides = {}) {
  return {
    label,
    type: 'leaf' as const,
    ...overrides,
  };
}

function museInput(overrides = {}) {
  return {
    name: 'MUSE',
    description: 'Red cabinet',
    userId,
    primaryDimension: {
      name: 'level',
      labeling: { type: 'numeric' as const, startAt: 1 },
      values: [
        { label: '1', location: leafLoc('1', { type: 'receptacle', interfaceTypeAccepted: 'plano-shelf-slot' }) },
        { label: '2', location: leafLoc('2', { type: 'receptacle', interfaceTypeAccepted: 'plano-shelf-slot' }) },
        { label: '3', location: leafLoc('3', { type: 'receptacle', interfaceTypeAccepted: 'plano-shelf-slot' }) },
      ],
    },
    ...overrides,
  };
}

describe('moduleRepository', () => {
  describe('CRUD', () => {
    it('creates and returns a module', async () => {
      const mod = await moduleRepository.create(museInput());
      expect(mod.name).toBe('MUSE');
      expect(mod._id).toBeDefined();
    });

    it('finds by id', async () => {
      const mod = await moduleRepository.create(museInput());
      const found = await moduleRepository.findById(mod._id, userId);
      expect(found).not.toBeNull();
      expect(found!.name).toBe('MUSE');
    });

    it('finds by name', async () => {
      await moduleRepository.create(museInput());
      const found = await moduleRepository.findByName('MUSE', userId);
      expect(found).not.toBeNull();
    });

    it('searches with name filter', async () => {
      await moduleRepository.create(museInput());
      await moduleRepository.create(museInput({ name: 'ALEX' }));
      const results = await moduleRepository.search(userId, { name: 'mus' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('MUSE');
    });

    it('updates module metadata', async () => {
      const mod = await moduleRepository.create(museInput());
      const updated = await moduleRepository.update(mod._id, userId, {
        description: 'Updated description',
      });
      expect(updated!.description).toBe('Updated description');
    });

    it('removes a module', async () => {
      const mod = await moduleRepository.create(museInput());
      const result = await moduleRepository.remove(mod._id, userId);
      expect(result).toBe(true);
      const found = await moduleRepository.findById(mod._id, userId);
      expect(found).toBeNull();
    });

    it('scopes to user', async () => {
      const mod = await moduleRepository.create(museInput());
      const otherUser = new mongoose.Types.ObjectId();
      expect(await moduleRepository.findById(mod._id, otherUser)).toBeNull();
      expect(await moduleRepository.findByName('MUSE', otherUser)).toBeNull();
      expect(await moduleRepository.search(otherUser)).toHaveLength(0);
    });
  });

  describe('resolveLocation', () => {
    it('resolves a top-level location', async () => {
      const mod = await moduleRepository.create(museInput());
      const loc = moduleRepository.resolveLocation(mod, ['2']);
      expect(loc).not.toBeNull();
      expect(loc!.label).toBe('2');
      expect(loc!.type).toBe('receptacle');
    });

    it('resolves a nested location', async () => {
      const mod = await moduleRepository.create(
        museInput({
          name: 'NESTED',
          primaryDimension: {
            name: 'drawer',
            labeling: { type: 'numeric', startAt: 1 },
            values: [
              {
                label: '1',
                location: {
                  label: '1',
                  type: 'fixed',
                  overrides: [],
                  disabled: false,
                  children: [
                    {
                      label: '1,1',
                      type: 'leaf',
                      overrides: [],
                      disabled: false,
                      children: [],
                    },
                    {
                      label: '1,2',
                      type: 'leaf',
                      overrides: [],
                      disabled: false,
                      children: [],
                    },
                  ],
                },
              },
            ],
          },
        })
      );
      const loc = moduleRepository.resolveLocation(mod, ['1', '1,2']);
      expect(loc).not.toBeNull();
      expect(loc!.label).toBe('1,2');
    });

    it('returns null for invalid path', async () => {
      const mod = await moduleRepository.create(museInput());
      expect(moduleRepository.resolveLocation(mod, ['999'])).toBeNull();
      expect(moduleRepository.resolveLocation(mod, [])).toBeNull();
    });
  });

  describe('addPrimaryDimensionValue', () => {
    it('adds a new level', async () => {
      const mod = await moduleRepository.create(museInput());
      const updated = await moduleRepository.addPrimaryDimensionValue(
        mod._id,
        userId,
        '4',
        { type: 'receptacle', interfaceTypeAccepted: 'plano-shelf-slot' }
      );
      expect(updated!.primaryDimension.values).toHaveLength(4);
      expect(updated!.primaryDimension.values[3].label).toBe('4');
    });
  });

  describe('removePrimaryDimensionValue', () => {
    it('removes a level', async () => {
      const mod = await moduleRepository.create(museInput());
      const updated = await moduleRepository.removePrimaryDimensionValue(mod._id, userId, '2');
      expect(updated!.primaryDimension.values).toHaveLength(2);
      expect(updated!.primaryDimension.values.find((v) => v.label === '2')).toBeUndefined();
    });
  });

  describe('applyTemplate', () => {
    it('applies a template and generates child locations', async () => {
      const template = await Template.create({
        name: 'Plano 3600',
        kind: 'fixed',
        userId,
        rows: 4,
        cols: 6,
        primaryAxis: 'row',
        origin: { row: 0, col: 0 },
        rowLabeling: { type: 'numeric', startAt: 1 },
        colLabeling: { type: 'numeric', startAt: 1 },
      });

      const mod = await moduleRepository.create(museInput());
      const updated = await moduleRepository.applyTemplate(
        mod._id,
        userId,
        ['1'],
        template._id,
        4,
        6,
        { type: 'numeric', startAt: 1 },
        { type: 'numeric', startAt: 1 }
      );

      expect(updated).not.toBeNull();
      const level1 = updated!.primaryDimension.values[0].location;
      expect(level1.type).toBe('fixed');
      expect(level1.templateId?.toString()).toBe(template._id.toString());
      expect(level1.children).toHaveLength(24); // 4 × 6
      expect(level1.children[0].label).toBe('1,1');
      expect(level1.children[5].label).toBe('1,6');
      expect(level1.children[6].label).toBe('2,1');
    });

    it('applies a parametric template with custom dimensions', async () => {
      const template = await Template.create({
        name: 'GF Baseplate',
        kind: 'parametric',
        userId,
        rows: 4,
        cols: 4,
        primaryAxis: 'row',
        origin: { row: 0, col: 0 },
        rowLabeling: { type: 'numeric', startAt: 1 },
        colLabeling: { type: 'numeric', startAt: 1 },
        unitSizeMm: 42,
      });

      const mod = await moduleRepository.create(museInput());
      const updated = await moduleRepository.applyTemplate(
        mod._id,
        userId,
        ['2'],
        template._id,
        6,
        4,
        { type: 'numeric', startAt: 1 },
        { type: 'numeric', startAt: 1 },
        'receptacle',
        'gridfinity-42mm'
      );

      const level2 = updated!.primaryDimension.values[1].location;
      expect(level2.children).toHaveLength(24); // 6 × 4
      expect(level2.children[0].type).toBe('receptacle');
      expect(level2.children[0].interfaceTypeAccepted).toBe('gridfinity-42mm');
    });

    it('returns null for invalid path', async () => {
      const mod = await moduleRepository.create(museInput());
      const result = await moduleRepository.applyTemplate(
        mod._id,
        userId,
        ['99'],
        new mongoose.Types.ObjectId(),
        4,
        6,
        { type: 'numeric', startAt: 1 },
        { type: 'numeric', startAt: 1 }
      );
      expect(result).toBeNull();
    });
  });

  describe('disable / enable location', () => {
    it('disables a location with reason', async () => {
      const mod = await moduleRepository.create(museInput());
      const updated = await moduleRepository.disableLocation(mod._id, userId, ['2'], 'cracked shelf');
      const loc = moduleRepository.resolveLocation(updated!, ['2']);
      expect(loc!.disabled).toBe(true);
      expect(loc!.disableReason).toBe('cracked shelf');
      expect(loc!.overrides.some((o) => o.type === 'disable')).toBe(true);
    });

    it('enables a disabled location', async () => {
      const mod = await moduleRepository.create(museInput());
      await moduleRepository.disableLocation(mod._id, userId, ['2'], 'broken');
      const updated = await moduleRepository.enableLocation(mod._id, userId, ['2']);
      const loc = moduleRepository.resolveLocation(updated!, ['2']);
      expect(loc!.disabled).toBe(false);
      expect(loc!.disableReason).toBeUndefined();
      expect(loc!.overrides.some((o) => o.type === 'disable')).toBe(false);
    });
  });

  describe('getLeafPaths', () => {
    it('returns leaf paths for flat module', async () => {
      const mod = await moduleRepository.create(museInput());
      const paths = moduleRepository.getLeafPaths(mod);
      expect(paths).toHaveLength(3);
      expect(paths).toEqual([['1'], ['2'], ['3']]);
    });

    it('returns leaf paths for nested module', async () => {
      const mod = await moduleRepository.create(
        museInput({
          name: 'NESTED_LEAF',
          primaryDimension: {
            name: 'drawer',
            labeling: { type: 'numeric', startAt: 1 },
            values: [
              {
                label: '1',
                location: {
                  label: '1',
                  type: 'fixed',
                  overrides: [],
                  disabled: false,
                  children: [
                    { label: 'A', type: 'leaf', overrides: [], disabled: false, children: [] },
                    { label: 'B', type: 'leaf', overrides: [], disabled: false, children: [] },
                  ],
                },
              },
              {
                label: '2',
                location: { label: '2', type: 'leaf', overrides: [], disabled: false, children: [] },
              },
            ],
          },
        })
      );
      const paths = moduleRepository.getLeafPaths(mod);
      expect(paths).toHaveLength(3);
      expect(paths).toEqual([['1', 'A'], ['1', 'B'], ['2']]);
    });

    it('excludes disabled locations', async () => {
      const mod = await moduleRepository.create(museInput({ name: 'DISABLED_LEAF' }));
      await moduleRepository.disableLocation(mod._id, userId, ['2']);
      const updated = (await moduleRepository.findById(mod._id, userId))!;
      const paths = moduleRepository.getLeafPaths(updated);
      expect(paths).toHaveLength(2);
      expect(paths).toEqual([['1'], ['3']]);
    });
  });
});
