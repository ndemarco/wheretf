'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
}

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  agent?: string;
  toolCalls?: ToolCall[];
  onLocationClick?: (location: string) => void;
  onFeedback?: (rating: 'up' | 'down', note?: string, screenshot?: string) => void;
}

/**
 * Parse a loc:// URI into our internal location format
 * URI format: loc://MODULE/dim-value/dim-value/...
 * Internal format: MODULE:dim-value:dim-value:...
 */
function parseLocationUri(uri: string): string | null {
  // Handle both loc:// and loc: (ReactMarkdown may strip one slash)
  const match = uri.match(/^loc:\/?\/?(.+)$/);
  if (!match) return null;

  const path = decodeURIComponent(match[1]);
  const parts = path.split('/').filter(Boolean);

  if (parts.length === 0) return null;

  // First part is the module name, rest are dimension-values
  const [module, ...dims] = parts;
  return dims.length > 0 ? `${module}:${dims.join(':')}` : module;
}

export function ChatMessage({ role, content, agent, toolCalls, onLocationClick, onFeedback }: ChatMessageProps) {
  const isUser = role === 'user';
  const [feedbackState, setFeedbackState] = useState<'idle' | 'voted-up' | 'prompting-down' | 'sent-down'>('idle');
  const [reportNote, setReportNote] = useState('');
  const [screenshot, setScreenshot] = useState<string | undefined>();

  const handleThumbsUp = () => {
    onFeedback?.('up');
    setFeedbackState('voted-up');
  };

  const handleThumbsDown = () => {
    setFeedbackState('prompting-down');
  };

  const submitDownvote = () => {
    onFeedback?.('down', reportNote || undefined, screenshot);
    setFeedbackState('sent-down');
    setReportNote('');
    setScreenshot(undefined);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => setScreenshot(reader.result as string);
        reader.readAsDataURL(file);
        e.preventDefault();
        break;
      }
    }
  };

  return (
    <div className={`group flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-accent-500 text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
        }`}
      >
        {!isUser && agent && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">
            {agent}
          </div>
        )}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown
            urlTransform={(url) => {
              // Allow loc: protocol for location links
              if (url.startsWith('loc:')) {
                return url;
              }
              // Default behavior for other URLs
              return url;
            }}
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
              li: ({ children }) => <li className="mb-1">{children}</li>,
              code: ({ children, className }) => {
                const isBlock = className?.includes('language-');
                return isBlock ? (
                  <pre className="bg-gray-200 dark:bg-gray-700 rounded p-2 overflow-x-auto my-2">
                    <code className="text-sm">{children}</code>
                  </pre>
                ) : (
                  <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-sm">
                    {children}
                  </code>
                );
              },
              strong: ({ children }) => <strong className="font-bold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
              h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
              a: ({ href, children }) => {
                // Handle location links (loc:// protocol)
                if (href?.startsWith('loc:')) {
                  const location = parseLocationUri(href);
                  if (location) {
                    return (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          onLocationClick?.(location);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-accent-500 dark:bg-accent-600 text-white hover:bg-accent-600 dark:hover:bg-accent-700 transition-colors font-medium text-sm cursor-pointer shadow-sm"
                        title={`View location: ${location}`}
                      >
                        {children}
                      </button>
                    );
                  }
                }
                // Regular links
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    {children}
                  </a>
                );
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
        {toolCalls && toolCalls.length > 0 && (
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
              {toolCalls.length} tool call{toolCalls.length > 1 ? 's' : ''}
            </summary>
            <div className="mt-2 space-y-2">
              {toolCalls.map((call) => (
                <div
                  key={call.id}
                  className="bg-gray-200 dark:bg-gray-700 rounded p-2 font-mono text-xs"
                >
                  <div className="font-semibold text-blue-600 dark:text-blue-400">
                    {call.name}
                  </div>
                  <div className="text-gray-600 dark:text-gray-300 mt-1">
                    Args: {JSON.stringify(call.arguments, null, 2)}
                  </div>
                  <div className="text-green-600 dark:text-green-400 mt-1">
                    Result: {JSON.stringify(call.result, null, 2)}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
        {!isUser && onFeedback && feedbackState === 'idle' && (
          <div className="mt-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleThumbsUp}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-green-500 transition-colors"
              title="Good response"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z M4 15h2v6H4z" />
              </svg>
            </button>
            <button
              onClick={handleThumbsDown}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500 transition-colors"
              title="Bad response"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z M20 2h-2v6h2z" />
              </svg>
            </button>
          </div>
        )}
        {!isUser && feedbackState === 'voted-up' && (
          <div className="mt-1 text-xs text-green-500">Noted</div>
        )}
        {!isUser && feedbackState === 'prompting-down' && (
          <div className="mt-2 space-y-2" onPaste={handlePaste}>
            <input
              type="text"
              value={reportNote}
              onChange={(e) => setReportNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitDownvote()}
              placeholder="What went wrong? (optional)"
              className="w-full text-xs px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-red-500"
              autoFocus
            />
            {screenshot && (
              <div className="relative">
                <img src={screenshot} alt="Screenshot" className="max-h-32 rounded border border-gray-300 dark:border-gray-600" />
                <button
                  onClick={() => setScreenshot(undefined)}
                  className="absolute top-1 right-1 bg-gray-800/70 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs hover:bg-red-600"
                >
                  x
                </button>
              </div>
            )}
            {!screenshot && (
              <div className="text-xs text-gray-400">Paste a screenshot (Ctrl+V)</div>
            )}
            <div className="flex gap-1.5">
              <button
                onClick={submitDownvote}
                className="text-xs px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600"
              >
                Submit
              </button>
              <button
                onClick={() => { setFeedbackState('idle'); setReportNote(''); setScreenshot(undefined); }}
                className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {!isUser && feedbackState === 'sent-down' && (
          <div className="mt-1 text-xs text-red-400">Captured for review</div>
        )}
      </div>
    </div>
  );
}
