'use client';

import { useState, useEffect } from 'react';
import { StorageGrid } from './StorageGrid';

interface GridData {
  grid: { rows: string[]; cols: string[] };
  occupiedCells: string[];
  cellItems: Record<string, { itemName: string; itemDescription?: string }>;
  insert?: { id: string; name: string };
  totalAssignments: number;
}

interface FlatData {
  flat: true;
  items: {
    itemName: string;
    itemDescription?: string;
    itemParameters?: { key: string; value: string; unit?: string }[];
  }[];
  inserts: { id: string; name: string }[];
  children: { label: string; type: string; disabled: boolean }[];
}

interface LocationPaneProps {
  moduleId: string;
  moduleName: string;
  path: string[];
  onClose: () => void;
  refreshKey?: number;
}

export function LocationPane({ moduleId, moduleName, path, onClose, refreshKey }: LocationPaneProps) {
  const [data, setData] = useState<GridData | FlatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setSelectedCell(null);
      try {
        const res = await fetch(`/api/modules/${moduleId}/grid?path=${path.join(',')}`);
        if (!res.ok) throw new Error('Failed to load location');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [moduleId, path, refreshKey]);

  const handleCellClick = (row: string, col: string) => {
    const key = `row-${row}:col-${col}`;
    setSelectedCell(key === selectedCell ? null : key);
  };

  const gridData = data && 'grid' in data && data.grid ? (data as GridData) : null;
  const flatData = data && 'flat' in data ? (data as FlatData) : null;

  // Get selected cell's item info
  const selectedCellItem = selectedCell && gridData?.cellItems?.[selectedCell];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <div className="min-w-0">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {moduleName}
          </span>
          <span className="text-gray-400 mx-1.5">/</span>
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {path.join(' / ')}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
          title="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-3 border-accent-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-center py-8 text-red-500 text-sm">{error}</div>
        )}

        {/* Grid view */}
        {gridData && (
          <>
            {gridData.insert && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                {gridData.insert.name}
              </div>
            )}
            <StorageGrid
              rows={gridData.grid.rows}
              cols={gridData.grid.cols}
              occupiedCells={new Set(gridData.occupiedCells)}
              resultMarkers={[]}
              selectedResultIndex={null}
              onCellClick={handleCellClick}
              cellTooltips={gridData.cellItems}
            />
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-3">
              {gridData.totalAssignments} item{gridData.totalAssignments !== 1 ? 's' : ''} assigned
            </div>

            {/* Cell detail panel */}
            {selectedCellItem && (
              <div className="mt-4 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">
                  {selectedCellItem.itemName}
                </h4>
                {selectedCellItem.itemDescription && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {selectedCellItem.itemDescription}
                  </p>
                )}
              </div>
            )}

            {/* Empty cell selected */}
            {selectedCell && !selectedCellItem && (
              <div className="mt-4 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <p className="text-sm text-gray-400 dark:text-gray-500">Empty</p>
              </div>
            )}
          </>
        )}

        {/* Flat view */}
        {flatData && (
          <>
            {flatData.inserts.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  Inserts
                </h4>
                {flatData.inserts.map((ins) => (
                  <div
                    key={ins.id}
                    className="p-2 rounded border border-gray-200 dark:border-gray-700 text-sm mb-1"
                  >
                    {ins.name}
                  </div>
                ))}
              </div>
            )}

            {flatData.items.length > 0 ? (
              <div>
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  Items
                </h4>
                <div className="space-y-2">
                  {flatData.items.map((item, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                    >
                      <p className="font-medium text-sm text-gray-900 dark:text-gray-100">
                        {item.itemName}
                      </p>
                      {item.itemDescription && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {item.itemDescription}
                        </p>
                      )}
                      {item.itemParameters && item.itemParameters.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {item.itemParameters.map((p) => (
                            <span
                              key={p.key}
                              className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
                            >
                              {p.key}: {p.value}{p.unit ? ` ${p.unit}` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
                No items at this location
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
