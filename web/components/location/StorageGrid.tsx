'use client';

import { useState } from 'react';

// Color palette for result markers (cycles through these)
const RESULT_COLORS = [
  'bg-accent-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-yellow-500',
  'bg-red-500',
];

interface StorageGridProps {
  rows: string[];
  cols: string[];
  occupiedCells: Set<string>; // Format: "row-A:col-3"
  resultMarkers: { resultIndex: number; row: string; col: string }[];
  selectedResultIndex: number | null;
  onCellClick?: (row: string, col: string) => void;
  cellTooltips?: Record<string, { itemName: string; itemDescription?: string }>;
}

export function StorageGrid({
  rows,
  cols,
  occupiedCells,
  resultMarkers,
  selectedResultIndex,
  onCellClick,
  cellTooltips,
}: StorageGridProps) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  // Build a map of cell -> result for quick lookup
  const resultMap = new Map<string, number>();
  for (const marker of resultMarkers) {
    const key = `row-${marker.row}:col-${marker.col}`;
    resultMap.set(key, marker.resultIndex);
  }

  const getCellLabel = (row: string, col: string) => `${row}${col}`;

  const getCellContent = (row: string, col: string) => {
    const cellKey = `row-${row}:col-${col}`;
    const label = getCellLabel(row, col);
    const resultIndex = resultMap.get(cellKey);

    if (resultIndex !== undefined) {
      const colorClass = RESULT_COLORS[resultIndex % RESULT_COLORS.length];
      const isSelected = resultIndex === selectedResultIndex;
      return (
        <div
          className={`w-full h-full ${colorClass} rounded flex items-center justify-center text-white text-xs font-bold ${
            isSelected ? 'ring-2 ring-offset-1 ring-black dark:ring-white' : ''
          }`}
        >
          {label}
        </div>
      );
    }

    if (occupiedCells.has(cellKey)) {
      return (
        <div className="w-full h-full bg-gray-800 dark:bg-gray-200 rounded flex items-center justify-center text-white dark:text-gray-900 text-xs font-semibold">
          {label}
        </div>
      );
    }

    // Empty cell — show label subdued
    return (
      <div className="w-full h-full rounded flex items-center justify-center text-gray-300 dark:text-gray-600 text-xs">
        {label}
      </div>
    );
  };

  return (
    <div className="inline-block relative">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols.length}, 2.5rem)` }}>
        {rows.map((row) =>
          cols.map((col) => {
            const cellKey = `row-${row}:col-${col}`;
            const tooltip = cellTooltips?.[cellKey];
            const isHovered = hoveredCell === cellKey;

            return (
              <div
                key={`${row}-${col}`}
                className={`w-10 h-10 relative ${
                  onCellClick ? 'cursor-pointer' : ''
                }`}
                onClick={() => onCellClick?.(row, col)}
                onMouseEnter={() => setHoveredCell(cellKey)}
                onMouseLeave={() => setHoveredCell(null)}
              >
                {getCellContent(row, col)}
                {/* Tooltip */}
                {isHovered && cellTooltips && (
                  <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded shadow-lg whitespace-nowrap pointer-events-none">
                    {tooltip ? tooltip.itemName : 'Empty'}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
