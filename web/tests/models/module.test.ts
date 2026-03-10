import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import Module from '@/models/v2/Module';

const userId = new mongoose.Types.ObjectId();

function leafLocation(label: string, overrides = {}) {
  return {
    label,
    type: 'leaf' as const,
    overrides: [],
    disabled: false,
    children: [],
    ...overrides,
  };
}

function validModule(overrides = {}) {
  return {
    name: 'MUSE',
    description: 'Red cabinet with 11 levels',
    userId,
    primaryDimension: {
      name: 'level',
      labeling: { type: 'numeric' as const, startAt: 1 },
      values: [
        { label: '1', location: leafLocation('1', { type: 'receptacle', interfaceTypeAccepted: 'plano-shelf-slot' }) },
        { label: '2', location: leafLocation('2', { type: 'receptacle', interfaceTypeAccepted: 'plano-shelf-slot' }) },
        { label: '3', location: leafLocation('3', { type: 'receptacle', interfaceTypeAccepted: 'plano-shelf-slot' }) },
      ],
    },
    ...overrides,
  };
}

describe('Module model', () => {
  it('creates a module with primary dimension', async () => {
    const doc = await Module.create(validModule());
    expect(doc.name).toBe('MUSE');
    expect(doc.primaryDimension.name).toBe('level');
    expect(doc.primaryDimension.values).toHaveLength(3);
    expect(doc.primaryDimension.values[0].label).toBe('1');
  });

  it('supports receptacle locations', async () => {
    const doc = await Module.create(validModule());
    expect(doc.primaryDimension.values[0].location.type).toBe('receptacle');
    expect(doc.primaryDimension.values[0].location.interfaceTypeAccepted).toBe('plano-shelf-slot');
  });

  it('supports fixed locations with children', async () => {
    const doc = await Module.create(
      validModule({
        name: 'ALEX',
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
                  leafLocation('1,1'),
                  leafLocation('1,2'),
                  leafLocation('2,1'),
                  leafLocation('2,2'),
                ],
              },
            },
          ],
        },
      })
    );
    const drawer1 = doc.primaryDimension.values[0].location;
    expect(drawer1.type).toBe('fixed');
    expect(drawer1.children).toHaveLength(4);
    expect(drawer1.children[0].label).toBe('1,1');
  });

  it('supports deeply nested locations', async () => {
    const doc = await Module.create(
      validModule({
        name: 'DEEP',
        primaryDimension: {
          name: 'section',
          labeling: { type: 'custom' },
          values: [
            {
              label: 'pegboard',
              location: {
                label: 'pegboard',
                type: 'fixed',
                overrides: [],
                disabled: false,
                children: [
                  {
                    label: '1,1',
                    type: 'receptacle',
                    interfaceTypeAccepted: 'gridfinity-42mm',
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
    const child = doc.primaryDimension.values[0].location.children[0];
    expect(child.type).toBe('receptacle');
    expect(child.interfaceTypeAccepted).toBe('gridfinity-42mm');
  });

  it('enforces unique name per user', async () => {
    await Module.create(validModule());
    await expect(Module.create(validModule())).rejects.toThrow();
  });

  it('allows same name for different users', async () => {
    const otherUser = new mongoose.Types.ObjectId();
    await Module.create(validModule());
    const doc = await Module.create(validModule({ userId: otherUser }));
    expect(doc.name).toBe('MUSE');
  });

  it('rejects missing name', async () => {
    await expect(Module.create(validModule({ name: undefined }))).rejects.toThrow();
  });

  it('rejects missing primary dimension', async () => {
    await expect(
      Module.create(validModule({ primaryDimension: undefined }))
    ).rejects.toThrow();
  });

  it('stores overrides on locations', async () => {
    const doc = await Module.create(
      validModule({
        name: 'AKRO',
        primaryDimension: {
          name: 'drawer',
          labeling: { type: 'numeric', startAt: 1 },
          values: [
            {
              label: '7',
              location: {
                label: '7',
                type: 'fixed',
                overrides: [
                  {
                    type: 'divide',
                    position: { row: 0, col: 0 },
                    method: 'subdivision',
                    subdivisionOptionName: '40716 front-rear divider',
                  },
                ],
                disabled: false,
                children: [leafLocation('front'), leafLocation('rear')],
              },
            },
          ],
        },
      })
    );
    const drawer7 = doc.primaryDimension.values[0].location;
    expect(drawer7.overrides).toHaveLength(1);
    expect(drawer7.overrides[0].type).toBe('divide');
  });

  it('stores disable state on locations', async () => {
    const doc = await Module.create(
      validModule({
        name: 'DISABLED',
        primaryDimension: {
          name: 'slot',
          labeling: { type: 'numeric', startAt: 1 },
          values: [
            {
              label: '1',
              location: {
                label: '1',
                type: 'leaf',
                overrides: [],
                disabled: true,
                disableReason: 'cracked drawer',
                children: [],
              },
            },
          ],
        },
      })
    );
    const loc = doc.primaryDimension.values[0].location;
    expect(loc.disabled).toBe(true);
    expect(loc.disableReason).toBe('cracked drawer');
  });

  it('stores template reference on location', async () => {
    const templateId = new mongoose.Types.ObjectId();
    const doc = await Module.create(
      validModule({
        name: 'TEMPLATED',
        primaryDimension: {
          name: 'drawer',
          labeling: { type: 'numeric', startAt: 1 },
          values: [
            {
              label: '3',
              location: {
                label: '3',
                type: 'fixed',
                templateId,
                templateRows: 6,
                templateCols: 4,
                overrides: [],
                disabled: false,
                children: [],
              },
            },
          ],
        },
      })
    );
    const loc = doc.primaryDimension.values[0].location;
    expect(loc.templateId?.toString()).toBe(templateId.toString());
    expect(loc.templateRows).toBe(6);
    expect(loc.templateCols).toBe(4);
  });

  it('supports custom labels on locations', async () => {
    const doc = await Module.create(
      validModule({
        name: 'LABELED',
        primaryDimension: {
          name: 'level',
          labeling: { type: 'numeric', startAt: 1 },
          values: [
            {
              label: '10',
              location: {
                label: '10',
                type: 'leaf',
                customLabel: 'Construction Screws',
                overrides: [],
                disabled: false,
                children: [],
              },
            },
          ],
        },
      })
    );
    expect(doc.primaryDimension.values[0].location.customLabel).toBe('Construction Screws');
  });

  it('stores extensible metadata', async () => {
    const doc = await Module.create(
      validModule({
        name: 'META',
        metadata: { color: 'red', location: 'workshop wall A' },
      })
    );
    expect(doc.metadata.get('color')).toBe('red');
  });
});
