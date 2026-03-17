/**
 * Inventory basics: item CRUD, assign, move, find.
 */

import type { Scenario } from '../types';
import { museWithPlano, itemsOnly } from '../seed';

export const inventoryBasicsScenarios: Scenario[] = [
  {
    name: 'Create an item',
    level: 'handler',
    tags: ['inventory', 'item'],
    handlerSteps: [
      {
        handler: 'items.create',
        args: {
          name: 'M5 hex nut',
          parameters: [{ key: 'thread_size', value: 'M5' }, { key: 'material', value: 'stainless' }],
        },
        storeAs: 'item',
      },
    ],
    assertions: [
      { type: 'resultNotError' },
      { type: 'dbQuery', collection: 'items', query: { name: 'M5 hex nut' }, expect: 'exists' },
    ],
  },

  {
    name: 'Find items by search query',
    level: 'handler',
    tags: ['inventory', 'item'],
    seed: { setup: museWithPlano },
    handlerSteps: [
      { handler: 'items.find', args: { name: 'washer' } },
    ],
    assertions: [
      {
        type: 'custom',
        name: 'found M10 washer',
        fn: (result) => {
          const items = result as Record<string, unknown>[];
          if (!Array.isArray(items) || items.length === 0) return 'No items found for "washer"';
          const names = items.map((i) => i.name);
          return names.some((n) => String(n).includes('washer')) ? true : `No washer in results: ${names.join(', ')}`;
        },
      },
    ],
  },

  {
    name: 'Assign item to module location',
    level: 'handler',
    tags: ['inventory', 'assignment'],
    seed: { setup: museWithPlano },
    handlerSteps: [
      {
        handler: 'assignments.assign',
        args: (ctx) => ({
          itemId: ctx.item2Id,
          moduleId: ctx.moduleId,
          locationPath: ['1'],
        }),
        storeAs: 'assignment',
      },
    ],
    assertions: [
      { type: 'resultNotError' },
      { type: 'resultField', path: 'assigned', value: true },
      { type: 'resultField', path: 'verified', value: true },
    ],
  },

  {
    name: 'Assign item to insert cell with normalized path',
    level: 'handler',
    tags: ['inventory', 'assignment', 'edge-case'],
    seed: { setup: museWithPlano },
    handlerSteps: [
      {
        handler: 'assignments.assign',
        args: (ctx) => ({
          itemId: ctx.item2Id,
          moduleId: ctx.moduleId,
          locationPath: ['2'],
          insertId: ctx.insertId,
          insertLocationPath: ['B3'], // Should normalize to B,3
        }),
        storeAs: 'assignment',
      },
    ],
    assertions: [
      { type: 'resultNotError' },
      { type: 'resultField', path: 'assigned', value: true },
    ],
  },

  {
    name: 'Move item between cells (moveItem not relocateInsert)',
    level: 'handler',
    tags: ['inventory', 'assignment', 'edge-case'],
    seed: { setup: museWithPlano },
    handlerSteps: [
      {
        handler: 'assignments.move',
        args: (ctx) => ({
          assignmentId: ctx.assignmentId,
          newModuleId: ctx.moduleId,
          newLocationPath: ['2'],
          newInsertId: ctx.insertId,
          newInsertLocationPath: ['A,2'],
        }),
      },
    ],
    assertions: [
      { type: 'resultNotError' },
      { type: 'resultField', path: 'moved', value: true },
    ],
  },

  {
    name: 'Find item locations',
    level: 'handler',
    tags: ['inventory', 'assignment'],
    seed: { setup: museWithPlano },
    handlerSteps: [
      { handler: 'assignments.findByItem', args: (ctx) => ({ itemId: ctx.item1Id }) },
    ],
    assertions: [
      { type: 'resultField', path: 'totalLocations', value: 1 },
    ],
  },

  {
    name: 'Find unassigned items',
    level: 'handler',
    tags: ['inventory', 'assignment'],
    seed: { setup: museWithPlano },
    handlerSteps: [
      { handler: 'assignments.findUnassigned', args: {} },
    ],
    assertions: [
      {
        type: 'custom',
        name: 'item2 is unassigned',
        fn: (result, ctx) => {
          const r = result as Record<string, unknown>;
          const items = r.items as Record<string, unknown>[];
          if (!items) return 'No items field in result';
          const names = items.map((i) => String(i.name));
          return names.includes(ctx.item2Name as string)
            ? true
            : `Expected "${ctx.item2Name}" in unassigned list: ${names.join(', ')}`;
        },
      },
    ],
  },

  {
    name: 'Block double-assignment to same location',
    level: 'handler',
    tags: ['inventory', 'assignment', 'edge-case'],
    seed: { setup: museWithPlano },
    handlerSteps: [
      {
        handler: 'assignments.assign',
        args: (ctx) => ({
          itemId: ctx.item2Id,
          moduleId: ctx.moduleId,
          locationPath: ['2'],
          insertId: ctx.insertId,
          insertLocationPath: ['A,1'], // Already occupied by item1
        }),
      },
    ],
    assertions: [
      { type: 'resultHasError', containing: 'occupied' },
    ],
  },
];
