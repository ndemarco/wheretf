/**
 * Assertion engine for exercise scenarios.
 * Checks tool calls, result fields, and DB state.
 */

import mongoose from 'mongoose';
import type { Assertion, Context } from './types';

interface AgentResult {
  content?: string;
  agent?: string;
  toolCalls?: { name: string; arguments: Record<string, unknown>; result: unknown }[];
}

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export async function checkAssertion(
  assertion: Assertion,
  result: unknown,
  ctx: Context,
): Promise<{ passed: boolean; reason?: string }> {
  const agentResult = result as AgentResult;
  const calledTools = agentResult?.toolCalls?.map((t) => t.name) ?? [];

  switch (assertion.type) {
    case 'toolsCalled': {
      const mode = assertion.mode ?? 'includes';
      if (mode === 'exact') {
        const match = JSON.stringify(calledTools) === JSON.stringify(assertion.tools);
        return match
          ? { passed: true }
          : { passed: false, reason: `Expected tools ${JSON.stringify(assertion.tools)}, got ${JSON.stringify(calledTools)}` };
      }
      if (mode === 'includes') {
        const missing = assertion.tools.filter((t) => !calledTools.includes(t));
        return missing.length === 0
          ? { passed: true }
          : { passed: false, reason: `Missing tool calls: ${missing.join(', ')}. Called: ${calledTools.join(', ')}` };
      }
      if (mode === 'excludes') {
        const found = assertion.tools.filter((t) => calledTools.includes(t));
        return found.length === 0
          ? { passed: true }
          : { passed: false, reason: `Unexpected tool calls: ${found.join(', ')}` };
      }
      return { passed: false, reason: `Unknown mode: ${mode}` };
    }

    case 'toolNotCalled': {
      return calledTools.includes(assertion.tool)
        ? { passed: false, reason: `Tool ${assertion.tool} was called but should not have been` }
        : { passed: true };
    }

    case 'agentUsed': {
      return agentResult?.agent === assertion.agent
        ? { passed: true }
        : { passed: false, reason: `Expected agent "${assertion.agent}", got "${agentResult?.agent}"` };
    }

    case 'resultField': {
      // Check the last handler step result or agent result
      const actual = getNestedValue(result, assertion.path);
      const match = JSON.stringify(actual) === JSON.stringify(assertion.value);
      return match
        ? { passed: true }
        : { passed: false, reason: `result.${assertion.path}: expected ${JSON.stringify(assertion.value)}, got ${JSON.stringify(actual)}` };
    }

    case 'resultNotError': {
      const err = getNestedValue(result, 'error');
      return err == null
        ? { passed: true }
        : { passed: false, reason: `Expected no error, got: ${JSON.stringify(err)}` };
    }

    case 'resultHasError': {
      const err = getNestedValue(result, 'error') as string | undefined;
      if (err == null) return { passed: false, reason: 'Expected an error but result has none' };
      if (assertion.containing && !err.includes(assertion.containing)) {
        return { passed: false, reason: `Error "${err}" does not contain "${assertion.containing}"` };
      }
      return { passed: true };
    }

    case 'dbQuery': {
      const query = typeof assertion.query === 'function' ? assertion.query(ctx) : assertion.query;
      const collection = mongoose.connection.collection(assertion.collection);
      const docs = await collection.find(query).toArray();

      if (assertion.expect === 'exists') {
        return docs.length > 0
          ? { passed: true }
          : { passed: false, reason: `No documents found in ${assertion.collection} matching ${JSON.stringify(query)}` };
      }
      if (assertion.expect === 'notExists') {
        return docs.length === 0
          ? { passed: true }
          : { passed: false, reason: `Expected no documents in ${assertion.collection}, found ${docs.length}` };
      }
      if ('count' in assertion.expect) {
        return docs.length === assertion.expect.count
          ? { passed: true }
          : { passed: false, reason: `Expected ${assertion.expect.count} docs in ${assertion.collection}, found ${docs.length}` };
      }
      if ('field' in assertion.expect) {
        if (docs.length === 0) {
          return { passed: false, reason: `No documents found in ${assertion.collection}` };
        }
        const actual = getNestedValue(docs[0], assertion.expect.field);
        const match = JSON.stringify(actual) === JSON.stringify(assertion.expect.value);
        return match
          ? { passed: true }
          : { passed: false, reason: `${assertion.collection}.${assertion.expect.field}: expected ${JSON.stringify(assertion.expect.value)}, got ${JSON.stringify(actual)}` };
      }

      return { passed: false, reason: 'Unknown expect type' };
    }

    case 'responseContains': {
      const content = agentResult?.content ?? '';
      return content.toLowerCase().includes(assertion.text.toLowerCase())
        ? { passed: true }
        : { passed: false, reason: `Response does not contain "${assertion.text}"` };
    }

    case 'responseNotContains': {
      const content = agentResult?.content ?? '';
      return !content.toLowerCase().includes(assertion.text.toLowerCase())
        ? { passed: true }
        : { passed: false, reason: `Response should not contain "${assertion.text}"` };
    }

    case 'custom': {
      const customResult = assertion.fn(result, ctx);
      return customResult === true
        ? { passed: true }
        : { passed: false, reason: typeof customResult === 'string' ? customResult : `Custom assertion "${assertion.name}" failed` };
    }

    default:
      return { passed: false, reason: `Unknown assertion type: ${(assertion as { type: string }).type}` };
  }
}
