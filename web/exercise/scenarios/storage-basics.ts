/**
 * Storage basics: module creation, template, insert placement.
 */

import type { Scenario } from '../types';
import { simpleModule, museWithPlano } from '../seed';

export const storageBasicsScenarios: Scenario[] = [
  {
    name: 'Create a module with levels',
    level: 'handler',
    tags: ['storage', 'module'],
    handlerSteps: [
      {
        handler: 'modules.create',
        args: {
          name: 'ALEX',
          primaryDimension: {
            name: 'drawer',
            labeling: { type: 'numeric', startAt: 1 },
            values: [
              { label: '1', location: { label: '1', type: 'leaf' } },
              { label: '2', location: { label: '2', type: 'leaf' } },
              { label: '3', location: { label: '3', type: 'leaf' } },
            ],
          },
        },
        storeAs: 'module',
      },
    ],
    assertions: [
      { type: 'resultNotError' },
      { type: 'dbQuery', collection: 'modules', query: { name: 'ALEX' }, expect: 'exists' },
    ],
  },

  {
    name: 'Create a template',
    level: 'handler',
    tags: ['storage', 'template'],
    handlerSteps: [
      {
        handler: 'templates.create',
        args: {
          name: 'Plano Stowaway 3600',
          kind: 'fixed',
          rows: 4,
          cols: 6,
          rowLabeling: { type: 'alpha' },
          colLabeling: { type: 'numeric', startAt: 1 },
        },
        storeAs: 'template',
      },
    ],
    assertions: [
      { type: 'resultNotError' },
      { type: 'dbQuery', collection: 'templates', query: { name: 'Plano Stowaway 3600' }, expect: 'exists' },
    ],
  },

  {
    name: 'Create and place an insert from template',
    level: 'handler',
    tags: ['storage', 'insert'],
    seed: { setup: museWithPlano },
    handlerSteps: [
      {
        handler: 'inserts.create',
        args: (ctx) => ({
          name: 'Second Plano',
          templateId: ctx.templateId,
          footprint: { rows: 1, cols: 1 },
        }),
        storeAs: 'newInsert',
      },
      {
        handler: 'inserts.place',
        args: (ctx) => ({
          insertId: (ctx.newInsert as Record<string, unknown>).id,
          moduleId: ctx.moduleId,
          locationPath: ['3'],
        }),
      },
    ],
    assertions: [
      { type: 'resultNotError' },
      {
        type: 'custom',
        name: 'insert has generated locations',
        fn: (_result, ctx) => {
          const insert = ctx.newInsert as Record<string, unknown>;
          const locCount = insert.locations as number;
          if (!locCount || locCount === 0) return 'Insert has no locations — template was not expanded';
          if (locCount !== 24) return `Expected 24 locations (4x6), got ${locCount}`;
          return true;
        },
      },
    ],
  },

  {
    name: 'List modules returns existing modules',
    level: 'handler',
    tags: ['storage', 'module'],
    seed: { setup: simpleModule },
    handlerSteps: [
      { handler: 'modules.list', args: {} },
    ],
    assertions: [
      {
        type: 'custom',
        name: 'list contains MUSE',
        fn: (result) => {
          const arr = result as unknown[];
          if (!Array.isArray(arr) || arr.length === 0) return 'Expected at least 1 module';
          const names = arr.map((m) => (m as Record<string, unknown>).name);
          return names.includes('MUSE') ? true : `Module list missing MUSE: ${names.join(', ')}`;
        },
      },
    ],
  },

  {
    name: 'Get module by name',
    level: 'handler',
    tags: ['storage', 'module'],
    seed: { setup: simpleModule },
    handlerSteps: [
      { handler: 'modules.get', args: { name: 'MUSE' } },
    ],
    assertions: [
      { type: 'resultNotError' },
      { type: 'resultField', path: 'name', value: 'MUSE' },
    ],
  },

  {
    name: 'Get module by moduleId param alias',
    level: 'handler',
    tags: ['storage', 'module', 'edge-case'],
    seed: { setup: simpleModule },
    handlerSteps: [
      { handler: 'modules.get', args: (ctx) => ({ moduleId: ctx.moduleId }) },
    ],
    assertions: [
      { type: 'resultNotError' },
      { type: 'resultField', path: 'name', value: 'MUSE' },
    ],
  },

  {
    name: 'Inspect location shows assignments',
    level: 'handler',
    tags: ['storage', 'inspect'],
    seed: { setup: museWithPlano },
    handlerSteps: [
      { handler: 'assignments.inspectLocation', args: { moduleName: 'MUSE', path: ['2'] } },
    ],
    assertions: [
      { type: 'resultNotError' },
      { type: 'resultField', path: 'module', value: 'MUSE' },
      {
        type: 'custom',
        name: 'has assignments',
        fn: (result) => {
          const r = result as Record<string, unknown>;
          return (r.totalAssignments as number) > 0 ? true : 'Expected at least 1 assignment at MUSE level 2';
        },
      },
    ],
  },
];
