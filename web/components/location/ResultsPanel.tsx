'use client';

import { useState, useEffect, useRef } from 'react';
import { LocationResult, ModuleInfo } from './LocationView';
import { StorageGrid } from './StorageGrid';
import { ModuleOverview } from './ModuleOverview';

// Color palette for result markers
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
  timestamp?: Date;
}

interface ResultsPanelProps {
  resultGroups: ResultGroup[];
  moduleInfo?: ModuleInfo | null;
  highlightedMessageIndex: number | null;
  onHighlightMessage: (index: number | null) => void;
  selectedLocation?: string | null;
}

interface GridData {
  flat: boolean;
  grid?: { rows: string[]; cols: string[] };
  occupiedCells?: string[];
  items?: { name: string; location: string; description?: string }[];
  location?: string;
}

export function ResultsPanel({
  resultGroups,
  moduleInfo,
  highlightedMessageIndex,
  onHighlightMessage,
  selectedLocation,
}: ResultsPanelProps) {
  const [selectedResult, setSelectedResult] = useState<LocationResult | null>(null);
  const [gridData, setGridData] = useState<GridData | null>(null);
  const [loading, setLoading] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Select result when selectedLocation changes (from clicking a link in chat)
  useEffect(() => {
    if (selectedLocation) {
      for (const group of resultGroups) {
        // Try exact match first
        let match = group.results.find((r) => r.location === selectedLocation);
        // Fall back to prefix match
        if (!match) {
          match = group.results.find(
            (r) => selectedLocation.startsWith(r.location) || r.location.startsWith(selectedLocation)
          );
        }
        if (match) {
          setSelectedResult(match);
          return;
        }
      }
    }
  }, [selectedLocation, resultGroups]);

  // Auto-select first result of most recent group when results change
  useEffect(() => {
    if (resultGroups.length > 0) {
      const latestGroup = resultGroups[resultGroups.length - 1];
      if (latestGroup.results.length > 0) {
        setSelectedResult(latestGroup.results[0]);
      }
    } else {
      setSelectedResult(null);
    }
  }, [resultGroups]);

  // Fetch grid/flat data when selected result changes
  useEffect(() => {
    if (!selectedResult) {
      setGridData(null);
      return;
    }

    const fetchData = async () => {
      if (selectedResult.path.length === 0) return;

      setLoading(true);
      try {
        const params = new URLSearchParams({
          module: selectedResult.moduleName,
          dimensionLabel: selectedResult.path[0].label,
          dimensionValue: selectedResult.path[0].value,
        });
        const response = await fetch(`/api/modules/grid?${params}`);
        if (response.ok) {
          const data = await response.json();
          setGridData(data);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedResult]);

  const handleResultClick = (result: LocationResult, messageIndex: number) => {
    setSelectedResult(result);
    onHighlightMessage(messageIndex);
  };

  const handleResultGroupClick = (messageIndex: number) => {
    onHighlightMessage(highlightedMessageIndex === messageIndex ? null : messageIndex);
  };

  // Build markers for grid view
  const getResultMarkers = () => {
    if (!selectedResult || !gridData || gridData.flat) return [];

    // Find all results at the same location as selected
    const markers: { resultIndex: number; row: string; col: string }[] = [];
    for (const group of resultGroups) {
      for (const result of group.results) {
        if (
          result.moduleName === selectedResult.moduleName &&
          result.path.length > 0 &&
          result.path[0].label === selectedResult.path[0]?.label &&
          result.path[0].value === selectedResult.path[0]?.value
        ) {
          const row = result.path.find((p) => p.label === 'row')?.value;
          const col = result.path.find((p) => p.label === 'col')?.value;
          if (row && col) {
            markers.push({ resultIndex: result.resultIndex, row, col });
          }
        }
      }
    }
    return markers;
  };

  // No results - show placeholder
  if (resultGroups.length === 0 && !moduleInfo) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 p-4 text-center">
        <div>
          <svg
            className="w-10 h-10 mx-auto mb-2 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <p className="text-xs">Results will appear here</p>
        </div>
      </div>
    );
  }

  // Module info only (no search results)
  if (resultGroups.length === 0 && moduleInfo) {
    return (
      <div className="h-full flex flex-col">
        <ModuleOverview module={moduleInfo} onDimensionClick={() => {}} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Results list (top section, scrollable) */}
      <div
        ref={resultsRef}
        className="flex-shrink-0 max-h-[40%] overflow-y-auto border-b border-gray-200 dark:border-gray-700"
      >
        <div className="p-2">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">
            Results
          </h3>
          {resultGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="mb-2">
              {/* Group header (clickable to highlight message) */}
              {resultGroups.length > 1 && (
                <button
                  onClick={() => handleResultGroupClick(group.messageIndex)}
                  className={`w-full text-left text-xs px-2 py-1 rounded mb-1 transition-colors ${
                    highlightedMessageIndex === group.messageIndex
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  Search {groupIdx + 1} ({group.results.length} result
                  {group.results.length !== 1 ? 's' : ''})
                </button>
              )}

              {/* Results in this group */}
              <div className="space-y-1">
                {group.results.map((result) => (
                  <button
                    key={`${result.resultIndex}-${result.location}`}
                    onClick={() => handleResultClick(result, group.messageIndex)}
                    className={`w-full text-left p-2 rounded transition-colors ${
                      selectedResult?.location === result.location
                        ? 'bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 shadow-sm'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 ${RESULT_COLORS[result.resultIndex % RESULT_COLORS.length]} rounded flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}
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
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Visualization (bottom section, fills remaining space) */}
      <div className="flex-1 overflow-auto p-3">
        {loading && (
          <div className="h-full flex items-center justify-center text-gray-400">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}

        {!loading && selectedResult && gridData && (
          <>
            {/* Breadcrumb - show full path */}
            <div className="flex items-center gap-1 text-xs mb-3 flex-wrap">
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {selectedResult.moduleName}
              </span>
              {selectedResult.path.map((segment, idx) => (
                <span key={idx} className="flex items-center gap-1">
                  <span className="text-gray-400">›</span>
                  <span className="text-gray-600 dark:text-gray-300">
                    {segment.label}: {segment.value}
                  </span>
                </span>
              ))}
            </div>

            {/* Grid or flat view */}
            {gridData.flat ? (
              // Flat location view
              <div className="space-y-2">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {gridData.items?.length || 0} item{(gridData.items?.length || 0) !== 1 ? 's' : ''} at
                  this location
                </div>
                {gridData.items?.map((item, idx) => {
                  const isSelected = item.name === selectedResult.itemName;
                  return (
                    <div
                      key={idx}
                      className={`p-2 rounded border text-sm ${
                        isSelected
                          ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                      }`}
                    >
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {item.name}
                      </span>
                      {item.description && (
                        <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : gridData.grid ? (
              // Grid view
              <div>
                <StorageGrid
                  rows={gridData.grid.rows}
                  cols={gridData.grid.cols}
                  occupiedCells={new Set(gridData.occupiedCells || [])}
                  resultMarkers={getResultMarkers()}
                  selectedResultIndex={selectedResult.resultIndex}
                />
                {/* Legend */}
                <div className="flex items-center gap-3 mt-3 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded" />
                    <span>occupied</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-blue-500 rounded" />
                    <span>result</span>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}

        {!loading && !selectedResult && (
          <div className="h-full flex items-center justify-center text-gray-400 text-xs">
            Select a result to view location
          </div>
        )}
      </div>
    </div>
  );
}
