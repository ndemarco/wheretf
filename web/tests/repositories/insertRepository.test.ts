import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { insertRepository } from '@/repositories/insertRepository';

const userId = new mongoose.Types.ObjectId();
const templateId = new mongoose.Types.ObjectId();
const moduleId = new mongoose.Types.ObjectId();

function planoInsert(overrides = {}) {
  return {
    name: 'Plano Box #1',
    userId,
    templateId,
    footprint: { rows: 1, cols: 1 },
    interfaceTypeProvided: 'plano-shelf-slot',
    locations: [
      { label: '1,1', disabled: false, children: [] },
      { label: '1,2', disabled: false, children: [] },
      { label: '2,1', disabled: false, children: [] },
      { label: '2,2', disabled: false, children: [] },
    ],
    ...overrides,
  };
}

function gfBin(overrides = {}) {
  return {
    name: 'GF 2x1 3-comp',
    userId,
    templateId: new mongoose.Types.ObjectId(),
    footprint: { rows: 1, cols: 2 },
    interfaceTypeProvided: 'gridfinity-42mm',
    locations: [
      { label: 'comp-1', disabled: false, children: [] },
      { label: 'comp-2', disabled: false, children: [] },
      { label: 'comp-3', disabled: false, children: [] },
    ],
    ...overrides,
  };
}

