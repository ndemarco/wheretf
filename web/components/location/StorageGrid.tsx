'use client';

// Color palette for result markers (cycles through these)
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

interface StorageGridProps {
  rows: string[];
  cols: string[];
  occupiedCells: Set<string>; // Format: "row-A:col-3"
  resultMarkers: { resultIndex: number; row: string; col: string }[];
  selectedResultIndex: number | null;
}

export function StorageGrid({
  rows,
  cols,
  occupiedCells,
  resultMarkers,
  selectedResultIndex,
}: StorageGridProps) {
  // Build a map of cell -> result for quick lookup
  const resultMap = new Map<string, number>();
  for (const marker of resultMarkers) {
    const key = `row-${marker.row}:col-${marker.col}`;
    resultMap.set(key, marker.resultIndex);
  }

  const getCellContent = (row: string, col: string) => {
    const cellKey = `row-${row}:col-${col}`;
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
          {resultIndex + 1}
        </div>
      );
    }

    if (occupiedCells.has(cellKey)) {
      return <div className="w-full h-full bg-gray-300 dark:bg-gray-600 rounded" />;
    }

    // Empty cell - no content
    return null;
  };

  return (
    <div className="inline-block">
      <table className="border-collapse">
        <thead>
          <tr>
            {/* Empty corner cell */}
            <th className="w-8 h-8" />
            {/* Column headers */}
            {cols.map((col) => (
              <th
                key={col}
                className="w-8 h-6 text-xs text-gray-500 dark:text-gray-400 font-normal text-center"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row}>
              {/* Row header */}
              <td className="w-6 h-8 text-xs text-gray-500 dark:text-gray-400 text-right pr-2">
                {row}
              </td>
              {/* Cells */}
              {cols.map((col) => (
                <td
                  key={`${row}-${col}`}
                  className="w-8 h-8 p-0.5 border border-gray-100 dark:border-gray-800"
                >
                  {getCellContent(row, col)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
