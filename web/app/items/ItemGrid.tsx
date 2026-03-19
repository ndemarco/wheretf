"use client";

import { useMemo } from "react";

interface RichItem {
  id: string;
  name: string;
  description: string | null;
  categories: {
    categoryId: string;
    isPrimary: boolean;
    name: string;
    icon: string | null;
    color: string | null;
  }[];
  aspects: {
    itemAspectId: string;
    aspectId: string;
    name: string;
    parameters: {
      parameterDefinitionId: string;
      value: unknown;
      parameterName: string;
      dataType: string;
      unit: string | null;
    }[];
  }[];
  standaloneParameters: {
    parameterDefinitionId: string;
    value: unknown;
    parameterName: string;
    dataType: string;
    unit: string | null;
  }[];
}

interface ColumnDef {
  id: string;
  label: string;
  type: "name" | "category" | "description" | "parameter";
  parameterDefinitionId?: string;
  unit?: string | null;
}

function getAllParams(item: RichItem) {
  return [
    ...item.aspects.flatMap((a) => a.parameters),
    ...item.standaloneParameters,
  ];
}

function getParamValue(item: RichItem, paramDefId: string): unknown {
  const all = getAllParams(item);
  return all.find((p) => p.parameterDefinitionId === paramDefId)?.value ?? null;
}

function formatValue(value: unknown, unit?: string | null): string {
  if (value === null || value === undefined) return "—";
  const str = String(value);
  return unit ? `${str} ${unit}` : str;
}

export default function ItemGrid({
  items,
  loading,
  selectedItemId,
  onSelectItem,
  sortBy,
  sortDirection,
  onSort,
  onRefresh,
  onCreateItem,
}: {
  items: RichItem[];
  loading: boolean;
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  sortBy: string;
  sortDirection: "asc" | "desc";
  onSort: (column: string) => void;
  onRefresh: () => void;
  onCreateItem: () => void;
}) {
  // Compute dynamic columns based on visible items
  const columns = useMemo<ColumnDef[]>(() => {
    const fixed: ColumnDef[] = [
      { id: "name", label: "Name", type: "name" },
      { id: "category", label: "", type: "category" },
      { id: "description", label: "Description", type: "description" },
    ];

    if (items.length === 0) return fixed;

    // Count parameter prevalence
    const paramCounts = new Map<
      string,
      { name: string; unit: string | null; count: number }
    >();

    for (const item of items) {
      const seen = new Set<string>();
      for (const param of getAllParams(item)) {
        if (seen.has(param.parameterDefinitionId)) continue;
        seen.add(param.parameterDefinitionId);
        const existing = paramCounts.get(param.parameterDefinitionId);
        if (existing) {
          existing.count++;
        } else {
          paramCounts.set(param.parameterDefinitionId, {
            name: param.parameterName,
            unit: param.unit,
            count: 1,
          });
        }
      }
    }

    // Show params present on 30%+ of items (min 1 item)
    const threshold = Math.max(1, Math.floor(items.length * 0.3));
    const paramColumns: ColumnDef[] = [...paramCounts.entries()]
      .filter(([, v]) => v.count >= threshold)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([id, v]) => ({
        id: `param_${id}`,
        label: v.name,
        type: "parameter" as const,
        parameterDefinitionId: id,
        unit: v.unit,
      }));

    return [...fixed, ...paramColumns];
  }, [items]);

  const handleRowClick = (itemId: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Multi-select deferred — just toggle for now
      onSelectItem(selectedItemId === itemId ? null : itemId);
    } else {
      onSelectItem(selectedItemId === itemId ? null : itemId);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 relative">
      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-800 border-b border-slate-700">
              {columns.map((col) => {
                const isSortable = col.type === "name" || col.type === "parameter";
                const isSorted =
                  (col.type === "name" && sortBy === "name") ||
                  (col.type === "parameter" &&
                    sortBy === col.parameterDefinitionId);

                return (
                  <th
                    key={col.id}
                    className={`px-3 py-2 text-left font-semibold text-slate-400 whitespace-nowrap ${
                      col.type === "category" ? "w-8" : ""
                    } ${
                      col.type === "name"
                        ? "sticky left-0 z-20 bg-slate-800"
                        : ""
                    } ${isSortable ? "cursor-pointer hover:text-slate-200 select-none" : ""}`}
                    onClick={() => {
                      if (col.type === "name") onSort("name");
                      else if (col.type === "parameter" && col.parameterDefinitionId)
                        onSort(col.parameterDefinitionId);
                    }}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {isSorted && (
                        <span className="text-accent">
                          {sortDirection === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-8 text-center text-slate-500"
                >
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-8 text-center text-slate-500"
                >
                  No items found
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const isSelected = item.id === selectedItemId;
                const primaryCat = item.categories.find((c) => c.isPrimary);

                return (
                  <tr
                    key={item.id}
                    onClick={(e) => handleRowClick(item.id, e)}
                    className={`border-b border-slate-800 cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-amber-950/30 border-l-3 border-l-accent"
                        : idx % 2 === 0
                          ? "bg-slate-900/50 hover:bg-slate-800/50"
                          : "bg-slate-900/30 hover:bg-slate-800/50"
                    }`}
                  >
                    {columns.map((col) => {
                      let content: React.ReactNode;

                      switch (col.type) {
                        case "name":
                          content = (
                            <span className="font-medium text-slate-100">
                              {item.name}
                            </span>
                          );
                          break;
                        case "category":
                          content = primaryCat?.icon ? (
                            <span title={primaryCat.name}>
                              {primaryCat.icon}
                            </span>
                          ) : null;
                          break;
                        case "description":
                          content = (
                            <span className="text-slate-400">
                              {item.description || "—"}
                            </span>
                          );
                          break;
                        case "parameter": {
                          const val = getParamValue(
                            item,
                            col.parameterDefinitionId!
                          );
                          content = (
                            <span
                              className={
                                val !== null
                                  ? "text-slate-300"
                                  : "text-slate-600"
                              }
                            >
                              {formatValue(val, col.unit)}
                            </span>
                          );
                          break;
                        }
                      }

                      return (
                        <td
                          key={col.id}
                          className={`px-3 py-2 whitespace-nowrap ${
                            col.type === "name"
                              ? "sticky left-0 z-10 " +
                                (isSelected
                                  ? "bg-amber-950/30"
                                  : idx % 2 === 0
                                    ? "bg-slate-900/95"
                                    : "bg-slate-900/80")
                              : ""
                          }`}
                        >
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* FAB */}
      <button
        onClick={onCreateItem}
        className="absolute bottom-4 right-4 w-12 h-12 bg-accent hover:bg-accent/80 text-white rounded-full shadow-lg flex items-center justify-center text-2xl font-light transition-colors z-20"
        title="New Item"
      >
        +
      </button>
    </div>
  );
}
