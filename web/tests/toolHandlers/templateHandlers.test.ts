import { describe, it, expect, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { getToolHandler } from '@/lib/toolHandlers';
import { templateRepository } from '@/repositories/templateRepository';
import { moduleRepository } from '@/repositories/moduleRepository';

const userId = new Types.ObjectId().toString();

const baseTemplate = {
  name: 'plano-3700',
  kind: 'fixed',
  rows: 4,
  cols: 7,
  rowLabeling: { type: 'numeric', startAt: 1 },
  colLabeling: { type: 'numeric', startAt: 1 },
  description: '4-row, 7-column tackle box',
};

describe('Template tool handlers', () => {
  describe('templates.create', () => {
    it('creates a template and returns summary', async () => {
      const handler = getToolHandler('templates.create')!;
      const result = (await handler(baseTemplate, userId)) as Record<string, unknown>;
      expect(result.id).toBeDefined();
      expect(result.name).toBe('plano-3700');
      expect(result.kind).toBe('fixed');
      expect(result.rows).toBe(4);
      expect(result.cols).toBe(7);
    });

    it('creates a parametric template with constraints', async () => {
      const handler = getToolHandler('templates.create')!;
      const result = (await handler({
        name: 'gridfinity-42mm',
        kind: 'parametric',
        rows: 4,
        cols: 4,
        rowLabeling: { type: 'numeric', startAt: 1 },
        colLabeling: { type: 'numeric', startAt: 1 },
        rowConstraints: { min: 1, max: 10, softMax: 8 },
        colConstraints: { min: 1, max: 10, softMax: 8 },
        unitSizeMm: 42,
        interfaceTypeProvided: 'gridfinity-42mm',
      }, userId)) as Record<string, unknown>;
      expect(result.kind).toBe('parametric');
    });
  });

  describe('templates.list', () => {
    beforeEach(async () => {
      await templateRepository.create({ ...baseTemplate, userId: new Types.ObjectId(userId), rowLabeling: baseTemplate.rowLabeling as { type: 'numeric'; startAt: number }, colLabeling: baseTemplate.colLabeling as { type: 'numeric'; startAt: number }, kind: 'fixed' });
      await templateRepository.create({ name: 'gridfinity-42mm', kind: 'parametric', userId: new Types.ObjectId(userId), rows: 4, cols: 4, rowLabeling: { type: 'numeric', startAt: 1 }, colLabeling: { type: 'numeric', startAt: 1 } });
    });

    it('lists all templates', async () => {
      const handler = getToolHandler('templates.list')!;
      const result = (await handler({}, userId)) as unknown[];
      expect(result).toHaveLength(2);
    });

    it('filters by name', async () => {
      const handler = getToolHandler('templates.list')!;
      const result = (await handler({ name: 'plano' }, userId)) as unknown[];
      expect(result).toHaveLength(1);
    });

    it('filters by kind', async () => {
      const handler = getToolHandler('templates.list')!;
      const result = (await handler({ kind: 'parametric' }, userId)) as unknown[];
      expect(result).toHaveLength(1);
    });
  });

  describe('templates.get', () => {
    it('gets by name', async () => {
      const template = await templateRepository.create({ ...baseTemplate, userId: new Types.ObjectId(userId), rowLabeling: baseTemplate.rowLabeling as { type: 'numeric'; startAt: number }, colLabeling: baseTemplate.colLabeling as { type: 'numeric'; startAt: number }, kind: 'fixed' });
      const handler = getToolHandler('templates.get')!;
      const result = (await handler({ name: 'plano-3700' }, userId)) as Record<string, unknown>;
      expect(result.name).toBe('plano-3700');
      expect(result._id.toString()).toBe(template._id.toString());
    });

    it('gets by id', async () => {
      const template = await templateRepository.create({ ...baseTemplate, userId: new Types.ObjectId(userId), rowLabeling: baseTemplate.rowLabeling as { type: 'numeric'; startAt: number }, colLabeling: baseTemplate.colLabeling as { type: 'numeric'; startAt: number }, kind: 'fixed' });
      const handler = getToolHandler('templates.get')!;
      const result = (await handler({ id: template._id.toString() }, userId)) as Record<string, unknown>;
      expect(result.name).toBe('plano-3700');
    });

    it('returns error for missing template', async () => {
      const handler = getToolHandler('templates.get')!;
      const result = (await handler({ name: 'nonexistent' }, userId)) as Record<string, unknown>;
      expect(result.error).toBeDefined();
    });
  });

  describe('templates.update', () => {
    it('updates template fields', async () => {
      const template = await templateRepository.create({ ...baseTemplate, userId: new Types.ObjectId(userId), rowLabeling: baseTemplate.rowLabeling as { type: 'numeric'; startAt: number }, colLabeling: baseTemplate.colLabeling as { type: 'numeric'; startAt: number }, kind: 'fixed' });
      const handler = getToolHandler('templates.update')!;
      const result = (await handler({ id: template._id.toString(), updates: { description: 'Updated description' } }, userId)) as Record<string, unknown>;
      expect(result.updated).toBe(true);
    });
  });

  describe('templates.delete', () => {
    it('deletes an unused template', async () => {
      const template = await templateRepository.create({ ...baseTemplate, userId: new Types.ObjectId(userId), rowLabeling: baseTemplate.rowLabeling as { type: 'numeric'; startAt: number }, colLabeling: baseTemplate.colLabeling as { type: 'numeric'; startAt: number }, kind: 'fixed' });
      const handler = getToolHandler('templates.delete')!;
      const result = (await handler({ id: template._id.toString() }, userId)) as Record<string, unknown>;
      expect(result.deleted).toBe(true);
    });

    it('blocks deletion of template in use by a module', async () => {
      const uid = new Types.ObjectId(userId);
      const template = await templateRepository.create({ ...baseTemplate, userId: uid, rowLabeling: baseTemplate.rowLabeling as { type: 'numeric'; startAt: number }, colLabeling: baseTemplate.colLabeling as { type: 'numeric'; startAt: number }, kind: 'fixed' });

      // Create module with template reference
      const mod = await moduleRepository.create({
        name: 'TEST-MOD',
        userId: uid,
        primaryDimension: {
          name: 'level',
          labeling: { type: 'numeric', startAt: 1 },
          values: [{ label: '1', location: { label: '1', type: 'leaf' } }],
        },
      });
      await moduleRepository.applyTemplate(
        mod._id, uid, ['1'], template._id, 4, 7,
        { type: 'numeric', startAt: 1 }, { type: 'numeric', startAt: 1 }
      );

      const handler = getToolHandler('templates.delete')!;
      const result = (await handler({ id: template._id.toString() }, userId)) as Record<string, unknown>;
      expect(result.error).toContain('in use');
    });
  });
});
