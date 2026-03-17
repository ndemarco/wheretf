'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChatContainer } from '@/components/chat';
import { ModuleExplorer } from '@/components/explorer';
import { LocationPane } from '@/components/location/LocationPane';

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

interface LocationContext {
  moduleId: string;
  moduleName: string;
  path: string[];
}

function ChatPageContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(!!sessionId);
  const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null);
  const [chatExpanded, setChatExpanded] = useState(true);
  const [locationContext, setLocationContext] = useState<LocationContext | null>(null);
  const [explorerRefreshKey, setExplorerRefreshKey] = useState(0);

  useEffect(() => {
    if (sessionId && sessionId !== loadedSessionId) {
      loadSession(sessionId);
    } else if (!sessionId) {
      setInitialMessages([]);
      setLoading(false);
      setLoadedSessionId(null);
    }
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSession = async (id: string) => {
    try {
      const response = await fetch(`/api/sessions/${id}`);
      if (!response.ok) throw new Error('Failed to load session');
      const data = await response.json();
      setLoadedSessionId(id);
      const messages = (data.session.messages || [])
        .filter((m: { role: string }) => m.role !== 'system')
        .map((m: { role: string; content: string; agent?: string; toolCalls?: unknown[] }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          agent: m.agent,
          toolCalls: m.toolCalls,
        }));
      setInitialMessages(messages);
      setChatExpanded(true);
    } catch {
      setInitialMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLocation = useCallback(
    (moduleId: string, moduleName: string, path: string[]) => {
      setLocationContext({ moduleId, moduleName, path });
    },
    []
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-accent-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Chat panel — collapsible left side */}
      <div
        className={`flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all duration-200 shrink-0 overflow-hidden ${
          chatExpanded ? 'w-80 lg:w-96' : 'w-0 border-r-0'
        }`}
      >
        {chatExpanded && (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden w-80 lg:w-96">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-800 shrink-0">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Chat</span>
              <button
                onClick={() => setChatExpanded(false)}
                className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Close chat"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ChatContainer
              key={loadedSessionId || 'new'}
              sessionId={sessionId || undefined}
              initialMessages={initialMessages}
              compact
              onResponse={() => setExplorerRefreshKey((k) => k + 1)}
            />
          </div>
        )}
      </div>

      {/* Center pane — module explorer (fixed width) */}
      <div className="w-72 lg:w-80 shrink-0 flex flex-col min-w-0 overflow-hidden border-r border-gray-200 dark:border-gray-800">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0 pl-14 lg:pl-4">
          {!chatExpanded && (
            <button
              onClick={() => setChatExpanded(true)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-accent-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Open chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
          )}
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">WhereTF</h1>
        </div>

        <ModuleExplorer onSelectLocation={handleSelectLocation} refreshKey={explorerRefreshKey} />
      </div>

      {/* Right pane — location detail (fills remaining space) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white dark:bg-gray-900">
        {locationContext ? (
          <LocationPane
            moduleId={locationContext.moduleId}
            moduleName={locationContext.moduleName}
            path={locationContext.path}
            onClose={() => setLocationContext(null)}
            refreshKey={explorerRefreshKey}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-300 dark:text-gray-600">
            <p className="text-sm">Select a level to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-accent-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ChatPageContent />
    </Suspense>
  );
}
