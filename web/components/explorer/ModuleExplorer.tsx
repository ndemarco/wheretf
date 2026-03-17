'use client';

import { useState, useEffect, useCallback } from 'react';
import { Breadcrumb, BreadcrumbSegment } from './Breadcrumb';

interface ValueSummary {
  label: string;
  type: string;
  disabled: boolean;
  childCount: number;
  hasTemplate: boolean;
  assignmentCount: number;
  inserts: string[];
}

interface ModuleSummary {
  id: string;
  name: string;
  description?: string;
  dimensionName: string;
  valueCount: number;
  values: ValueSummary[];
  totalLocations: number;
  assignedLocations: number;
}

interface ModuleDetail {
  id: string;
  name: string;
  description?: string;
  primaryDimension: {
    name: string;
    values: {
      label: string;
      location: {
        type: string;
        disabled: boolean;
        childCount: number;
        hasTemplate: boolean;
      };
    }[];
  };
}

interface ModuleExplorerProps {
  onSelectLocation?: (moduleId: string, moduleName: string, path: string[]) => void;
  refreshKey?: number;
}

function dimensionLabel(name: string, count: number): string {
  const singular = name.toLowerCase();
  if (count === 1) return `1 ${singular}`;
  // Simple pluralization
  if (singular.endsWith('f')) return `${count} ${singular.slice(0, -1)}ves`;
  return `${count} ${singular}s`;
}

export function ModuleExplorer({ onSelectLocation, refreshKey }: ModuleExplorerProps) {
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [selectedModule, setSelectedModule] = useState<ModuleDetail | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/modules');
      if (!res.ok) throw new Error('Failed to load modules');
      const data = await res.json();
      setModules(data.modules);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules, refreshKey]);

  const handleSelectModule = async (mod: ModuleSummary) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/modules/${mod.id}`);
      if (!res.ok) throw new Error('Failed to load module');
      const data = await res.json();
      setSelectedModule(data.module);
      setBreadcrumb([{ label: mod.name, id: mod.id }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectValue = (moduleId: string, moduleName: string, label: string, dimName: string) => {
    const path = [label];
    if (!selectedModule) {
      // Clicked from card inline — set breadcrumb directly
      setBreadcrumb([
        { label: moduleName, id: moduleId },
        { label: `${dimName} ${label}` },
      ]);
    } else {
      setBreadcrumb((prev) => [
        ...prev,
        { label: `${selectedModule.primaryDimension.name} ${label}` },
      ]);
    }
    onSelectLocation?.(moduleId, moduleName, path);
  };

  const handleBreadcrumbNavigate = (depth: number) => {
    if (depth === 0) {
      setSelectedModule(null);
      setBreadcrumb([]);
      fetchModules();
    } else if (depth === 1) {
      setBreadcrumb((prev) => prev.slice(0, 1));
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-accent-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-500 mb-2">{error}</p>
          <button
            onClick={fetchModules}
            className="text-sm text-accent-500 hover:text-accent-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Breadcrumb */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <Breadcrumb segments={breadcrumb} onNavigate={handleBreadcrumbNavigate} />
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* Module list */}
        {!selectedModule && (
          <div className="space-y-4">
            {modules.length === 0 ? (
              <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                <p className="text-lg mb-2">No modules yet</p>
                <p className="text-sm">Use the chat to create your first storage module.</p>
              </div>
            ) : (
              modules.map((mod) => {
                const occupancyPct =
                  mod.totalLocations > 0
                    ? Math.round((mod.assignedLocations / mod.totalLocations) * 100)
                    : 0;
                return (
                  <div
                    key={mod.id}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
                  >
                    {/* Module header — clickable for detail view */}
                    <button
                      onClick={() => handleSelectModule(mod)}
                      className="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {mod.name}
                          </h3>
                          {mod.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                              {mod.description}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {dimensionLabel(mod.dimensionName, mod.valueCount)}
                          </span>
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {occupancyPct}% occupied
                          </div>
                        </div>
                      </div>
                      {/* Occupancy bar */}
                      <div className="mt-2 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent-500 rounded-full transition-all"
                          style={{ width: `${occupancyPct}%` }}
                        />
                      </div>
                    </button>

                    {/* Inline level summary — vertical stacked list */}
                    <div className="border-t border-gray-100 dark:border-gray-700/50">
                      <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-700/50">
                        {mod.values.map((v) => {
                          const hasContent = v.assignmentCount > 0 || v.inserts.length > 0;
                          return (
                            <button
                              key={v.label}
                              onClick={() => handleSelectValue(mod.id, mod.name, v.label, mod.dimensionName)}
                              disabled={v.disabled}
                              className={`flex items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                                v.disabled
                                  ? 'opacity-40 cursor-not-allowed'
                                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                              }`}
                            >
                              <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                                v.disabled
                                  ? 'bg-gray-300 dark:bg-gray-600'
                                  : hasContent
                                    ? 'bg-accent-500'
                                    : 'bg-gray-300 dark:bg-gray-600'
                              }`} />
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
                                  {mod.dimensionName} {v.label}
                                </div>
                                <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                  {v.inserts.length > 0
                                    ? v.inserts.join(', ')
                                    : v.assignmentCount > 0
                                      ? `${v.assignmentCount} item${v.assignmentCount !== 1 ? 's' : ''}`
                                      : 'Empty'}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Module detail: dimension values */}
        {selectedModule && breadcrumb.length === 1 && (
          <div>
            {selectedModule.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {selectedModule.description}
              </p>
            )}
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 capitalize">
              {selectedModule.primaryDimension.name}s
            </h4>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {selectedModule.primaryDimension.values.map((v) => (
                <button
                  key={v.label}
                  onClick={() => handleSelectValue(selectedModule.id, selectedModule.name, v.label, selectedModule.primaryDimension.name)}
                  disabled={v.location.disabled}
                  className={`p-3 rounded-lg border text-center transition-colors ${
                    v.location.disabled
                      ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-700'
                      : v.location.childCount > 0 || v.location.hasTemplate
                        ? 'border-accent-200 dark:border-accent-800 bg-accent-50 dark:bg-accent-900/20 hover:bg-accent-100 dark:hover:bg-accent-900/40 text-accent-700 dark:text-accent-300'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-accent-500 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span className="text-lg font-medium">{v.label}</span>
                  <span className="block text-xs text-gray-400 dark:text-gray-500 mt-0.5 capitalize">
                    {v.location.type}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
