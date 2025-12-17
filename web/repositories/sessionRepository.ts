import Session, { ISession, IMessage } from '@/models/Session';
import dbConnect from '@/lib/mongodb';

const WARNING_THRESHOLD = 0.75; // 75% - show warning
const CRITICAL_THRESHOLD = 0.9; // 90% - strongly suggest compression

export interface CreateSessionInput {
  userId: string;
  name?: string;
  parentSession?: string;
  initialMessage?: IMessage;
}

export interface ContextStatus {
  used: number;
  max: number;
  percentage: number;
  warning: boolean;
  critical: boolean;
  suggestion?: string;
}

export async function create(input: CreateSessionInput): Promise<ISession> {
  await dbConnect();

  const sessionData: Record<string, unknown> = {
    user: input.userId,
    name: input.name,
    messages: input.initialMessage ? [input.initialMessage] : [],
    totalTokens: input.initialMessage?.tokenCount || 0,
    status: 'active',
  };

  if (input.parentSession) {
    sessionData.parentSession = input.parentSession;
  }

  const session = await Session.create(sessionData);
  return session;
}

export async function findById(userId: string, id: string): Promise<ISession | null> {
  await dbConnect();
  return Session.findOne({ user: userId, _id: id });
}

export async function list(userId: string): Promise<ISession[]> {
  await dbConnect();
  return Session.find({ user: userId })
    .select('-messages') // Don't load all messages for list view
    .sort({ updatedAt: -1 });
}

export async function listActive(userId: string): Promise<ISession[]> {
  await dbConnect();
  return Session.find({ user: userId, status: 'active' })
    .select('-messages')
    .sort({ updatedAt: -1 });
}

export async function addMessage(
  userId: string,
  sessionId: string,
  message: IMessage
): Promise<{ session: ISession; contextStatus: ContextStatus }> {
  await dbConnect();

  const session = await Session.findOne({ user: userId, _id: sessionId });
  if (!session) {
    throw new Error(`Session not found`);
  }

  // Add message
  session.messages.push({
    ...message,
    timestamp: message.timestamp || new Date(),
  });

  // Update token count
  session.totalTokens += message.tokenCount || 0;

  await session.save();

  // Calculate context status
  const usage = session.totalTokens / session.maxTokens;
  const contextStatus: ContextStatus = {
    used: session.totalTokens,
    max: session.maxTokens,
    percentage: Math.round(usage * 100),
    warning: usage >= WARNING_THRESHOLD,
    critical: usage >= CRITICAL_THRESHOLD,
  };

  if (contextStatus.critical) {
    contextStatus.suggestion =
      'Context is almost full. Consider compressing this session to continue.';
  } else if (contextStatus.warning) {
    contextStatus.suggestion = 'Context is getting full. Consider compressing this session.';
  }

  return { session, contextStatus };
}

export async function getMessages(
  userId: string,
  sessionId: string
): Promise<IMessage[]> {
  await dbConnect();

  const session = await Session.findOne({ user: userId, _id: sessionId });
  if (!session) {
    throw new Error(`Session not found`);
  }

  return session.messages;
}

export async function updateName(
  userId: string,
  sessionId: string,
  name: string
): Promise<ISession> {
  await dbConnect();

  const session = await Session.findOne({ user: userId, _id: sessionId });
  if (!session) {
    throw new Error(`Session not found`);
  }

  session.name = name;
  await session.save();

  return session;
}

export async function archive(userId: string, sessionId: string): Promise<ISession> {
  await dbConnect();

  const session = await Session.findOne({ user: userId, _id: sessionId });
  if (!session) {
    throw new Error(`Session not found`);
  }

  session.status = 'archived';
  await session.save();

  return session;
}

export async function compress(
  userId: string,
  sessionId: string,
  summary: string
): Promise<{ oldSession: ISession; newSession: ISession }> {
  await dbConnect();

  const session = await Session.findOne({ user: userId, _id: sessionId });
  if (!session) {
    throw new Error(`Session not found`);
  }

  // Archive current session
  session.status = 'compressed';
  session.compressedSummary = summary;
  await session.save();

  // Estimate tokens for summary
  const summaryTokens = Math.ceil(summary.length / 4);

  // Create new session with summary as context
  const newSession = await Session.create({
    user: userId,
    name: session.name,
    parentSession: session._id,
    messages: [
      {
        role: 'system',
        content: `Previous conversation summary:\n\n${summary}\n\nContinue helping the user with their workshop inventory.`,
        tokenCount: summaryTokens,
        timestamp: new Date(),
      },
    ],
    totalTokens: summaryTokens,
    status: 'active',
  });

  return { oldSession: session, newSession };
}

export async function remove(userId: string, sessionId: string): Promise<{ success: boolean }> {
  await dbConnect();

  // Also delete any child sessions
  await Session.deleteMany({
    user: userId,
    parentSession: sessionId,
  });

  const result = await Session.deleteOne({ user: userId, _id: sessionId });
  if (result.deletedCount === 0) {
    throw new Error(`Session not found`);
  }

  return { success: true };
}

export async function getContextStatus(
  userId: string,
  sessionId: string
): Promise<ContextStatus> {
  await dbConnect();

  const session = await Session.findOne({ user: userId, _id: sessionId });
  if (!session) {
    throw new Error(`Session not found`);
  }

  const usage = session.totalTokens / session.maxTokens;
  const contextStatus: ContextStatus = {
    used: session.totalTokens,
    max: session.maxTokens,
    percentage: Math.round(usage * 100),
    warning: usage >= WARNING_THRESHOLD,
    critical: usage >= CRITICAL_THRESHOLD,
  };

  if (contextStatus.critical) {
    contextStatus.suggestion =
      'Context is almost full. Consider compressing this session to continue.';
  } else if (contextStatus.warning) {
    contextStatus.suggestion = 'Context is getting full. Consider compressing this session.';
  }

  return contextStatus;
}

/**
 * Get full session chain (including parent sessions)
 */
export async function getSessionChain(
  userId: string,
  sessionId: string
): Promise<ISession[]> {
  await dbConnect();

  const sessions: ISession[] = [];
  let current = await Session.findOne({ user: userId, _id: sessionId });

  while (current) {
    sessions.unshift(current);
    if (current.parentSession) {
      current = await Session.findOne({ user: userId, _id: current.parentSession });
    } else {
      current = null;
    }
  }

  return sessions;
}
