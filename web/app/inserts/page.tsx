"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

interface Insert {
  id: string;
  uid: string | null;
  name: string | null;
  templateId: string | null;
  templateVersionId: string | null;
  locationId: string | null;
  rows: number | null;
  columns: number | null;
  templateName: string | null;
  interfaceType: string | null;
  locationPath: string | null;
  moduleName: string | null;
}

interface TemplateOption {
  id: string;
  name: string;
}

export default function InsertsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const templateId = searchParams.get("templateId") ?? "";
  const interfaceType = searchParams.get("interfaceType") ?? "";
  const placement = (searchParams.get("placement") ?? "all") as
    | "all"
    | "placed"
    | "unplaced";
  const selectedId = searchParams.get("selected") ?? null;

  const [inserts, setInserts] = useState<Insert[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInserts = useCallback(async () => {
    const qs = new URLSearchParams();
    if (templateId) qs.set("templateId", templateId);
    if (interfaceType) qs.set("interfaceType", interfaceType);
    qs.set("placement", placement);
    try {
      const res = await fetch(`/api/inserts?${qs.toString()}`);
      const data = await res.json();
      setInserts(data.inserts ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [templateId, interfaceType, placement]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      setTemplates(
        (data.templates ?? []).map((t: { id: string; name: string }) => ({
          id: t.id,
          name: t.name,
        }))
      );
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchInserts();
  }, [fetchInserts]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  function setParam(key: string, value: string | null) {
    const p = new URLSearchParams(searchParams.toString());
    if (value == null || value === "") p.delete(key);
    else p.set(key, value);
    const qs = p.toString();
    router.replace(`/inserts${qs ? `?${qs}` : ""}`);
  }

  const interfaceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const ins of inserts) if (ins.interfaceType) set.add(ins.interfaceType);
    return [...set].sort();
  }, [inserts]);

  const selected = inserts.find((i) => i.id === selectedId) ?? null;

  return (
    <div className="flex-1 flex min-w-0 h-full overflow-hidden">
      {/* Left — filters + list */}
      <div className="w-96 border-r border-slate-700 flex flex-col shrink-0 overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-slate-100">Inserts</h1>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              Physical instances of templates
            </p>
          </div>
          <Link
            href="/inserts/new"
            className="px-3 py-1 bg-accent text-white rounded text-xs font-medium hover:brightness-110 transition-all shrink-0"
          >
            + New
          </Link>
        </div>

        <div className="p-3 border-b border-slate-700 space-y-2">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-20 shrink-0">Template</span>
            <select
              value={templateId}
              onChange={(e) => setParam("templateId", e.target.value || null)}
              className="flex-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 focus:border-accent focus:outline-none"
            >
              <option value="">All templates</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-20 shrink-0">Interface</span>
            <select
              value={interfaceType}
              onChange={(e) => setParam("interfaceType", e.target.value || null)}
              className="flex-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 focus:border-accent focus:outline-none"
            >
              <option value="">All interfaces</option>
              {interfaceOptions.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-1 text-xs">
            {(["all", "placed", "unplaced"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setParam("placement", v === "all" ? null : v)}
                className={`flex-1 px-2 py-1 rounded border transition-colors ${
                  placement === v
                    ? "bg-slate-700 border-slate-600 text-slate-100"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
                }`}
              >
                {v === "all" ? "All" : v === "placed" ? "Placed" : "Unplaced"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-slate-500 text-sm">
              Loading…
            </div>
          ) : inserts.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">
              No inserts match the current filters.
            </div>
          ) : (
            <ul className="flex flex-col">
              {inserts.map((ins) => {
                const isSelected = ins.id === selectedId;
                const displayName =
                  ins.name ?? ins.templateName ?? "Insert";
                return (
                  <li key={ins.id}>
                    <button
                      onClick={() => setParam("selected", ins.id)}
                      className={`w-full text-left px-4 py-3 border-b border-slate-700/50 transition-colors ${
                        isSelected
                          ? "bg-slate-700/50"
                          : "hover:bg-slate-800/30"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-100 truncate flex-1">
                          {displayName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {ins.templateName && (
                          <span className="text-[11px] text-slate-400 truncate">
                            {ins.templateName}
                          </span>
                        )}
                        {ins.interfaceType && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 shrink-0">
                            {ins.interfaceType}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {ins.locationPath ? (
                          <>at {ins.locationPath}</>
                        ) : (
                          <span className="text-amber-400/80">unplaced</span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Right — detail */}
      {selected ? (
        <InsertDetail
          key={selected.id}
          insert={selected}
          onChanged={fetchInserts}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm px-6 text-center">
          Select an insert to view its details.
        </div>
      )}
    </div>
  );
}

interface Receptacle {
  id: string;
  path: string;
  label: string;
  interfaceTypeAccepted: string | null;
  moduleId: string;
  moduleName: string | null;
}

function InsertDetail({
  insert,
  onChanged,
}: {
  insert: Insert;
  onChanged: () => void;
}) {
  const [draftName, setDraftName] = useState(insert.name ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Place/Move picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [receptacles, setReceptacles] = useState<Receptacle[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [placing, setPlacing] = useState(false);

  // Cells (grid)
  const [cells, setCells] = useState<
    Array<{
      id: string;
      label: string;
      gridRow: number | null;
      gridColumn: number | null;
      isDisabled: boolean;
    }>
  >([]);

  useEffect(() => {
    setDraftName(insert.name ?? "");
    setEditing(false);
    setPickerOpen(false);
    (async () => {
      try {
        const res = await fetch(`/api/locations?insertId=${insert.id}`);
        const data = await res.json();
        setCells(data.locations ?? []);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [insert.id, insert.name]);

  async function openPicker() {
    setPickerOpen(true);
    setPickerLoading(true);
    try {
      const res = await fetch(
        `/api/inserts/${insert.id}/compatible-receptacles`
      );
      const data = await res.json();
      setReceptacles(data.receptacles ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setPickerLoading(false);
    }
  }

  async function placeAt(locationId: string) {
    setPlacing(true);
    try {
      const res = await fetch(`/api/inserts/${insert.id}/place`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to place");
        return;
      }
      setPickerOpen(false);
      onChanged();
    } catch (err) {
      console.error(err);
    } finally {
      setPlacing(false);
    }
  }

  async function saveName() {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/inserts/${insert.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draftName.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to save");
        return;
      }
      setEditing(false);
      onChanged();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function unplace() {
    if (!confirm("Remove this insert from its location?")) return;
    try {
      const res = await fetch(`/api/inserts/${insert.id}/place`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to unplace");
        return;
      }
      onChanged();
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteInsert() {
    if (!confirm("Delete this insert? This cannot be undone via the UI.")) return;
    try {
      const res = await fetch(`/api/inserts/${insert.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete");
        return;
      }
      onChanged();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <div className="p-6 border-b border-slate-700 space-y-2">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder={insert.templateName ?? "Insert name"}
              className="flex-1 text-lg font-semibold text-slate-100 bg-slate-800 border border-slate-600 rounded px-2 py-1 focus:border-accent focus:outline-none"
            />
            <button
              onClick={saveName}
              disabled={saving}
              className="px-3 py-1 bg-accent text-white rounded text-xs hover:brightness-110 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => {
                setDraftName(insert.name ?? "");
                setEditing(false);
              }}
              className="px-3 py-1 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-100 truncate flex-1">
              {insert.name || insert.templateName || "Untitled insert"}
            </h2>
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-slate-400 hover:text-accent"
            >
              Edit
            </button>
          </div>
        )}
      </div>

      <div className="p-6 grid grid-cols-2 gap-x-6 gap-y-4 max-w-2xl">
        <Field label="Template">
          {insert.templateId ? (
            <Link
              href={`/templates?selected=${insert.templateId}`}
              className="text-slate-200 hover:text-accent"
            >
              {insert.templateName ?? "(unknown)"}
            </Link>
          ) : (
            <span className="text-slate-500">—</span>
          )}
        </Field>
        <Field label="Interface">
          {insert.interfaceType ? (
            <span className="inline-block text-xs px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300">
              {insert.interfaceType}
            </span>
          ) : (
            <span className="text-slate-500">—</span>
          )}
        </Field>
        <Field label="Dimensions">
          {insert.rows != null && insert.columns != null
            ? `${insert.rows} × ${insert.columns}`
            : "—"}
        </Field>
        <Field label="Placement">
          {insert.locationPath ? (
            <span>
              {insert.moduleName && (
                <Link
                  href={`/modules/`}
                  className="text-slate-200 hover:text-accent"
                >
                  {insert.moduleName}
                </Link>
              )}{" "}
              <span className="text-slate-400">
                {insert.locationPath.replace(
                  insert.moduleName ? insert.moduleName + ":" : "",
                  ""
                )}
              </span>
            </span>
          ) : (
            <span className="text-amber-400">Unplaced</span>
          )}
        </Field>
      </div>

      {/* Grid (cells materialized at create time) */}
      <div className="px-6 pb-6">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">
          Layout
        </div>
        {cells.length === 0 ? (
          <div className="text-sm text-slate-500">
            No cells. Template has no grid, or insert was created without one.
          </div>
        ) : (
          <InsertGrid cells={cells} />
        )}
      </div>

      <div className="p-6 pt-0 mt-auto flex items-center gap-2 border-t border-slate-700 pt-4">
        <button
          onClick={openPicker}
          className="px-3 py-1.5 bg-accent text-white rounded text-xs hover:brightness-110 transition-all"
        >
          {insert.locationId ? "Move to…" : "Place in…"}
        </button>
        {insert.locationId && (
          <button
            onClick={unplace}
            className="px-3 py-1.5 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50"
          >
            Unplace
          </button>
        )}
        <button
          onClick={deleteInsert}
          className="ml-auto px-3 py-1.5 border border-red-900/60 text-red-400 rounded text-xs hover:bg-red-900/20"
        >
          Delete insert
        </button>
      </div>

      {pickerOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => !placing && setPickerOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-md flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-700">
              <h2 className="text-base font-semibold text-slate-100">
                {insert.locationId ? "Move insert to…" : "Place insert in…"}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Compatible empty receptacles
                {insert.interfaceType && (
                  <> (interface <span className="font-mono text-slate-400">{insert.interfaceType}</span>)</>
                )}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {pickerLoading ? (
                <div className="p-6 text-center text-slate-500 text-sm">
                  Loading…
                </div>
              ) : receptacles.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-sm">
                  No compatible empty receptacles. Either all candidates
                  are occupied or none accept this insert&apos;s interface.
                </div>
              ) : (
                <ul className="flex flex-col">
                  {receptacles.map((r) => (
                    <li key={r.id}>
                      <button
                        onClick={() => placeAt(r.id)}
                        disabled={placing}
                        className="w-full text-left px-4 py-3 border-b border-slate-700/50 hover:bg-slate-800/40 disabled:opacity-50 transition-colors"
                      >
                        <div className="text-sm text-slate-100 truncate">
                          {r.moduleName} &nbsp;
                          <span className="text-slate-400">
                            {r.path.replace(
                              r.moduleName ? r.moduleName + ":" : "",
                              ""
                            )}
                          </span>
                        </div>
                        {r.interfaceTypeAccepted && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            accepts {r.interfaceTypeAccepted}
                          </div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-3 border-t border-slate-700 flex items-center justify-end">
              <button
                onClick={() => setPickerOpen(false)}
                disabled={placing}
                className="px-3 py-1.5 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs text-slate-500 uppercase tracking-wider">
        {label}
      </div>
      <div className="text-sm text-slate-200 mt-1">{children}</div>
    </div>
  );
}

function InsertGrid({
  cells,
}: {
  cells: Array<{
    id: string;
    label: string;
    gridRow: number | null;
    gridColumn: number | null;
    isDisabled: boolean;
  }>;
}) {
  const gridCells = cells.filter(
    (c) => c.gridRow != null && c.gridColumn != null
  );
  if (gridCells.length === 0) {
    return (
      <div className="flex flex-wrap gap-1 max-w-lg">
        {cells.map((c) => (
          <div
            key={c.id}
            className="px-3 py-2 rounded border border-slate-700 bg-slate-800/40 text-sm text-slate-300"
          >
            {c.label}
          </div>
        ))}
      </div>
    );
  }

  const maxRow = Math.max(...gridCells.map((c) => c.gridRow!));
  const maxCol = Math.max(...gridCells.map((c) => c.gridColumn!));
  const cellSize = 64;
  const gap = 4;
  const labelPad = 26;
  const svgW = labelPad + (maxCol + 1) * (cellSize + gap) + 4;
  const svgH = labelPad + (maxRow + 1) * (cellSize + gap) + 4;

  return (
    <svg width={svgW} height={svgH} className="max-w-full">
      {/* Row labels */}
      {Array.from({ length: maxRow + 1 }, (_, r) => {
        const label = gridCells.find((c) => c.gridRow === r)?.label.charAt(0);
        return (
          <text
            key={`r-${r}`}
            x={labelPad - 8}
            y={labelPad + r * (cellSize + gap) + cellSize / 2}
            textAnchor="end"
            dominantBaseline="central"
            fill="#64748b"
            fontSize={11}
          >
            {label}
          </text>
        );
      })}
      {/* Col labels */}
      {Array.from({ length: maxCol + 1 }, (_, c) => (
        <text
          key={`c-${c}`}
          x={labelPad + c * (cellSize + gap) + cellSize / 2}
          y={labelPad - 8}
          textAnchor="middle"
          fill="#64748b"
          fontSize={11}
        >
          {c + 1}
        </text>
      ))}
      {/* Cells */}
      {gridCells.map((cell) => {
        const x = labelPad + cell.gridColumn! * (cellSize + gap);
        const y = labelPad + cell.gridRow! * (cellSize + gap);
        return (
          <g key={cell.id}>
            <rect
              x={x}
              y={y}
              width={cellSize}
              height={cellSize}
              fill={cell.isDisabled ? "rgba(248,113,113,0.12)" : "transparent"}
              stroke={cell.isDisabled ? "#7f1d1d" : "#475569"}
              strokeWidth={1}
              rx={3}
            />
            <text
              x={x + cellSize / 2}
              y={y + cellSize / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill={cell.isDisabled ? "#f87171" : "#94a3b8"}
              fontSize={11}
            >
              {cell.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
