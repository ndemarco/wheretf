'use client';

import { ModuleInfo } from './LocationView';

interface ModuleOverviewProps {
  module: ModuleInfo;
  onDimensionClick: (label: string, value: string) => void;
}

export function ModuleOverview({ module, onDimensionClick }: ModuleOverviewProps) {
  return (
    <div className="h-full flex flex-col p-4">
      {/* Module header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {module.name}
        </h3>
        {module.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {module.description}
          </p>
        )}
      </div>

      {/* Dimensions list */}
      <div className="flex-1 overflow-auto">
        {module.dimensions.map((dim) => (
          <div key={dim.label} className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 capitalize">
              {dim.label}s
            </h4>
            <div className="flex flex-wrap gap-2">
              {dim.values.map((value) => {
                const hasSubdimensions = dim.subdimensions?.[value];
                return (
                  <button
                    key={value}
                    onClick={() => onDimensionClick(dim.label, value)}
                    className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                      hasSubdimensions
                        ? 'bg-accent-50 dark:bg-accent-900/30 border-accent-200 dark:border-accent-800 text-accent-700 dark:text-accent-300 hover:bg-accent-100 dark:hover:bg-accent-900/50'
                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {value}
                    {hasSubdimensions && (
                      <span className="ml-1 text-accent-400 dark:text-accent-500">▸</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Hint */}
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
        Click a location with ▸ to view its grid
      </p>
    </div>
  );
}
