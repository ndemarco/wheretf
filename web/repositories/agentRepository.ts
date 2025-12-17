import Agent, { IAgent } from '@/models/Agent';
import dbConnect from '@/lib/mongodb';

export interface CreateAgentInput {
  userId: string;
  name: string;
  displayName?: string;
  description?: string;
  instructions: string;
  aiModel?: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo';
  tools?: string[];
  temperature?: number;
  isRouter?: boolean;
  isSystem?: boolean;
}

export interface UpdateAgentInput {
  userId: string;
  name: string;
  updates: Partial<Omit<CreateAgentInput, 'userId' | 'name'>>;
}

export async function create(input: CreateAgentInput): Promise<IAgent> {
  await dbConnect();

  const existing = await Agent.findOne({
    user: input.userId,
    name: input.name.toLowerCase(),
  });
  if (existing) {
    throw new Error(`Agent "${input.name}" already exists`);
  }

  const agent = await Agent.create({
    user: input.userId,
    name: input.name,
    displayName: input.displayName,
    description: input.description,
    instructions: input.instructions,
    aiModel: input.aiModel || 'gpt-4o',
    tools: input.tools || [],
    temperature: input.temperature ?? 0.7,
    isRouter: input.isRouter || false,
    isSystem: input.isSystem || false,
    active: true,
  });

  return agent;
}

export async function findByName(userId: string, name: string): Promise<IAgent | null> {
  await dbConnect();
  return Agent.findOne({ user: userId, name: name.toLowerCase() });
}

export async function findRouter(userId: string): Promise<IAgent | null> {
  await dbConnect();
  return Agent.findOne({ user: userId, isRouter: true, active: true });
}

export async function list(userId: string): Promise<IAgent[]> {
  await dbConnect();
  return Agent.find({ user: userId }).sort({ name: 1 });
}

export async function listActive(userId: string): Promise<IAgent[]> {
  await dbConnect();
  return Agent.find({ user: userId, active: true }).sort({ name: 1 });
}

export async function update(input: UpdateAgentInput): Promise<IAgent> {
  await dbConnect();

  const agent = await Agent.findOne({
    user: input.userId,
    name: input.name.toLowerCase(),
  });
  if (!agent) {
    throw new Error(`Agent "${input.name}" not found`);
  }

  Object.assign(agent, input.updates);
  await agent.save();

  return agent;
}

export async function remove(userId: string, name: string): Promise<{ success: boolean }> {
  await dbConnect();

  const agent = await Agent.findOne({ user: userId, name: name.toLowerCase() });
  if (!agent) {
    throw new Error(`Agent "${name}" not found`);
  }

  if (agent.isSystem) {
    throw new Error(`Cannot delete system agent "${name}"`);
  }

  await Agent.deleteOne({ user: userId, name: name.toLowerCase() });
  return { success: true };
}

export async function toggleActive(
  userId: string,
  name: string
): Promise<IAgent> {
  await dbConnect();

  const agent = await Agent.findOne({ user: userId, name: name.toLowerCase() });
  if (!agent) {
    throw new Error(`Agent "${name}" not found`);
  }

  agent.active = !agent.active;
  await agent.save();

  return agent;
}

/**
 * Reset a system agent to its default configuration
 */
export async function resetToDefault(
  userId: string,
  name: string,
  defaults: Partial<CreateAgentInput>
): Promise<IAgent> {
  await dbConnect();

  const agent = await Agent.findOne({ user: userId, name: name.toLowerCase() });
  if (!agent) {
    throw new Error(`Agent "${name}" not found`);
  }

  if (!agent.isSystem) {
    throw new Error(`Agent "${name}" is not a system agent`);
  }

  Object.assign(agent, defaults);
  await agent.save();

  return agent;
}

/**
 * Upsert an agent - create if not exists, skip if exists
 */
export async function upsertDefault(input: CreateAgentInput): Promise<IAgent> {
  await dbConnect();

  const result = await Agent.findOneAndUpdate(
    { user: input.userId, name: input.name.toLowerCase() },
    { $setOnInsert: { ...input, name: input.name.toLowerCase() } },
    { upsert: true, new: true }
  );

  return result;
}
