'use client';

import { useState, useEffect } from 'react';
import { LocationResult, ModuleInfo } from './LocationView';
import { StorageGrid } from './StorageGrid';
import { ModuleOverview } from './ModuleOverview';

interface LocationMapPanelProps {
  selectedResult: LocationResult | null;
  allResults: LocationResult[];
  moduleInfo?: ModuleInfo | null;
  onDimensionSelect?: (moduleName: string, dimension: { label: string; value: string }) => void;
}

interface GridData {
  flat: boolean;
  grid?: { rows: string[]; cols: string[] };
  occupiedCells?: string[];
  items?: { name: string; location: string; description?: string }[];
  location?: string;
}

export function LocationMapPanel({
  selectedResult,
  allResults,
  moduleInfo,
  onDimensionSelect,
}: LocationMapPanelProps) {
  const [gridData, setGridData] = useState<GridData | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch grid data when selected result changes
  useEffect(() => {
    if (!selectedResult || selectedResult.path.length === 0) {
      setGridData(null);
      return;
    }

    const fetchData = async () => {
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

  // Build markers for all results that are in the same location as selected
  const getResultMarkers = () => {
    if (!selectedResult || !gridData || gridData.flat) return [];

    const markers: { resultIndex: number; row: string; col: string }[] = [];
    for (const result of allResults) {
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
    return markers;
  };

  // No result selected - show placeholder or module overview
  if (!selectedResult) {
    if (moduleInfo) {
      return (
        <ModuleOverview
          module={moduleInfo}
          onDimensionClick={(label, value) => {
            onDimensionSelect?.(moduleInfo.name, { label, value });
          }}
        />
      );
    }

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
          <p className="text-xs">Select a result to see location</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-3">
      {/* Breadcrumb header */}
      <div className="flex items-center gap-1 text-sm mb-3 flex-wrap">
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
      <div className="flex-1 overflow-auto">
        {gridData?.flat ? (
          // Flat location - show items list
          <div className="space-y-2">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
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
                      ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20'
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
        ) : gridData?.grid ? (
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
        ) : (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            No grid data available
          </div>
        )}
      </div>
    </div>
  );
}
