#!/usr/bin/env tsx
/**
 * Exercise harness CLI entry point.
 *
 * Usage:
 *   npm run exercise                      # handler-level (fast, free)
 *   npm run exercise:agent                # agent-level (requires OPENAI_API_KEY)
 *   npm run exercise -- --verbose         # verbose output
 *   npm run exercise -- "cell format"     # filter by name
 *   npm run exercise -- --tag edge-case   # filter by tag
 *   npm run exercise:captures             # replay downvoted captures (agent-level)
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { register } from 'tsconfig-paths';
import path from 'path';
import { fileURLToPath } from 'url';

// Register path aliases so @/ imports work
const __dirname = path.dirname(fileURLToPath(import.meta.url));
register({
  baseUrl: path.resolve(__dirname, '..'),
  paths: { '@/*': ['./*'] },
});

import { allScenarios } from './scenarios/index.js';
import { runScenarios } from './runner.js';
import { printReport } from './reporter.js';
import type { RunOptions } from './types.js';

async function main() {
  const args = process.argv.slice(2);
  const isCaptures = args.includes('--captures');
  const level = (args.includes('--agent') || isCaptures) ? 'agent' : 'handler';
  const verbose = args.includes('--verbose') || args.includes('-v');

  // Extract filter (first non-flag argument)
  const filter = args.find((a) => !a.startsWith('--') && !a.startsWith('-'));

  // Extract tag filter
  const tagIdx = args.indexOf('--tag');
  const tags = tagIdx >= 0 && args[tagIdx + 1] ? [args[tagIdx + 1]] : undefined;

  // Extract max retries
  const retryIdx = args.indexOf('--retries');
  const maxRetries = retryIdx >= 0 ? parseInt(args[retryIdx + 1], 10) : undefined;

  if (level === 'agent' && !process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY is required for agent-level exercise');
    console.error('Run with handler-level (default) or set the env var.');
    process.exit(1);
  }

  // Start in-memory MongoDB
  console.log('Starting in-memory MongoDB...');
  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri);
  console.log('MongoDB ready.\n');

  // If --captures flag, auto-filter to only captured scenarios
  const effectiveTags = isCaptures ? ['captured'] : tags;
  const options: RunOptions = { level: level as 'handler' | 'agent', filter, tags: effectiveTags, verbose, maxRetries };

  try {
    const results = await runScenarios(allScenarios, options);
    printReport(results, verbose);

    const allPassed = results.every((r) => r.passed);
    await mongoose.disconnect();
    await mongo.stop();
    process.exit(allPassed ? 0 : 1);
  } catch (err) {
    console.error('Fatal error:', err);
    await mongoose.disconnect();
    await mongo.stop();
    process.exit(2);
  }
}

main();
