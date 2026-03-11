/**
 * Dev server with in-memory MongoDB.
 * Usage: npx tsx scripts/dev-memory-db.mts
 *
 * Starts a MongoMemoryServer instance, sets MONGODB_URI, then runs `next dev`.
 * Data does not persist across restarts — this is for testing tool behavior only.
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'child_process';

async function main() {
  console.log('Starting in-memory MongoDB...');
  const mongod = await MongoMemoryServer.create();
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
