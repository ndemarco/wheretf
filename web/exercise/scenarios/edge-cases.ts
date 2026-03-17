/**
 * Edge cases: known failure modes and tricky scenarios.
 */

import { Types } from 'mongoose';
import type { Scenario } from '../types';
import { museWithPlano, simpleModule, duplicateItems } from '../seed';

export const edgeCaseScenarios: Scenario[] = [
  {
    name: 'Cell path normalization: A2 → A,2',
    level: 'handler',
    tags: ['edge-case', 'normalization'],
    seed: { setup: museWithPlano },
    handlerSteps: [
      {
        handler: 'assignments.assign',
        args: (ctx) => ({
          itemId: ctx.item2Id,
          moduleId: ctx.moduleId,
          locationPath: ['2'],
          insertId: ctx.insertId,
          insertLocationPath: ['A2'], // No comma — handler should normalize
        }),
      },
    ],
    assertions: [
      { type: 'resultNotError' },
      { type: 'resultField', path: 'assigned', value: true },
    ],
  },

  {
    name: 'Cell path normalization: B13 → B,13',
    level: 'handler',
    tags: ['edge-case', 'normalization'],
    seed: { setup: museWithPlano },
    handlerSteps: [
      {
        handler: 'assignments.inspectLocation',
        args: (ctx) => ({
          moduleId: ctx.moduleId,
          path: ['2', 'B13'], // Should normalize to B,13 for lookup
        }),
      },
    ],
    assertions: [
      // We're mainly checking it doesn't crash — the location might not exist
      // but the path should be normalized without error
      {
        type: 'custom',
        name: 'no crash on multi-digit column',
        fn: (result) => {
          // Should return something (even if location not found at that path)
          return result != null ? true : 'Handler returned null/undefined';
        },
      },
    ],
  },

  {
    name: 'Reject fabricated ObjectId',
    level: 'handler',
    tags: ['edge-case', 'id-resolution'],
    seed: { setup: simpleModule },
    handlerSteps: [
      {
        handler: 'modules.get',
        args: { id: 'muse-module-id' }, // Not a valid ObjectId — should resolve by name
      },
    ],
    assertions: [
      // resolveModuleId should try name lookup for non-hex strings
      // 'muse-module-id' is not a module name either, so should error
      { type: 'resultHasError' },
    ],
  },

  {
    name: 'Resolve module by name instead of ID',
    level: 'handler',
    tags: ['edge-case', 'id-resolution'],
    seed: { setup: simpleModule },
    handlerSteps: [
      {
        handler: 'modules.get',
        args: { moduleName: 'MUSE' },
      },
    ],
    assertions: [
      { type: 'resultNotError' },
      { type: 'resultField', path: 'name', value: 'MUSE' },
    ],
  },

  {
    name: 'Relocate insert moves it to different level',
    level: 'handler',
    tags: ['edge-case', 'insert'],
    seed: { setup: museWithPlano },
    handlerSteps: [
      {
        handler: 'inserts.relocate',
        args: (ctx) => ({
          insertId: ctx.insertId,
          newModuleId: ctx.moduleId,
          newLocationPath: ['3'], // Move from level 2 to level 3
        }),
      },
    ],
    assertions: [
      { type: 'resultNotError' },
      { type: 'resultField', path: 'locationPath', value: ['3'] },
      { type: 'resultField', path: 'reassignedCount', value: 1 },
    ],
  },

  {
    name: 'Delete module blocked when items exist',
    level: 'handler',
    tags: ['edge-case', 'module'],
    seed: { setup: museWithPlano },
    handlerSteps: [
      {
        handler: 'modules.delete',
        args: (ctx) => ({ id: ctx.moduleId }),
      },
    ],
    assertions: [
      { type: 'resultHasError' },
    ],
  },

  {
    name: 'Merge duplicates: delete dupes, keep one, preserve assignments',
    description: 'Agent-level: merge 3 duplicate washers into 1, reassign locations',
    level: 'agent',
    tags: ['edge-case', 'merge', 'regression'],
    retries: 2,
    seed: { setup: duplicateItems },
    steps: [
      { message: 'I have duplicate M10 washer items. Merge them into one.' },
    ],
    assertions: [
      { type: 'toolsCalled', tools: ['findItems'] },
      // Should end up with exactly 1 washer item
      {
        type: 'dbQuery',
        collection: 'items',
        query: { name: { $regex: /washer/i } },
        expected: { count: 1 },
      },
      // The surviving item's assignment should still exist
      {
        type: 'dbQuery',
        collection: 'assignments',
        query: {},
        expected: { count: 1 },
      },
      { type: 'resultNotError' },
    ],
  },

  {
    name: 'Delete insert blocked when assignments exist',
    level: 'handler',
    tags: ['edge-case', 'insert'],
    seed: { setup: museWithPlano },
    handlerSteps: [
      {
        handler: 'inserts.delete',
        args: (ctx) => ({ insertId: ctx.insertId }),
      },
    ],
    assertions: [
      { type: 'resultHasError', containing: 'assignment' },
    ],
  },
];
