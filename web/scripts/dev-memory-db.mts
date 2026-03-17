/**
 * Dev server with file-backed MongoDB.
 * Usage: npx tsx scripts/dev-memory-db.mts
 *
 * Starts a MongoMemoryServer instance with persistent storage, sets MONGODB_URI,
 * then runs `next dev`. Data persists across restarts in .data/mongodb.
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'child_process';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

async function main() {
  const dbPath = resolve(import.meta.dirname, '..', '.data', 'mongodb');
  mkdirSync(dbPath, { recursive: true });

  console.log(`Starting MongoDB (data: ${dbPath})...`);
  const mongod = await MongoMemoryServer.create({
    instance: { dbPath, storageEngine: 'wiredTiger' },
  });
  const uri = mongod.getUri();
  console.log(`MongoDB ready at ${uri}`);

  // Set for the child process
  process.env.MONGODB_URI = uri;

  console.log('Starting Next.js dev server...\n');
  const child = spawn('npx', ['next', 'dev'], {
    stdio: 'inherit',
    env: { ...process.env, MONGODB_URI: uri },
  });

  // Clean shutdown
  const cleanup = async () => {
    console.log('\nShutting down...');
    child.kill('SIGTERM');
    await mongod.stop();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  child.on('exit', async (code) => {
    await mongod.stop();
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
