'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ContextIndicator } from './ContextIndicator';
import { useVisualization, SearchResult } from '@/components/visualization/VisualizationContext';
import { extractLocationData } from '@/lib/locationExtractor';

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

interface ResultGroup {
  messageIndex: number;
  results: LocationResult[];
  timestamp?: Date;
}

export function ChatContainer({ sessionId: initialSessionId, initialMessages = [] }: ChatContainerProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [context, setContext] = useState<ContextStatus | undefined>();
  const [highlightedMessageIndex, setHighlightedMessageIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Extract location data from ALL assistant messages with tool calls (grouped by message)
  const { resultGroups, moduleInfo } = useMemo(() => {
    const groups: ResultGroup[] = [];
    let moduleInfo: ModuleInfo | null = null;
    let globalResultIndex = 0;

    messages.forEach((msg, idx) => {
      if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
        const data = extractLocationData(msg.toolCalls);
        if (data.results.length > 0) {
          // Re-index results with global indices
          const reindexedResults = data.results.map((result) => ({
            ...result,
            resultIndex: globalResultIndex++,
          }));
          groups.push({
            messageIndex: idx,
            results: reindexedResults,
          });
        }
        if (data.moduleInfo) {
          moduleInfo = data.moduleInfo;
        }
      }
    });

    return { resultGroups: groups, moduleInfo };
  }, [messages]);

  // Sync with Visualization Context
  const { setResults, showLocation, setActiveResultId, activeResultId, isNavigatorOpen, setNavigatorOpen } = useVisualization();

  // Update context results whenever messages change (and thus resultGroups change)
  useEffect(() => {
    // Flatten resultGroups to SearchResult[]
    const flatResults: SearchResult[] = resultGroups.flatMap(group =>
      group.results.map((r, i) => ({
        id: r.location, // Use location as ID for now or generate one? r has specific properties? 
        // We need a unique ID. 
        // LocationResult usually has name, location.
        // Let's use `location` + index if needed, or just location if unique.
        name: r.item, // Check `LocationResult` shape from extractor?
        location: r.location,
        moduleName: r.moduleName || r.location.split(':')[0]
      }))
    );
    setResults(flatResults);

    // Also if we have moduleInfo (from "tell me about MUSE"), we might want to trigger something?
    // For now, let's focus on search results.
    // If we have moduleInfo, maybe we should auto-open that module?
    if (moduleInfo && !isNavigatorOpen) {
      // Only if latest message? 
      // For now keep simple.
    }

  }, [resultGroups, moduleInfo, setResults]);


  // Handle clicking a location link in chat messages
  const handleLocationClick = (location: string) => {
    showLocation(location);
  };

  /* 
  // Handle selecting a result from the Results panel - NO LONGER NEEDED HERE
  // The Context handles it.
  const handleSelectResult = (result: LocationResult, messageIndex: number) => {
    setSelectedResult(result);
    setHighlightedMessageIndex(messageIndex);
  };
  */

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (content: string, images?: string[]) => {
    setError(null);
    setIsLoading(true);

    // Add user message immediately
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

      // Update session ID if this was a new session
      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
        // Update URL without page reload
        window.history.replaceState({}, '', `/chat?session=${data.sessionId}`);
      }

      // Add assistant message
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message.content,
        agent: data.message.agent,
        toolCalls: data.message.toolCalls,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Update context status
      if (data.context) {
        setContext(data.context);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      // Remove the user message on error
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  // Determine if we should show the location panel
  const showLocationPanel = resultGroups.length > 0 || moduleInfo !== null;

  return (
    <div className="flex h-full">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages area */}
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
                    <span className="text-blue-500">•</span>
                    <span>&quot;Create a storage module called MUSE with 11 levels&quot;</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500">•</span>
                    <span>&quot;Add 10k resistors to MUSE level 3, row 2&quot;</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500">•</span>
                    <span>&quot;Where are my M3 screws?&quot;</span>
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  ref={(el) => {
                    if (el) messageRefs.current.set(idx, el);
                  }}
                  className={`transition-all duration-300 ${highlightedMessageIndex === idx
                      ? 'ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-gray-900 rounded-lg'
                      : ''
                    }`}
                >
                  <ChatMessage
                    role={msg.role}
                    content={msg.content}
                    agent={msg.agent}
                    toolCalls={msg.toolCalls}
                    onLocationClick={handleLocationClick}
                  />
                </div>
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

        {/* Error display */}
        {error && (
          <div className="mx-4 mb-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Context indicator */}
        {context && (
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
            <ContextIndicator context={context} />
          </div>
        )}

        {/* Input area */}
        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
      {/* Removed Side Panels - handled by ChatLayout / NavigatorPanel */}
    </div>
  );
}
