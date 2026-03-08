'use client';

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

export function ChatMessage({ role, content, agent, toolCalls, onLocationClick }: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-blue-600 text-white'
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
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors font-medium text-sm cursor-pointer shadow-sm"
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
      </div>
    </div>
  );
}
