/**
 * Exercise harness type definitions.
 *
 * Two execution levels:
 *   - handler: calls executeHandler() directly (fast, free, deterministic)
 *   - agent:   sends natural language through runChat() (slow, API cost, non-deterministic)
 */

// ── Context bag passed between seed → steps → assertions ─────────

export type Context = Record<string, unknown>;

// ── Seed fixture ─────────────────────────────────────────────────

export interface SeedFixture {
  /** Set up test data, return a context bag of IDs/names for use in assertions */
  setup: (userId: string) => Promise<Context>;
}

// ── Steps ────────────────────────────────────────────────────────

/** Agent-level: send a natural language message through runChat */
export interface AgentStep {
  message: string;
  images?: string[];
}

/** Handler-level: call a handler directly */
export interface HandlerStep {
  handler: string;
  args: Record<string, unknown> | ((ctx: Context) => Record<string, unknown>);
  /** If set, store the result under this key in context */
  storeAs?: string;
}

// ── Assertions ───────────────────────────────────────────────────

export type Assertion =
  | { type: 'toolsCalled'; tools: string[]; mode?: 'exact' | 'includes' | 'excludes' }
  | { type: 'toolNotCalled'; tool: string }
  | { type: 'agentUsed'; agent: string }
  | { type: 'resultField'; path: string; value: unknown }
  | { type: 'resultNotError' }
  | { type: 'resultHasError'; containing?: string }
  | { type: 'dbQuery'; collection: string; query: Record<string, unknown> | ((ctx: Context) => Record<string, unknown>); expect: 'exists' | 'notExists' | { count: number } | { field: string; value: unknown } }
  | { type: 'responseContains'; text: string }
  | { type: 'responseNotContains'; text: string }
  | { type: 'custom'; name: string; fn: (result: unknown, ctx: Context) => true | string };

// ── Scenario ─────────────────────────────────────────────────────

export interface Scenario {
  name: string;
  description?: string;
  level: 'handler' | 'agent' | 'both';
  tags?: string[];
  seed?: SeedFixture;
  /** Agent-level steps */
  steps?: AgentStep[];
  /** Handler-level steps */
  handlerSteps?: HandlerStep[];
  /** Assertions checked after all steps complete */
  assertions: Assertion[];
  /** Accumulate conversation history across agent steps */
  multiTurn?: boolean;
  /** Retries for agent-level (default 1) */
  retries?: number;
}

// ── Results ──────────────────────────────────────────────────────

export interface ScenarioResult {
  name: string;
  level: 'handler' | 'agent';
  passed: boolean;
  duration: number;
  toolsCalled?: string[];
  agentUsed?: string;
  failureReason?: string;
  attempts: number;
}

export interface RunOptions {
  level: 'handler' | 'agent';
  filter?: string;
  tags?: string[];
  verbose?: boolean;
  maxRetries?: number;
}
