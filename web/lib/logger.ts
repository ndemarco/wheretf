import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'agent.jsonl');
const AUDIT_FILE = path.join(LOG_DIR, 'audit.jsonl');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  agent: string;
  event: string;
  [key: string]: unknown;
}

function writeLog(entry: LogEntry) {
  try {
    ensureLogDir();
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(LOG_FILE, line);
  } catch {
    console.error('[logger] Failed to write log', entry);
  }
}

interface AuditEntry {
  timestamp: string;
  handler: string;
  operation: 'create' | 'update' | 'delete' | 'assign' | 'move' | 'place' | 'unplace';
  entity: string;
  entityId?: string;
  args: Record<string, unknown>;
  result: unknown;
  verified: boolean;
  durationMs: number;
}

function writeAudit(entry: AuditEntry) {
  try {
    ensureLogDir();
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(AUDIT_FILE, line);
  } catch {
    console.error('[audit] Failed to write audit', entry);
  }
}

// ── Captures (user-reported failures) ────────────────────────────

const CAPTURES_FILE = path.join(LOG_DIR, 'captures.jsonl');

export interface CaptureEntry {
  id: string;
  timestamp: string;
  rating: 'up' | 'down';
  userMessage: string;
  agentResponse: string;
  agent?: string;
  toolCalls: { name: string; arguments: Record<string, unknown>; result: unknown }[];
  userNote?: string;
  screenshot?: string;
  sessionId?: string;
}

export function writeCapture(entry: CaptureEntry): void {
  try {
    ensureLogDir();
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(CAPTURES_FILE, line);
  } catch {
    console.error('[capture] Failed to write capture', entry.id);
  }
}

export function readCaptures(): CaptureEntry[] {
  try {
    ensureLogDir();
    if (!fs.existsSync(CAPTURES_FILE)) return [];
    const content = fs.readFileSync(CAPTURES_FILE, 'utf-8').trim();
    if (!content) return [];
    return content.split('\n').map((line) => JSON.parse(line));
  } catch {
    console.error('[capture] Failed to read captures');
    return [];
  }
}

export const auditLog = {
  mutation(
    handler: string,
    operation: AuditEntry['operation'],
    entity: string,
    entityId: string | undefined,
    args: Record<string, unknown>,
    result: unknown,
    verified: boolean,
    durationMs: number
  ) {
    writeAudit({
      timestamp: new Date().toISOString(),
      handler,
      operation,
      entity,
      entityId,
      args,
      result,
      verified,
      durationMs,
    });
  },
};

export const agentLog = {
  start(agent: string, message: string, tools: string[]) {
    writeLog({
      timestamp: new Date().toISOString(),
      level: 'info',
      agent,
      event: 'agent_start',
      message: message.slice(0, 200),
      tools,
    });
  },

  toolCall(agent: string, toolName: string, args: Record<string, unknown>) {
    writeLog({
      timestamp: new Date().toISOString(),
      level: 'info',
      agent,
      event: 'tool_call',
      tool: toolName,
      args,
    });
  },

  toolResult(agent: string, toolName: string, result: unknown, durationMs?: number) {
    writeLog({
      timestamp: new Date().toISOString(),
      level: 'info',
      agent,
      event: 'tool_result',
      tool: toolName,
      result,
      durationMs,
    });
  },

  toolError(agent: string, toolName: string, error: string) {
    writeLog({
      timestamp: new Date().toISOString(),
      level: 'error',
      agent,
      event: 'tool_error',
      tool: toolName,
      error,
    });
  },

  end(agent: string, iterations: number, toolCallCount: number, response: string) {
    writeLog({
      timestamp: new Date().toISOString(),
      level: 'info',
      agent,
      event: 'agent_end',
      iterations,
      toolCallCount,
      response: response.slice(0, 500),
    });
  },

  delegation(router: string, specialist: string, task: string) {
    writeLog({
      timestamp: new Date().toISOString(),
      level: 'info',
      agent: router,
      event: 'delegate',
      specialist,
      task: task.slice(0, 200),
    });
  },
};
