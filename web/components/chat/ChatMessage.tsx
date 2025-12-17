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
}

export function ChatMessage({ role, content, agent, toolCalls }: ChatMessageProps) {
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
