/**
 * Agent-level routing scenarios.
 * These require OPENAI_API_KEY and cost API credits.
 */

import type { Scenario } from '../types';
import { museWithPlano } from '../seed';

export const routingScenarios: Scenario[] = [
  {
    name: 'Router delegates module creation to storage agent',
    level: 'agent',
    tags: ['routing', 'storage'],
    steps: [{ message: 'Create a module called WORKBENCH with 3 shelves' }],
    retries: 2,
    assertions: [
      { type: 'agentUsed', agent: 'storage' },
      { type: 'dbQuery', collection: 'modules', query: { name: 'WORKBENCH' }, expect: 'exists' },
    ],
  },

  {
    name: 'Router delegates item search to inventory agent',
    level: 'agent',
    tags: ['routing', 'inventory'],
    seed: { setup: museWithPlano },
    steps: [{ message: 'Where are my M10 washers?' }],
    retries: 2,
    assertions: [
      { type: 'agentUsed', agent: 'inventory' },
      { type: 'toolsCalled', tools: ['findItems'], mode: 'includes' },
    ],
  },

  {
    name: 'Router delegates inspect to storage agent',
    level: 'agent',
    tags: ['routing', 'storage'],
    seed: { setup: museWithPlano },
    steps: [{ message: "What's in MUSE level 2?" }],
    retries: 2,
    assertions: [
      { type: 'agentUsed', agent: 'storage' },
      { type: 'toolsCalled', tools: ['inspectLocation'], mode: 'includes' },
    ],
  },

  {
    name: 'Agent uses real IDs, not fabricated ones',
    level: 'agent',
    tags: ['routing', 'edge-case'],
    seed: { setup: museWithPlano },
    steps: [{ message: 'Assign the 10k resistor to MUSE level 2 cell B3' }],
    retries: 2,
    assertions: [
      // Should look up the item first, not guess an ID
      { type: 'toolsCalled', tools: ['findItems'], mode: 'includes' },
      { type: 'resultNotError' },
    ],
  },

  {
    name: 'Agent response has no filler closing phrases',
    level: 'agent',
    tags: ['routing', 'communication', 'regression'],
    seed: { setup: museWithPlano },
    steps: [{ message: 'What washers do I have?' }],
    retries: 2,
    assertions: [
      { type: 'agentUsed', agent: 'inventory' },
      { type: 'responseNotContains', text: 'let me know' },
      { type: 'responseNotContains', text: 'feel free' },
      { type: 'responseNotContains', text: 'anything else' },
      { type: 'responseNotContains', text: 'further assistance' },
      { type: 'responseNotContains', text: 'would you like' },
    ],
  },

  {
    name: 'Multi-turn: create module then add insert',
    level: 'agent',
    tags: ['routing', 'multi-turn'],
    multiTurn: true,
    retries: 2,
    steps: [
      { message: 'Create a module called PEGBOARD with 4 levels' },
      { message: 'Add a Plano 3600 box to level 2' },
    ],
    assertions: [
      { type: 'dbQuery', collection: 'modules', query: { name: 'PEGBOARD' }, expect: 'exists' },
      { type: 'dbQuery', collection: 'inserts', query: { name: /plano/i as unknown as string }, expect: 'exists' },
    ],
  },
];
