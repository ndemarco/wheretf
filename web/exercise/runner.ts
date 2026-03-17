/**
 * Core exercise runner.
 * Iterates scenarios: seed → execute → assert → report.
 */

import mongoose, { Types } from 'mongoose';
import { executeHandler } from '@/lib/toolHandlers';
import { checkAssertion } from './assertions';
import type { Scenario, ScenarioResult, RunOptions, Context, HandlerStep } from './types';

// Dynamically imported only for agent-level
let runChat: ((userId: string, message: string, images?: string[], history?: unknown[]) => Promise<unknown>) | null = null;
let clearAgentCaches: (() => void) | null = null;

async function loadAgentRunner() {
  if (!runChat) {
    const mod = await import('@/lib/agentRunner');
    runChat = mod.runChat;
    clearAgentCaches = mod.clearAgentCaches;
  }
}

async function clearAllCollections() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

async function seedAgentsAndTools(userId: string) {
  const { seedAgents } = await import('@/lib/seeds/agents');
  const { seedGlobalDefaults } = await import('@/lib/seeds');
  await seedGlobalDefaults();
  await seedAgents(userId);
}

async function runHandlerSteps(
  steps: HandlerStep[],
  userId: string,
  ctx: Context,
): Promise<{ lastResult: unknown; toolsCalled: string[] }> {
  const toolsCalled: string[] = [];
  let lastResult: unknown;

  for (const step of steps) {
    const args = typeof step.args === 'function' ? step.args(ctx) : step.args;
    try {
      lastResult = await executeHandler(step.handler, args, userId);
    } catch (err) {
      // Surface thrown errors as { error: message } so assertions can check them
      lastResult = { error: err instanceof Error ? err.message : String(err) };
    }
    toolsCalled.push(step.handler);

    if (step.storeAs && lastResult && typeof lastResult === 'object') {
      // Merge result into context
      const obj = lastResult as Record<string, unknown>;
      if (obj.id) ctx[`${step.storeAs}Id`] = obj.id.toString();
      ctx[step.storeAs] = lastResult;
    }
  }

  return { lastResult, toolsCalled };
}

async function runAgentSteps(
  scenario: Scenario,
  userId: string,
): Promise<{ lastResult: unknown; toolsCalled: string[]; agentUsed?: string }> {
  await loadAgentRunner();
  const allToolsCalled: string[] = [];
  let lastResult: unknown;
  let agentUsed: string | undefined;
  const history: unknown[] = [];

  for (const step of scenario.steps ?? []) {
    const result = await runChat!(userId, step.message, step.images, scenario.multiTurn ? history : undefined);
    lastResult = result;

    const agentResult = result as { agent?: string; toolCalls?: { name: string }[]; content?: string };
    if (agentResult.agent) agentUsed = agentResult.agent;
    if (agentResult.toolCalls) {
      for (const tc of agentResult.toolCalls) allToolsCalled.push(tc.name);
    }

    // Add to history for multi-turn
    if (scenario.multiTurn) {
      history.push({ role: 'user', content: step.message });
      history.push({ role: 'assistant', content: agentResult.content ?? '' });
    }
  }

  return { lastResult, toolsCalled: allToolsCalled, agentUsed };
}

async function runSingleAttempt(
  scenario: Scenario,
  level: 'handler' | 'agent',
  userId: string,
): Promise<{ passed: boolean; failureReason?: string; toolsCalled: string[]; agentUsed?: string }> {
  // Seed if needed
  let ctx: Context = {};
  if (scenario.seed) {
    ctx = await scenario.seed.setup(userId);
  }

  let execResult: { lastResult: unknown; toolsCalled: string[]; agentUsed?: string };

  if (level === 'handler') {
    execResult = await runHandlerSteps(scenario.handlerSteps ?? [], userId, ctx);
  } else {
    execResult = await runAgentSteps(scenario, userId);
  }

  // Run assertions
  for (const assertion of scenario.assertions) {
    const check = await checkAssertion(assertion, execResult.lastResult, ctx);
    if (!check.passed) {
      return {
        passed: false,
        failureReason: check.reason,
        toolsCalled: execResult.toolsCalled,
        agentUsed: execResult.agentUsed,
      };
    }
  }

  return {
    passed: true,
    toolsCalled: execResult.toolsCalled,
    agentUsed: execResult.agentUsed,
  };
}

export async function runScenarios(
  scenarios: Scenario[],
  options: RunOptions,
): Promise<ScenarioResult[]> {
  const results: ScenarioResult[] = [];
  const userId = new Types.ObjectId().toString();

  // Filter scenarios
  const filtered = scenarios.filter((s) => {
    // Level filter
    if (s.level !== 'both' && s.level !== options.level) return false;
    // Name/tag filter
    if (options.filter) {
      const f = options.filter.toLowerCase();
      const nameMatch = s.name.toLowerCase().includes(f);
      const tagMatch = s.tags?.some((t) => t.toLowerCase().includes(f));
      if (!nameMatch && !tagMatch) return false;
    }
    if (options.tags && options.tags.length > 0) {
      if (!s.tags || !options.tags.some((t) => s.tags!.includes(t))) return false;
    }
    return true;
  });

  console.log(`Running ${filtered.length} scenarios (${options.level} level)...\n`);

  for (const scenario of filtered) {
    const maxRetries = options.level === 'agent'
      ? (options.maxRetries ?? scenario.retries ?? 1)
      : 0;
    let attempt = 0;
    let finalResult: Awaited<ReturnType<typeof runSingleAttempt>> | null = null;
    const start = Date.now();

    while (attempt <= maxRetries) {
      // Clean slate
      await clearAllCollections();
      if (clearAgentCaches) clearAgentCaches();
      await seedAgentsAndTools(userId);

      try {
        finalResult = await runSingleAttempt(scenario, options.level, userId);
        if (finalResult.passed) break;
      } catch (err) {
        finalResult = {
          passed: false,
          failureReason: err instanceof Error ? err.message : String(err),
          toolsCalled: [],
        };
      }
      attempt++;
    }

    results.push({
      name: scenario.name,
      level: options.level,
      passed: finalResult?.passed ?? false,
      duration: Date.now() - start,
      toolsCalled: finalResult?.toolsCalled,
      agentUsed: finalResult?.agentUsed,
      failureReason: finalResult?.failureReason,
      attempts: attempt + 1,
    });
  }

  return results;
}
