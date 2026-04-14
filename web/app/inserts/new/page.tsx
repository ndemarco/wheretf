"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface TemplateOption {
  id: string;
  name: string;
  description: string | null;
  currentVersionData: {
    id: string;
    isParametric: boolean;
    rows: number | null;
    columns: number | null;
    minRows: number | null;
    maxRows: number | null;
    minColumns: number | null;
    maxColumns: number | null;
  } | null;
}

export default function NewInsertPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [name, setName] = useState("");
  const [rows, setRows] = useState<number | "">("");
  const [columns, setColumns] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      setTemplates(data.templates ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const selected = templates.find((t) => t.id === templateId);
  const ver = selected?.currentVersionData ?? null;
  const isParametric = !!ver?.isParametric;

  // Default dimensions when template picked
  useEffect(() => {
    if (!ver) {
      setRows("");
      setColumns("");
      return;
    }
    if (ver.isParametric) {
      setRows(ver.minRows ?? 1);
      setColumns(ver.minColumns ?? 1);
    } else {
      setRows(ver.rows ?? 1);
      setColumns(ver.columns ?? 1);
    }
  }, [templateId, ver]);

  async function submit() {
    if (!selected || !ver) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        templateId: selected.id,
        templateVersionId: ver.id,
        name: name.trim() || undefined,
      };
      if (isParametric) {
        body.rows = Number(rows) || 1;
        body.columns = Number(columns) || 1;
      }
      const res = await fetch("/api/inserts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create insert");
        return;
      }
      const data = await res.json();
      router.push(`/inserts?selected=${data.insert.id}`);
    } catch (err) {
      console.error(err);
      setError("Unexpected error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto max-w-xl">
      <div className="p-6 flex-1">
        <Link
          href="/inserts"
          className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          &larr; Back to inserts
        </Link>

        <h1 className="text-xl font-semibold text-slate-100 mt-4">
          New Insert
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Create a new physical insert. You can place it in a receptacle
          later from the insert&apos;s detail page.
        </p>

        {error && (
          <div className="mt-4 px-3 py-2 bg-red-900/30 border border-red-700/50 rounded text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="mt-6 space-y-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider">
              Template
            </span>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              disabled={loading}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 focus:border-accent focus:outline-none"
            >
              <option value="">{loading ? "Loading…" : "Select a template"}</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {selected?.description && (
              <span className="text-xs text-slate-500 mt-1">
                {selected.description}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider">
              Name (optional)
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                selected ? `e.g., ${selected.name} #1` : "Name this insert"
              }
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 placeholder:text-slate-600 focus:border-accent focus:outline-none"
            />
          </label>

          {isParametric && ver && (
            <div className="flex gap-4">
              <label className="flex flex-col gap-1 flex-1">
                <span className="text-xs text-slate-400 uppercase tracking-wider">
                  Rows
                  {ver.minRows != null && ver.maxRows != null && (
                    <span className="text-slate-600 normal-case ml-1">
                      ({ver.minRows}–{ver.maxRows})
                    </span>
                  )}
                </span>
                <input
                  type="number"
                  min={ver.minRows ?? 1}
                  max={ver.maxRows ?? 26}
                  value={rows}
                  onChange={(e) =>
                    setRows(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 focus:border-accent focus:outline-none tabular-nums"
                />
              </label>
              <label className="flex flex-col gap-1 flex-1">
                <span className="text-xs text-slate-400 uppercase tracking-wider">
                  Columns
                  {ver.minColumns != null && ver.maxColumns != null && (
                    <span className="text-slate-600 normal-case ml-1">
                      ({ver.minColumns}–{ver.maxColumns})
                    </span>
                  )}
                </span>
                <input
                  type="number"
                  min={ver.minColumns ?? 1}
                  max={ver.maxColumns ?? 26}
                  value={columns}
                  onChange={(e) =>
                    setColumns(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 focus:border-accent focus:outline-none tabular-nums"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-700 bg-slate-900/80 backdrop-blur px-6 py-3 flex items-center justify-end gap-3 shrink-0">
        <Link
          href="/inserts"
          className="px-5 py-2 border border-slate-600 text-slate-300 rounded-md hover:bg-slate-700/50 transition-colors text-sm"
        >
          Cancel
        </Link>
        <button
          onClick={submit}
          disabled={!selected || saving}
          className="px-5 py-2 bg-accent text-white rounded-md hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {saving ? "Creating…" : "Create insert"}
        </button>
      </div>
    </div>
  );
}
