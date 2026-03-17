/**
 * Reusable seed fixtures for exercise scenarios.
 * These call repositories directly (no AI, no handlers) for speed and determinism.
 */

import { Types } from 'mongoose';
import { templateRepository } from '@/repositories/templateRepository';
import { moduleRepository } from '@/repositories/moduleRepository';
import { insertRepository } from '@/repositories/insertRepository';
import { itemRepository } from '@/repositories/itemRepository';
import { assignmentRepository } from '@/repositories/assignmentRepository';
import type { Context } from './types';

// Helper: generate insert locations from a grid spec (same logic as toolHandlers)
function generateLabel(
  labeling: { type: string; startAt?: number; labels?: string[] },
  index: number,
): string {
  switch (labeling.type) {
    case 'numeric': return String((labeling.startAt ?? 1) + index);
    case 'alpha': return String.fromCharCode(65 + index);
    case 'custom': return labeling.labels?.[index] ?? String(index);
    default: return String(index);
  }
}

function generateLocations(rows: number, cols: number) {
  const locations = [];
  for (let r = 0; r < rows; r++) {
    const rowLabel = String.fromCharCode(65 + r); // A, B, C...
    for (let c = 0; c < cols; c++) {
      const colLabel = String(c + 1); // 1, 2, 3...
      locations.push({
        label: `${rowLabel},${colLabel}`,
        disabled: false,
        children: [],
      });
    }
  }
  return locations;
}

// ── Fixtures ─────────────────────────────────────────────────────

/** Simple module with 3 leaf levels, no inserts */
export async function simpleModule(userId: string): Promise<Context> {
  const uid = new Types.ObjectId(userId);
  const mod = await moduleRepository.create({
    name: 'MUSE',
    userId: uid,
    primaryDimension: {
      name: 'level',
      labeling: { type: 'numeric', startAt: 1 },
      values: [
        { label: '1', location: { label: '1', type: 'leaf' } },
        { label: '2', location: { label: '2', type: 'leaf' } },
        { label: '3', location: { label: '3', type: 'leaf' } },
      ],
    },
  });

  return { moduleId: mod._id.toString(), moduleName: 'MUSE' };
}

/** MUSE module with Plano 3600 template, insert in level 2, sample items */
export async function museWithPlano(userId: string): Promise<Context> {
  const uid = new Types.ObjectId(userId);

  // 1. Create Plano 3600 template (4 rows x 6 cols)
  const template = await templateRepository.create({
    name: 'Plano Stowaway 3600',
    kind: 'fixed',
    userId: uid,
    rows: 4,
    cols: 6,
    rowLabeling: { type: 'alpha' },
    colLabeling: { type: 'numeric', startAt: 1 },
  });

  // 2. Create MUSE module with 5 levels (level 2 = receptacle for insert)
  const mod = await moduleRepository.create({
    name: 'MUSE',
    userId: uid,
    primaryDimension: {
      name: 'level',
      labeling: { type: 'numeric', startAt: 1 },
      values: [
        { label: '1', location: { label: '1', type: 'leaf' } },
        { label: '2', location: { label: '2', type: 'receptacle' } },
        { label: '3', location: { label: '3', type: 'leaf' } },
        { label: '4', location: { label: '4', type: 'leaf' } },
        { label: '5', location: { label: '5', type: 'leaf' } },
      ],
    },
  });

  // 3. Create insert from template, place in level 2
  const locations = generateLocations(4, 6);
  const insert = await insertRepository.create({
    name: 'Plano 3600',
    userId: uid,
    templateId: template._id as Types.ObjectId,
    footprint: { rows: 1, cols: 1 },
    locations,
    moduleId: mod._id,
    locationPath: ['2'],
  });

  // 4. Create sample items
  const item1 = await itemRepository.create({
    name: 'M10 washer',
    userId: uid,
    parameters: [{ key: 'thread_size', value: 'M10' }, { key: 'material', value: 'steel' }],
  });
  const item2 = await itemRepository.create({
    name: '10k resistor',
    userId: uid,
    parameters: [{ key: 'resistance', value: '10k', unit: 'ohm' }],
  });

  // 5. Assign item1 to cell A,1 in insert
  const assignment = await assignmentRepository.create({
    userId: uid,
    itemId: item1._id,
    moduleId: mod._id,
    locationPath: ['2'],
    insertId: insert._id,
    insertLocationPath: ['A,1'],
  });

  return {
    moduleId: mod._id.toString(),
    moduleName: 'MUSE',
    templateId: template._id!.toString(),
    templateName: 'Plano Stowaway 3600',
    insertId: insert._id.toString(),
    insertName: 'Plano 3600',
    item1Id: item1._id.toString(),
    item1Name: 'M10 washer',
    item2Id: item2._id.toString(),
    item2Name: '10k resistor',
    assignmentId: assignment._id.toString(),
  };
}

/** Duplicate items for merge testing — 3 "M10 washer" items, one assigned */
export async function duplicateItems(userId: string): Promise<Context> {
  const uid = new Types.ObjectId(userId);

  const mod = await moduleRepository.create({
    name: 'MUSE',
    userId: uid,
    primaryDimension: {
      name: 'level',
      labeling: { type: 'numeric', startAt: 1 },
      values: [
        { label: '1', location: { label: '1', type: 'leaf' } },
        { label: '2', location: { label: '2', type: 'leaf' } },
      ],
    },
  });

  const item1 = await itemRepository.create({
    name: 'M10 washer',
    userId: uid,
    description: 'Steel washer with a bright finish',
    parameters: [{ key: 'material', value: 'steel' }, { key: 'finish', value: 'bright' }],
  });
  const item2 = await itemRepository.create({
    name: 'M10 washer',
    userId: uid,
    parameters: [{ key: 'material', value: 'steel' }, { key: 'finish', value: 'bright' }],
  });
  const item3 = await itemRepository.create({
    name: 'M10 washer, steel, bright finish',
    userId: uid,
    description: 'Standard dimensions',
    parameters: [{ key: 'material', value: 'steel' }, { key: 'finish', value: 'bright' }, { key: 'size', value: 'M10' }],
  });

  // Assign item2 to level 1
  const assignment = await assignmentRepository.create({
    userId: uid,
    itemId: item2._id,
    moduleId: mod._id,
    locationPath: ['1'],
  });

  return {
    moduleId: mod._id.toString(),
    moduleName: 'MUSE',
    item1Id: item1._id.toString(),
    item2Id: item2._id.toString(),
    item3Id: item3._id.toString(),
    assignmentId: assignment._id.toString(),
  };
}

/** Items only, no module or assignments */
export async function itemsOnly(userId: string): Promise<Context> {
  const uid = new Types.ObjectId(userId);
  const item1 = await itemRepository.create({
    name: 'M3x8 cap screw',
    userId: uid,
    parameters: [{ key: 'thread_size', value: 'M3' }, { key: 'length_mm', value: '8', unit: 'mm' }],
  });
  const item2 = await itemRepository.create({
    name: '100nF capacitor',
    userId: uid,
    parameters: [{ key: 'capacitance', value: '100nF' }],
  });

  return {
    item1Id: item1._id.toString(),
    item1Name: 'M3x8 cap screw',
    item2Id: item2._id.toString(),
    item2Name: '100nF capacitor',
  };
}
