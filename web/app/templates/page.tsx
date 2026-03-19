"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Template {
  id: string;
  name: string;
  description: string | null;
  currentVersion: number;
  activeVersion: number;
  createdAt: string;
  updatedAt: string;
  currentVersionData: {
    isParametric: boolean;
    rows: number | null;
    columns: number | null;
  } | null;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        Loading...
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <p className="text-slate-500">
          No templates defined. Create a template to define reusable storage
          layouts.
        </p>
        <Link
          href="/templates/new"
          className="px-4 py-2 bg-accent text-white rounded-md hover:brightness-110 transition-all"
        >
          New Template
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-100">Templates</h1>
        <Link
          href="/templates/new"
          className="px-4 py-2 bg-accent text-white rounded-md hover:brightness-110 transition-all text-sm"
        >
          New Template
        </Link>
      </div>

      <div className="overflow-auto rounded-lg border border-slate-700">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/50">
              <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Version
              </th>
              <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Dimensions
              </th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => {
              const ver = t.currentVersionData;
              const type = ver?.isParametric ? "Parametric" : "Fixed";
              const dims =
                ver?.rows != null && ver?.columns != null
                  ? `${ver.rows} × ${ver.columns}`
                  : "—";

              return (
                <tr
                  key={t.id}
                  className="border-b border-slate-700/50 hover:bg-slate-800/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/templates/${t.id}`}
                      className="block text-slate-100 hover:text-accent transition-colors"
                    >
                      {t.name}
                      {t.description && (
                        <span className="block text-xs text-slate-500 mt-0.5 truncate max-w-xs">
                          {t.description}
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        ver?.isParametric
                          ? "bg-purple-900/50 text-purple-300"
                          : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    v{t.currentVersion}
                  </td>
                  <td className="px-4 py-3 text-slate-300 tabular-nums">
                    {dims}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}