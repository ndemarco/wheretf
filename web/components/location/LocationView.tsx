'use client';

import { useState, useEffect } from 'react';
import { StorageGrid } from './StorageGrid';
import { ModuleOverview } from './ModuleOverview';

export interface LocationResult {
  resultIndex: number;
  itemName: string;
  location: string; // e.g., "NEON:drawer-3:row-A:col-12"
  moduleName: string;
  path: { label: string; value: string }[];
}

export interface ModuleInfo {
  name: string;
  description?: string;
  dimensions: {
    label: string;
    values: string[];
    subdimensions?: Record<string, { dimensions: { label: string; values: string[] }[] }>;
  }[];
}

interface LocationViewProps {
  results: LocationResult[];
  selectedResultIndex: number | null;
  onSelectResult: (index: number) => void;
  moduleInfo?: ModuleInfo | null;
}

export function LocationView({
  results,
  selectedResultIndex,
  onSelectResult,
  moduleInfo,
}: LocationViewProps) {
  const [viewState, setViewState] = useState<{
    module: string | null;
    dimension: { label: string; value: string } | null;
  }>({ module: null, dimension: null });
  const [occupiedCells, setOccupiedCells] = useState<Set<string>>(new Set());
  const [gridDimensions, setGridDimensions] = useState<{ rows: string[]; cols: string[] } | null>(null);

  // When a result is selected, update the view to show that location
  useEffect(() => {
    if (selectedResultIndex !== null && results[selectedResultIndex]) {
      const result = results[selectedResultIndex];
      setViewState({
        module: result.moduleName,
        dimension: result.path.length > 0 ? result.path[0] : null,
      });

      // Fetch grid info and occupancy for this location
      fetchGridInfo(result.moduleName, result.path[0]);
    }
  }, [selectedResultIndex, results]);

  // When moduleInfo is provided (from "tell me about NEON"), show module overview
  useEffect(() => {
    if (moduleInfo && !selectedResultIndex) {
      setViewState({ module: moduleInfo.name, dimension: null });
    }
  }, [moduleInfo, selectedResultIndex]);

  const fetchGridInfo = async (moduleName: string, dimension?: { label: string; value: string }) => {
    if (!dimension) return;

    try {
      const params = new URLSearchParams({
        module: moduleName,
        dimensionLabel: dimension.label,
        dimensionValue: dimension.value,
      });
      const response = await fetch(`/api/modules/grid?${params}`);
      if (response.ok) {
        const data = await response.json();
        setGridDimensions(data.grid);
        setOccupiedCells(new Set(data.occupiedCells));
      }
    } catch {
      // Silently fail - grid just won't show occupancy
    }
  };

  const handleDimensionClick = (label: string, value: string) => {
    setViewState((prev) => ({
      ...prev,
      dimension: { label, value },
    }));
    if (viewState.module) {
      fetchGridInfo(viewState.module, { label, value });
    }
  };

  // Build result markers for the grid
  const resultMarkers = results
    .filter((r) => {
      if (!viewState.module || !viewState.dimension) return false;
      return (
        r.moduleName === viewState.module &&
        r.path.length > 0 &&
        r.path[0].label === viewState.dimension.label &&
        r.path[0].value === viewState.dimension.value
      );
    })
    .map((r) => {
      // Extract row and col from the path
      const row = r.path.find((p) => p.label === 'row')?.value;
      const col = r.path.find((p) => p.label === 'col')?.value;
      return {
        resultIndex: r.resultIndex,
        row,
        col,
      };
    })
    .filter((m) => m.row && m.col) as { resultIndex: number; row: string; col: string }[];

  // Color palette for result items (matches StorageGrid)
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

  // No results and no module info - show placeholder
  if (results.length === 0 && !moduleInfo) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 p-4 text-center">
        <div>
          <svg
            className="w-12 h-12 mx-auto mb-3 opacity-50"
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
          <p className="text-sm">Search results will appear here</p>
        </div>
      </div>
    );
  }

  // Show results list when there are results
  if (results.length > 0 && selectedResultIndex === null) {
    return (
      <div className="h-full flex flex-col p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Results ({results.length})
        </h3>
        <div className="flex-1 overflow-auto space-y-2">
          {results.map((result) => (
            <button
              key={result.resultIndex}
              onClick={() => onSelectResult(result.resultIndex)}
              className="w-full text-left p-2 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-5 h-5 ${RESULT_COLORS[result.resultIndex % RESULT_COLORS.length]} rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
                >
                  {result.resultIndex + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {result.itemName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {result.path.map((p) => `${p.value}`).join(' / ')}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Module overview mode (when user asks about a module)
  if (moduleInfo && !viewState.dimension) {
    return (
      <ModuleOverview
        module={moduleInfo}
        onDimensionClick={handleDimensionClick}
      />
    );
  }

  // Grid view mode
  if (viewState.module && viewState.dimension && gridDimensions) {
    const selectedResult = selectedResultIndex !== null ? results[selectedResultIndex] : null;

    return (
      <div className="h-full flex flex-col p-4">
        {/* Back button + Breadcrumb */}
        <div className="flex items-center gap-2 text-sm mb-4">
          {results.length > 1 && (
            <button
              onClick={() => onSelectResult(-1)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Back to results"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {viewState.module}
          </span>
          <span className="text-gray-400">›</span>
          <span className="text-gray-600 dark:text-gray-300">
            {viewState.dimension.label} {viewState.dimension.value}
          </span>
        </div>

        {/* Selected item info */}
        {selectedResult && (
          <div className="mb-3 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <div
                className={`w-5 h-5 ${RESULT_COLORS[selectedResult.resultIndex % RESULT_COLORS.length]} rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
              >
                {selectedResult.resultIndex + 1}
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {selectedResult.itemName}
              </span>
            </div>
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-auto">
          <StorageGrid
            rows={gridDimensions.rows}
            cols={gridDimensions.cols}
            occupiedCells={occupiedCells}
            resultMarkers={resultMarkers}
            selectedResultIndex={selectedResultIndex}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded" />
            <span>occupied</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-blue-500 rounded flex items-center justify-center text-white text-[10px] font-bold">
              1
            </div>
            <span>result</span>
          </div>
        </div>
      </div>
    );
  }

  // Loading or transitional state
  return (
    <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
      <p className="text-sm">Loading...</p>
    </div>
  );
}
