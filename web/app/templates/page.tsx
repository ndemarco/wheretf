"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import TemplateEditor from "./_components/TemplateEditor";

interface Template {
  id: string;
  name: string;
  description: string | null;
  currentVersion: number;
  activeVersion: number;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
  currentVersionData: {
    isParametric: boolean;
    rows: number | null;
    columns: number | null;
  } | null;
}

export default function TemplatesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("selected");
  const includeHidden = searchParams.get("includeHidden") === "true";

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    try {
      const url = includeHidden
        ? "/api/templates?includeHidden=true"
        : "/api/templates";
      const res = await fetch(url);
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    } finally {
      setLoading(false);
    }
  }, [includeHidden]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  function select(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("selected", id);
    else params.delete("selected");
    const qs = params.toString();
    router.replace(`/templates${qs ? `?${qs}` : ""}`);
  }

  function toggleIncludeHidden() {
    const params = new URLSearchParams(searchParams.toString());
    if (includeHidden) params.delete("includeHidden");
    else params.set("includeHidden", "true");
    const qs = params.toString();
    router.replace(`/templates${qs ? `?${qs}` : ""}`);
  }

  // If the currently-selected template disappeared from the list (e.g.
  // after deletion or after toggling includeHidden off), clear the
  // selection so the empty state shows.
  useEffect(() => {
    if (!selectedId || templates.length === 0) return;
    if (!templates.find((t) => t.id === selectedId)) {
      select(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, templates]);

  return (
    <div className="flex-1 flex min-w-0 h-full overflow-hidden">
      {/* Left — Template list */}
      <div className="w-80 border-r border-slate-700 flex flex-col shrink-0 overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between gap-2">
          <h1 className="text-base font-semibold text-slate-100">Templates</h1>
          <Link
            href="/templates/new"
            className="px-3 py-1 bg-accent text-white rounded text-xs font-medium hover:brightness-110 transition-all"
          >
            + New
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-slate-500 text-sm">
              Loading…
            </div>
          ) : templates.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">
              No templates yet.
            </div>
          ) : (
            <ul className="flex flex-col">
              {templates.map((t) => {
                const isSelected = t.id === selectedId;
                const ver = t.currentVersionData;
                const dims =
                  ver?.rows != null && ver?.columns != null
                    ? `${ver.rows}×${ver.columns}`
                    : "—";
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => select(t.id)}
                      className={`w-full text-left px-4 py-3 border-b border-slate-700/50 transition-colors ${
                        isSelected
                          ? "bg-slate-700/50"
                          : "hover:bg-slate-800/30"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-100 truncate flex-1">
                          {t.name}
                        </span>
                        {t.isHidden && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300 shrink-0">
                            hidden
                          </span>
                        )}
                      </div>
                      {t.description && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {t.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-500 tabular-nums">
                          v{t.currentVersion}
                        </span>
                        <span className="text-[10px] text-slate-500 tabular-nums">
                          {dims}
                        </span>
                        {ver?.isParametric && (
                          <span className="text-[10px] px-1 rounded bg-purple-900/40 text-purple-300">
                            parametric
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="p-3 border-t border-slate-700">
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={includeHidden}
              onChange={toggleIncludeHidden}
              className="accent-accent"
            />
            Show hidden templates
          </label>
        </div>
      </div>

      {/* Right — Detail / editor */}
      {selectedId ? (
        <TemplateEditor
          key={selectedId}
          templateId={selectedId}
          onDeleted={() => {
            select(null);
            fetchTemplates();
          }}
          onHidden={() => {
            fetchTemplates();
          }}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm px-6 text-center">
          Select a template to view or edit.
        </div>
      )}
    </div>
  );
}
