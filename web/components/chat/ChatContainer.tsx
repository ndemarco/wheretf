'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ContextIndicator } from './ContextIndicator';

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  agent?: string;
  toolCalls?: ToolCall[];
}

interface ContextStatus {
  used: number;
  max: number;
  percentage: number;
  warning: boolean;
  critical: boolean;
  suggestion?: string;
}

interface ChatContainerProps {
  sessionId?: string;
  initialMessages?: Message[];
}

export function ChatContainer({ sessionId: initialSessionId, initialMessages = [] }: ChatContainerProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [context, setContext] = useState<ContextStatus | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (content: string, images?: string[]) => {
    setError(null);
    setIsLoading(true);

    const userMessage: Message = { role: 'user', content };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: content,
          images,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Chat request failed');
      }

      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
        window.history.replaceState({}, '', `/chat?session=${data.sessionId}`);
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message.content,
        agent: data.message.agent,
        toolCalls: data.message.toolCalls,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (data.context) {
        setContext(data.context);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2">Welcome to WhereTF</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
                Your AI-powered workshop inventory assistant. Describe items, take photos, or ask questions about your inventory.
              </p>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 max-w-md">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Try saying:</p>
                <ul className="text-sm space-y-2 text-left">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500">&bull;</span>
                    <span>&quot;Create a storage module called MUSE with 11 levels&quot;</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500">&bull;</span>
                    <span>&quot;Add 10k resistors to MUSE level 3, row 2&quot;</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500">&bull;</span>
                    <span>&quot;Where are my M3 screws?&quot;</span>
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <ChatMessage
                  key={idx}
                  role={msg.role}
                  content={msg.content}
                  agent={msg.agent}
                  toolCalls={msg.toolCalls}
                />
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {error && (
          <div className="mx-4 mb-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {context && (
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
            <ContextIndicator context={context} />
          </div>
        )}

        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </div>
  );
}
