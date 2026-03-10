import dbConnect from '@/lib/mongodb';
import { seedTools } from './tools';
import { seedAgents } from './agents';

export { seedTools } from './tools';
export { seedAgents } from './agents';

// Cache to track which seeds have been completed this process lifetime
let globalSeeded = false;
const userSeededCache = new Set<string>();

/**
 * Seed global data (tools)
 * Only runs once per server lifetime - cached in memory
 */
export async function seedGlobalDefaults(): Promise<void> {
  if (globalSeeded) {
    return;
  }

  await dbConnect();
  await seedTools();

  globalSeeded = true;
}

/**
 * Ensure user's system agents are up to date
 * In development, always re-seed to pick up instruction changes
 * In production, cached per-user
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
 * Force re-seed on next request
 */
export function invalidateSeedCache(): void {
  globalSeeded = false;
  userSeededCache.clear();
}
