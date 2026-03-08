import dbConnect from '@/lib/mongodb';
import { seedParameterKeys } from './parameters';
import { seedUnits } from './units';
import { seedTools } from './tools';
import { seedAgents } from './agents';
import { seedStorageTypes } from './storageTypes';

export { seedParameterKeys } from './parameters';
export { seedUnits } from './units';
export { seedTools } from './tools';
export { seedAgents } from './agents';
export { seedStorageTypes } from './storageTypes';

// Cache to track which seeds have been completed this process lifetime
// Global defaults only need to run once per server start
let globalSeeded = false;
const userSeededCache = new Set<string>();

/**
 * Seed all default data for a user
 */
export async function seedDefaults(userId: string): Promise<void> {
  await dbConnect();

  console.log('Starting seed process...');

  // Global data (no userId)
  await seedTools();
  await seedParameterKeys();
  await seedUnits();
  await seedStorageTypes();

  // Per-user data
  await seedAgents(userId);

  console.log('Seed process complete!');
}

/**
 * Seed global data only (tools, parameters, units)
 * Only runs once per server lifetime - cached in memory
 */
export async function seedGlobalDefaults(): Promise<void> {
  if (globalSeeded) {
    return;
  }

  await dbConnect();

  console.log('Seeding global defaults...');

  await seedTools();
  await seedParameterKeys();
  await seedUnits();
  await seedStorageTypes();

  globalSeeded = true;
  console.log('Global seed complete!');
}

/**
 * Ensure user's system agents are up to date
 * In development, always re-seed to pick up instruction changes
 * In production, cached per-user - only runs once per user per server lifetime
 */
export async function ensureUserSeeded(userId: string): Promise<void> {
  const isDev = process.env.NODE_ENV === 'development';

  if (!isDev && userSeededCache.has(userId)) {
    return;
  }

  await dbConnect();
  await seedAgents(userId);
  userSeededCache.add(userId);
}

/**
 * Force re-seed on next request (useful after code updates)
 */
export function invalidateSeedCache(): void {
  globalSeeded = false;
  userSeededCache.clear();
}