describe('insertRepository', () => {
  describe('CRUD', () => {
    it('creates a template-based insert', async () => {
      const insert = await insertRepository.create(planoInsert());
      expect(insert.name).toBe('Plano Box #1');
      expect(insert.templateId?.toString()).toBe(templateId.toString());
      expect(insert.locations).toHaveLength(4);
    });

    it('creates a structurally-defined insert (no template)', async () => {
      const insert = await insertRepository.create({
        name: 'Custom Divider',
        userId,
        structuralDefinition: {
          rows: 2,
          cols: 3,
          rowLabeling: { type: 'numeric', startAt: 1 },
          colLabeling: { type: 'alpha' },
        },
        footprint: { rows: 1, cols: 1 },
        locations: [
          { label: '1,A', disabled: false, children: [] },
          { label: '1,B', disabled: false, children: [] },
        ],
      });
      expect(insert.templateId).toBeUndefined();
      expect(insert.structuralDefinition?.rows).toBe(2);
    });

    it('creates an insert with footprint > 1', async () => {
      const insert = await insertRepository.create(gfBin());
      expect(insert.footprint.rows).toBe(1);
      expect(insert.footprint.cols).toBe(2);
    });

    it('finds by id', async () => {
      const insert = await insertRepository.create(planoInsert());
      const found = await insertRepository.findById(insert._id, userId);
      expect(found).not.toBeNull();
      expect(found!.name).toBe('Plano Box #1');
    });

    it('scopes to user', async () => {
      const insert = await insertRepository.create(planoInsert());
      const otherUser = new mongoose.Types.ObjectId();
      expect(await insertRepository.findById(insert._id, otherUser)).toBeNull();
    });

    it('updates name', async () => {
      const insert = await insertRepository.create(planoInsert());
      const updated = await insertRepository.update(insert._id, userId, {
        name: 'Plano Box #1 (modified)',
      });
      expect(updated!.name).toBe('Plano Box #1 (modified)');
    });

    it('removes an insert', async () => {
      const insert = await insertRepository.create(planoInsert());
      expect(await insertRepository.remove(insert._id, userId)).toBe(true);
      expect(await insertRepository.findById(insert._id, userId)).toBeNull();
    });
  });

  describe('search', () => {
    it('searches by name', async () => {
      await insertRepository.create(planoInsert());
      await insertRepository.create(gfBin());
      const results = await insertRepository.search(userId, { name: 'plano' });
      expect(results).toHaveLength(1);
    });

    it('searches by templateId', async () => {
      await insertRepository.create(planoInsert());
      await insertRepository.create(gfBin());
      const results = await insertRepository.search(userId, { templateId });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Plano Box #1');
    });

    it('searches for unassigned inserts', async () => {
      await insertRepository.create(planoInsert());
      const placed = await insertRepository.create(planoInsert({ name: 'Placed Box' }));
      await insertRepository.place(placed._id, userId, moduleId, ['3']);

      const results = await insertRepository.search(userId, { unassigned: true });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Plano Box #1');
    });
  });

  describe('place / unplace / relocate', () => {
    it('places an insert at a module location', async () => {
      const insert = await insertRepository.create(planoInsert());
      const placed = await insertRepository.place(insert._id, userId, moduleId, ['3']);
      expect(placed!.moduleId?.toString()).toBe(moduleId.toString());
      expect(placed!.locationPath).toEqual(['3']);
    });

    it('unplaces an insert', async () => {
      const insert = await insertRepository.create(planoInsert());
      await insertRepository.place(insert._id, userId, moduleId, ['3']);
      const unplaced = await insertRepository.unplace(insert._id, userId);
      expect(unplaced!.moduleId).toBeUndefined();
      // locationPath becomes empty array after $unset (Mongoose default)
      expect(unplaced!.locationPath?.length ?? 0).toBe(0);
    });

    it('relocates an insert to a different location', async () => {
      const insert = await insertRepository.create(planoInsert());
      await insertRepository.place(insert._id, userId, moduleId, ['3']);
      const otherModule = new mongoose.Types.ObjectId();
      const relocated = await insertRepository.relocate(insert._id, userId, otherModule, ['5']);
      expect(relocated!.moduleId?.toString()).toBe(otherModule.toString());
      expect(relocated!.locationPath).toEqual(['5']);
    });

    it('finds inserts by module location', async () => {
      const insert = await insertRepository.create(planoInsert());
      await insertRepository.place(insert._id, userId, moduleId, ['3']);
      const found = await insertRepository.findByModuleLocation(userId, moduleId, ['3']);
      expect(found).toHaveLength(1);
      expect(found[0].name).toBe('Plano Box #1');
    });

    it('finds all inserts in a module', async () => {
      const i1 = await insertRepository.create(planoInsert({ name: 'Box A' }));
      const i2 = await insertRepository.create(planoInsert({ name: 'Box B' }));
      await insertRepository.place(i1._id, userId, moduleId, ['1']);
      await insertRepository.place(i2._id, userId, moduleId, ['2']);
      const found = await insertRepository.findByModule(userId, moduleId);
      expect(found).toHaveLength(2);
    });
  });

  describe('overrides', () => {
    it('adds a merge override', async () => {
      const insert = await insertRepository.create(planoInsert());
      const updated = await insertRepository.addOverride(insert._id, userId, {
        type: 'merge',
        originPosition: { row: 0, col: 2 },
        mergedPositions: [{ row: 0, col: 3 }],
      });
      expect(updated!.overrides).toHaveLength(1);
      expect(updated!.overrides[0].type).toBe('merge');
    });

    it('adds multiple overrides', async () => {
      const insert = await insertRepository.create(planoInsert({ name: 'Multi Override' }));
      await insertRepository.addOverride(insert._id, userId, {
        type: 'merge',
        originPosition: { row: 0, col: 0 },
        mergedPositions: [{ row: 0, col: 1 }],
      });
      const updated = await insertRepository.addOverride(insert._id, userId, {
        type: 'disable',
        position: { row: 1, col: 0 },
        reason: 'cracked',
      });
      expect(updated!.overrides).toHaveLength(2);
    });
  });

  describe('resolveLocation', () => {
    it('resolves a top-level insert location', async () => {
      const insert = await insertRepository.create(planoInsert());
      const loc = insertRepository.resolveLocation(insert, ['1,1']);
      expect(loc).not.toBeNull();
      expect(loc!.label).toBe('1,1');
    });

    it('resolves a nested insert location', async () => {
      const insert = await insertRepository.create({
        name: 'Nested Insert',
        userId,
        footprint: { rows: 1, cols: 1 },
        locations: [
          {
            label: 'front',
            disabled: false,
            children: [
              { label: 'left', disabled: false, children: [] },
              { label: 'right', disabled: false, children: [] },
            ],
          },
        ],
      });
      const loc = insertRepository.resolveLocation(insert, ['front', 'right']);
      expect(loc).not.toBeNull();
      expect(loc!.label).toBe('right');
    });

    it('returns null for invalid path', async () => {
      const insert = await insertRepository.create(planoInsert());
      expect(insertRepository.resolveLocation(insert, ['nonexistent'])).toBeNull();
      expect(insertRepository.resolveLocation(insert, [])).toBeNull();
    });
  });

  describe('getLeafLabels', () => {
    it('returns leaf paths for flat insert', async () => {
      const insert = await insertRepository.create(planoInsert({ name: 'Leaf Test' }));
      const leaves = insertRepository.getLeafLabels(insert);
      expect(leaves).toHaveLength(4);
      expect(leaves).toEqual([['1,1'], ['1,2'], ['2,1'], ['2,2']]);
    });

    it('returns leaf paths for insert with nested locations', async () => {
      const insert = await insertRepository.create({
        name: 'Nested Leaf',
        userId,
        footprint: { rows: 1, cols: 1 },
        locations: [
          {
            label: 'front',
            disabled: false,
            children: [
              { label: 'left', disabled: false, children: [] },
              { label: 'right', disabled: false, children: [] },
            ],
          },
          { label: 'rear', disabled: false, children: [] },
        ],
      });
      const leaves = insertRepository.getLeafLabels(insert);
      expect(leaves).toEqual([['front', 'left'], ['front', 'right'], ['rear']]);
    });

    it('excludes disabled locations', async () => {
      const insert = await insertRepository.create({
        name: 'Disabled Leaf',
        userId,
        footprint: { rows: 1, cols: 1 },
        locations: [
          { label: 'A', disabled: false, children: [] },
          { label: 'B', disabled: true, children: [] },
          { label: 'C', disabled: false, children: [] },
        ],
      });
      const leaves = insertRepository.getLeafLabels(insert);
      expect(leaves).toEqual([['A'], ['C']]);
    });
  });
});
