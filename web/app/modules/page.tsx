"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Module {
  id: string;
  name: string;
  description: string | null;
  primaryDimensionLabel: string;
  primaryDimensionCount: number;
  updatedAt: string;
}

export default function ModulesPage() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchModules = useCallback(async () => {
    try {
      const res = await fetch("/api/modules");
      const data = await res.json();
      setModules(data.modules || []);
    } catch (err) {
      console.error("Failed to fetch modules:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        Loading...
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <p className="text-slate-500">
          No modules yet. Create your first storage module to start organizing.
        </p>
        <Link
          href="/modules/new"
          className="px-4 py-2 bg-accent text-white rounded-md hover:brightness-110 transition-all"
        >
          New Module
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-100">Modules</h1>
        <Link
          href="/modules/new"
          className="px-4 py-2 bg-accent text-white rounded-md hover:brightness-110 transition-all text-sm"
        >
          New Module
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {modules.map((m) => (
          <Link
            key={m.id}
            href={`/modules/${m.id}`}
            className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:border-accent/50 hover:bg-slate-800 transition-all group"
          >
            <h2 className="text-base font-semibold text-slate-100 group-hover:text-accent transition-colors">
              {m.name}
            </h2>
            {m.description && (
              <p className="text-sm text-slate-400 mt-1 truncate">
                {m.description}
              </p>
            )}
            <p className="text-sm text-slate-500 mt-3">
              {m.primaryDimensionCount}{" "}
              {m.primaryDimensionCount === 1
                ? m.primaryDimensionLabel
                : m.primaryDimensionLabel + "s"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
