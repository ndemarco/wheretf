'use client';

import { LocationResult } from './LocationView';

// Color palette for result markers (matches StorageGrid)
const RESULT_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-yellow-500',
  'bg-red-500',
];

interface ResultGroup {
  messageIndex: number;
  results: LocationResult[];
}

interface ResultsListProps {
  resultGroups: ResultGroup[];
  selectedResultIndex: number | null;
  onSelectResult: (result: LocationResult, messageIndex: number) => void;
  highlightedMessageIndex: number | null;
}

export function ResultsList({
  resultGroups,
  selectedResultIndex,
  onSelectResult,
  highlightedMessageIndex,
}: ResultsListProps) {
  const hasResults = resultGroups.some((g) => g.results.length > 0);

  if (!hasResults) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 p-4 text-center">
        <div>
          <svg
            className="w-8 h-8 mx-auto mb-2 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <p className="text-xs">Results will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Results
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {resultGroups.map((group, groupIndex) => (
          <div key={group.messageIndex}>
            {/* Separator between groups */}
            {groupIndex > 0 && (
              <div className="my-2 border-t border-gray-300 dark:border-gray-600" />
            )}
            <div className="space-y-1">
              {group.results.map((result) => {
                const isSelected = result.resultIndex === selectedResultIndex;
                const isFromHighlightedMessage = group.messageIndex === highlightedMessageIndex;
                const colorClass = RESULT_COLORS[result.resultIndex % RESULT_COLORS.length];

                return (
                  <button
                    key={`${result.resultIndex}-${result.location}`}
                    onClick={() => onSelectResult(result, group.messageIndex)}
                    className={`w-full text-left p-2 rounded transition-colors ${
                      isSelected
                        ? 'bg-white dark:bg-gray-800 border border-blue-400 dark:border-blue-600 shadow-sm'
                        : isFromHighlightedMessage
                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-transparent'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={`w-5 h-5 ${colorClass} rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5`}
                      >
                        {result.resultIndex + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {result.itemName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {result.moduleName} / {result.path.map((p) => p.value).join(' / ')}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
