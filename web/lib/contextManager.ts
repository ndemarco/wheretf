import { IMessage } from '@/models/Session';

export const WARNING_THRESHOLD = 0.75; // 75% - show warning
export const CRITICAL_THRESHOLD = 0.9; // 90% - strongly suggest compression

export interface ContextStatus {
  used: number;
  max: number;
  percentage: number;
  warning: boolean;
  critical: boolean;
  suggestion?: string;
}

/**
 * Estimate tokens for a message
 * Rough estimate: ~4 characters per token
 */
export function estimateTokens(message: Partial<IMessage>): number {
  let count = 0;

  if (message.content) {
    // Rough estimate: ~4 characters per token
    count += Math.ceil(message.content.length / 4);
  }

  if (message.images?.length) {
    // GPT-4o: ~765 tokens for low-res, ~1105 for high-res per image
    count += message.images.length * 1000;
  }

  if (message.toolCalls?.length) {
    count += Math.ceil(JSON.stringify(message.toolCalls).length / 4);
  }

  return count;
}

/**
 * Calculate context status from token counts
 */
export function calculateContextStatus(
  totalTokens: number,
  maxTokens: number
): ContextStatus {
  const usage = totalTokens / maxTokens;
  const status: ContextStatus = {
    used: totalTokens,
    max: maxTokens,
    percentage: Math.round(usage * 100),
    warning: usage >= WARNING_THRESHOLD,
    critical: usage >= CRITICAL_THRESHOLD,
  };

  if (status.critical) {
    status.suggestion =
      'Context is almost full. Consider compressing this session to continue.';
  } else if (status.warning) {
    status.suggestion = 'Context is getting full. Consider compressing this session.';
  }

  return status;
}
