/**
 * Dynamically-generated scenarios from user-captured failures.
 * Reads logs/captures.jsonl and creates agent-level replay scenarios.
 */

import fs from 'fs';
import path from 'path';
import type { Scenario } from '../types';
import type { CaptureEntry } from '@/lib/logger';

const CAPTURES_FILE = path.join(process.cwd(), 'logs', 'captures.jsonl');

export function loadCapturedScenarios(): Scenario[] {
  try {
    if (!fs.existsSync(CAPTURES_FILE)) return [];
    const content = fs.readFileSync(CAPTURES_FILE, 'utf-8').trim();
    if (!content) return [];

    const captures: CaptureEntry[] = content
      .split('\n')
      .map((line) => JSON.parse(line))
      .filter((c) => c.rating === 'down'); // Only downvoted entries become scenarios

    return captures.map((capture) => ({
      name: `[capture ${capture.id}] ${capture.userMessage.slice(0, 60)}`,
      description: capture.userNote || undefined,
      level: 'agent' as const,
      tags: ['captured', 'regression'],
      retries: 2,
      steps: [{ message: capture.userMessage }],
      assertions: [
        // Basic: the agent should actually call tools (not hallucinate)
        {
          type: 'custom' as const,
          name: 'agent calls at least one tool',
          fn: (result: unknown) => {
            const r = result as { toolCalls?: unknown[] };
            return r?.toolCalls && r.toolCalls.length > 0
              ? true
              : 'Agent produced 0 tool calls — likely hallucinated';
          },
        },
        // The response should not contain error indicators
        { type: 'resultNotError' as const },
      ],
    }));
  } catch (err) {
    console.error('[captured] Failed to load captures:', err);
    return [];
  }
}
