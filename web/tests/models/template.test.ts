import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import Template from '@/models/v2/Template';

const userId = new mongoose.Types.ObjectId();

function validTemplate(overrides = {}) {
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

describe('Template model', () => {
  it('creates a fixed template with required fields', async () => {
    const doc = await Template.create(validTemplate());
    expect(doc.name).toBe('Plano 3600');
    expect(doc.kind).toBe('fixed');
    expect(doc.rows).toBe(4);
    expect(doc.cols).toBe(6);
    expect(doc.primaryAxis).toBe('row');
    expect(doc.origin).toEqual({ row: 0, col: 0 });
    expect(doc.createdAt).toBeInstanceOf(Date);
    expect(doc.updatedAt).toBeInstanceOf(Date);
  });

  it('creates a parametric template with constraints', async () => {
    const doc = await Template.create(
      validTemplate({
        name: 'Gridfinity Baseplate',
        kind: 'parametric',
        rows: 4,
        cols: 4,
        unitSizeMm: 42,
        rowConstraints: { min: 1, max: 20, softMax: 10 },
        colConstraints: { min: 1, max: 20, softMax: 10 },
      })
    );
    expect(doc.kind).toBe('parametric');
    expect(doc.unitSizeMm).toBe(42);
    expect(doc.rowConstraints?.max).toBe(20);
    expect(doc.colConstraints?.softMax).toBe(10);
  });

  it('enforces unique name per user', async () => {
    await Template.create(validTemplate({ name: 'Unique Test' }));
    await expect(
      Template.create(validTemplate({ name: 'Unique Test' }))
    ).rejects.toThrow();
  });

  it('allows same name for different users', async () => {
    const otherUser = new mongoose.Types.ObjectId();
    await Template.create(validTemplate({ name: 'Shared Name' }));
    const doc = await Template.create(
      validTemplate({ name: 'Shared Name', userId: otherUser })
    );
    expect(doc.name).toBe('Shared Name');
  });

  it('rejects missing name', async () => {
    await expect(
      Template.create(validTemplate({ name: undefined }))
    ).rejects.toThrow();
  });

  it('rejects missing kind', async () => {
    await expect(
      Template.create(validTemplate({ kind: undefined }))
    ).rejects.toThrow();
  });

  it('rejects invalid kind', async () => {
    await expect(
      Template.create(validTemplate({ kind: 'unknown' }))
    ).rejects.toThrow();
  });

  it('rejects rows < 1', async () => {
    await expect(
      Template.create(validTemplate({ rows: 0 }))
    ).rejects.toThrow();
  });

  it('rejects cols < 1', async () => {
    await expect(
      Template.create(validTemplate({ cols: 0 }))
    ).rejects.toThrow();
  });

  it('stores subdivision options', async () => {
    const doc = await Template.create(
      validTemplate({
        name: 'Akro-Mils 10116',
        subdivisionOptions: [
          {
            name: '40716 front-rear divider',
            resultingLabels: ['front', 'rear'],
            accessoryProduct: 'Akro-Mils 40716',
          },
          {
            name: '40717 left-right divider',
            resultingLabels: ['left', 'right'],
            accessoryProduct: 'Akro-Mils 40717',
          },
        ],
      })
    );
    expect(doc.subdivisionOptions).toHaveLength(2);
    expect(doc.subdivisionOptions[0].name).toBe('40716 front-rear divider');
    expect(doc.subdivisionOptions[0].resultingLabels).toEqual(['front', 'rear']);
    expect(doc.subdivisionOptions[1].resultingLabels).toEqual(['left', 'right']);
  });

  it('stores interface types', async () => {
    const doc = await Template.create(
      validTemplate({
        name: 'GF Baseplate',
        interfaceTypesAccepted: ['gridfinity-42mm'],
        interfaceTypeProvided: 'alex-drawer-slot',
      })
    );
    expect(doc.interfaceTypesAccepted).toEqual(['gridfinity-42mm']);
    expect(doc.interfaceTypeProvided).toBe('alex-drawer-slot');
  });

  it('stores extensible metadata', async () => {
    const doc = await Template.create(
      validTemplate({
        name: 'With Metadata',
        metadata: {
          manufacturer: 'Plano',
          productNumber: '3600',
          weightCapacityGrams: 500,
        },
      })
    );
    expect(doc.metadata.get('manufacturer')).toBe('Plano');
    expect(doc.metadata.get('productNumber')).toBe('3600');
    expect(doc.metadata.get('weightCapacityGrams')).toBe(500);
  });

  it('supports alpha labeling scheme', async () => {
    const doc = await Template.create(
      validTemplate({
        name: 'Alpha Labels',
        rowLabeling: { type: 'alpha' },
        colLabeling: { type: 'numeric', startAt: 1 },
      })
    );
    expect(doc.rowLabeling.type).toBe('alpha');
  });

  it('supports custom labeling scheme', async () => {
    const doc = await Template.create(
      validTemplate({
        name: 'Custom Labels',
        rowLabeling: { type: 'custom', labels: ['top', 'middle', 'bottom'] },
        colLabeling: { type: 'numeric', startAt: 1 },
        rows: 3,
      })
    );
    expect(doc.rowLabeling.type).toBe('custom');
    expect(doc.rowLabeling.labels).toEqual(['top', 'middle', 'bottom']);
  });

  it('defaults subdivision options to empty array', async () => {
    const doc = await Template.create(validTemplate({ name: 'No Subdivisions' }));
    expect(doc.subdivisionOptions).toEqual([]);
  });

  it('defaults interface types accepted to empty array', async () => {
    const doc = await Template.create(validTemplate({ name: 'No Interfaces' }));
    expect(doc.interfaceTypesAccepted).toEqual([]);
  });
});
