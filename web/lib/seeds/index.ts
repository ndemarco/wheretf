import dbConnect from '@/lib/mongodb';
import { seedParameterKeys } from './parameters';
import { seedUnits } from './units';
import { seedTools } from './tools';
import { seedAgents } from './agents';
import { seedTemplates } from './templates';

export { seedParameterKeys } from './parameters';
export { seedUnits } from './units';
export { seedTools } from './tools';
export { seedAgents } from './agents';
export { seedTemplates } from './templates';

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
  await seedTemplates();

  // Per-user data
  await seedAgents(userId);

  console.log('Seed process complete!');
}

/**
 * Seed global data only (tools, parameters, units, templates)
 * Call this on app startup
 */
export async function seedGlobalDefaults(): Promise<void> {
  await dbConnect();

  console.log('Seeding global defaults...');

  await seedTools();
  await seedParameterKeys();
  await seedUnits();
  await seedTemplates();

  console.log('Global seed complete!');
}

/**
 * Check if user needs seeding and seed if necessary
 */
export async function ensureUserSeeded(userId: string): Promise<void> {
  await dbConnect();

  // Import here to avoid circular dependencies
  const { agentRepository } = await import('@/repositories');

  // Check if user has agents
  const agents = await agentRepository.list(userId);

  if (agents.length === 0) {
    console.log(`User ${userId} needs seeding...`);
    await seedAgents(userId);
  }
}
