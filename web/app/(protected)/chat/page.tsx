'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout';
import { ChatContainer } from '@/components/chat';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  agent?: string;
  toolCalls?: {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    result: unknown;
  }[];
}

function ChatPageContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(!!sessionId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
    }
  }, [sessionId]);

  const loadSession = async (id: string) => {
    try {
      const response = await fetch(`/api/sessions/${id}`);
      if (!response.ok) {
        throw new Error('Failed to load session');
      }
      const data = await response.json();
      // Filter out system messages and map to the expected format
      const messages = (data.session.messages || [])
        .filter((m: { role: string }) => m.role !== 'system')
        .map((m: { role: string; content: string; agent?: string; toolCalls?: unknown[] }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          agent: m.agent,
          toolCalls: m.toolCalls,
        }));
      setInitialMessages(messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header title="Chat" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header title="Chat" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-600 dark:text-red-400">
            {error}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Chat" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <ChatContainer sessionId={sessionId || undefined} initialMessages={initialMessages} />
      </div>
    </>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <>
          <Header title="Chat" />
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        </>
      }
    >
      <ChatPageContent />
    </Suspense>
  );
}
