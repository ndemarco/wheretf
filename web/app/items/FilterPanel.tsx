"use client";

import { useRef } from "react";

interface FilterPill {
  parameterDefinitionId: string;
  parameterName: string;
  value: unknown;
}

interface CategoryCount {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  count: number;
}

export default function FilterPanel({
  query,
  onQueryChange,
  filterPills,
  onRemoveFilter,
  categoryCounts,
  activeCategoryId,
  onCategoryClick,
  fetchError,
  onRetry,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  filterPills: FilterPill[];
  onRemoveFilter: (parameterDefinitionId: string) => void;
  categoryCounts: CategoryCount[];
  activeCategoryId: string;
  onCategoryClick: (categoryId: string) => void;
  fetchError?: string | null;
  onRetry?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onQueryChange(value);
    }, 300);
  };

  return (
    <div className="w-70 bg-slate-800 border-r border-slate-700 flex flex-col shrink-0 overflow-y-auto">
      {fetchError && (
        <div className="p-2 bg-rose-900/40 border-b border-rose-500/40 text-xs text-rose-200 flex items-center justify-between gap-2">
          <span className="truncate" title={fetchError}>
            Showing cached data — {fetchError}
          </span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-rose-100 hover:text-white underline shrink-0"
            >
              Retry
            </button>
          )}
        </div>
      )}
      {/* Search */}
      <div className="p-3 border-b border-slate-700">
        <div className="relative flex items-center">
          <svg
            className="absolute left-2.5 w-3.5 h-3.5 text-slate-500 pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            defaultValue={query}
            onChange={handleSearchInput}
            placeholder="Search items..."
            className="w-full pl-8 pr-8 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-slate-200 text-xs font-inherit outline-none focus:border-accent placeholder:text-slate-600 transition-colors"
          />
          {query && (
            <button
              onClick={() => {
                onQueryChange("");
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="absolute right-2 text-slate-500 hover:text-red-400 text-sm leading-none transition-colors"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Filter Pills */}
      {filterPills.length > 0 && (
        <div className="p-3 border-b border-slate-700 flex flex-wrap gap-1.5">
          {filterPills.map((pill) => (
            <span
              key={pill.parameterDefinitionId}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-900 border border-slate-600 rounded-full text-xs"
            >
              <span className="text-accent">
                {pill.parameterName || pill.parameterDefinitionId}:
              </span>
              <span className="text-slate-300">{String(pill.value)}</span>
              <button
                onClick={() => onRemoveFilter(pill.parameterDefinitionId)}
                className="text-slate-500 hover:text-red-400 ml-0.5 leading-none transition-colors"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Categories */}
      <div className="p-3">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Categories
        </h3>
        {categoryCounts.length === 0 ? (
          <p className="text-xs text-slate-600">No categories</p>
        ) : (
          <div className="space-y-0.5">
            {categoryCounts.map((cat) => (
              <button
                key={cat.id}
                onClick={() => onCategoryClick(cat.id)}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors ${
                  activeCategoryId === cat.id
                    ? "bg-amber-950/40 text-accent"
                    : "text-slate-300 hover:bg-slate-700/50"
                }`}
              >
                <span className="flex items-center gap-2">
                  {cat.icon && (
                    <span className="text-slate-500">{cat.icon}</span>
                  )}
                  <span>{cat.name}</span>
                </span>
                <span className="text-slate-500">{cat.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
