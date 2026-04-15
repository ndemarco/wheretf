"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

interface InsertRow {
  id: string;
  name: string | null;
  templateId: string | null;
  templateName: string | null;
  interfaceType: string | null;
  locationPath: string | null;
  moduleName: string | null;
  rows: number | null;
  columns: number | null;
}

interface ReceptacleLocation {
  id: string;
  label: string;
  path: string;
  locationType: string;
  interfaceTypeAccepted: string | null;
  moduleId: string;
}

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
    interfaceTypeProvided: string | null;
  } | null;
}

export default function PlaceInsertPage() {
  const params = useParams();
  const router = useRouter();
  const moduleId = params.id as string;
  const levelId = params.levelId as string;

  const [receptacle, setReceptacle] = useState<ReceptacleLocation | null>(null);
  const [inserts, setInserts] = useState<InsertRow[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sub-flow: create new insert
  const [createOpen, setCreateOpen] = useState(false);
  const [newTemplateId, setNewTemplateId] = useState("");
  const [newName, setNewName] = useState("");
  const [newRows, setNewRows] = useState<number | "">("");
  const [newCols, setNewCols] = useState<number | "">("");

  const fetchAll = useCallback(async () => {
    try {
      const recRes = await fetch(`/api/locations/${levelId}`);
      if (!recRes.ok) throw new Error("Receptacle not found");
      const recData = await recRes.json();
      setReceptacle(recData.location);

      const iface = recData.location.interfaceTypeAccepted as string | null;
      const placement = showAll ? "all" : "unplaced";
      const insQs = new URLSearchParams({ placement });
      if (iface) insQs.set("interfaceType", iface);
      const insRes = await fetch(`/api/inserts?${insQs}`);
      const insData = await insRes.json();
      // Exclude inserts already at this receptacle.
      setInserts(
        (insData.inserts ?? []).filter(
          (i: InsertRow & { locationId?: string | null }) =>
            i.locationId !== levelId
        )
      );

      const tplRes = await fetch("/api/templates");
      const tplData = await tplRes.json();
      const all = (tplData.templates ?? []) as TemplateOption[];
      // Filter templates by interface compatibility (or all if receptacle has none)
      const compat = iface
        ? all.filter(
            (t) => t.currentVersionData?.interfaceTypeProvided === iface
          )
        : all;
      setTemplates(compat);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [levelId, showAll]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const selectedTemplate = templates.find((t) => t.id === newTemplateId);
  const ver = selectedTemplate?.currentVersionData;

  // Default dimensions when picking a parametric template
  useEffect(() => {
    if (!ver) {
      setNewRows("");
      setNewCols("");
      return;
    }
    if (ver.isParametric) {
      setNewRows(ver.minRows ?? 1);
      setNewCols(ver.minColumns ?? 1);
    } else {
      setNewRows(ver.rows ?? 1);
      setNewCols(ver.columns ?? 1);
    }
  }, [newTemplateId, ver]);

  async function placeInsert(insertId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/inserts/${insertId}/place`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: levelId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Place failed");
        return;
      }
      router.push(`/modules/${moduleId}`);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function createAndPlace() {
    if (!selectedTemplate || !ver) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        templateId: selectedTemplate.id,
        templateVersionId: ver.id,
        name: newName.trim() || undefined,
      };
      if (ver.isParametric) {
        body.rows = Number(newRows) || 1;
        body.columns = Number(newCols) || 1;
      }
      const cRes = await fetch("/api/inserts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!cRes.ok) {
        const d = await cRes.json();
        setError(d.error || "Create failed");
        return;
      }
      const cData = await cRes.json();
      await placeInsert(cData.insert.id);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  const interfaceLabel = receptacle?.interfaceTypeAccepted;

  const compatLabel = useMemo(() => {
    if (loading) return "Loading…";
    if (!receptacle) return "";
    if (!interfaceLabel) {
      return "Receptacle has no interface set — showing all inserts.";
    }
    return `Compatible with ${interfaceLabel}.`;
  }, [loading, receptacle, interfaceLabel]);

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
      <div className="px-6 py-3 border-b border-slate-700 flex items-center gap-3 shrink-0">
        <Link
          href={`/modules/${moduleId}`}
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          ← Back to module
        </Link>
      </div>

      <div className="px-6 py-3 border-b border-slate-700 shrink-0">
        <h1 className="text-base font-semibold text-slate-100">
          Place an insert in {receptacle?.path ?? "…"}
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">{compatLabel}</p>
      </div>

      {error && (
        <div className="mx-6 my-2 px-3 py-2 bg-red-900/30 border border-red-700/50 rounded text-red-300 text-sm shrink-0">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        {/* Existing inserts */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Compatible inserts
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="accent-accent"
            />
            Include placed inserts (will be moved here)
          </label>
        </div>

        {loading ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : inserts.length === 0 ? (
          <div className="text-sm text-slate-500">
            No {showAll ? "" : "unplaced "}inserts match this receptacle.
          </div>
        ) : (
          <ul className="flex flex-col gap-1 mb-6">
            {inserts.map((ins) => {
              const dims =
                ins.rows != null && ins.columns != null
                  ? `${ins.rows}×${ins.columns}`
                  : "—";
              return (
                <li key={ins.id}>
                  <button
                    onClick={() => placeInsert(ins.id)}
                    disabled={busy}
                    className="w-full text-left px-3 py-2 rounded border border-slate-700 hover:border-accent/60 hover:bg-slate-800/40 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-100 font-medium truncate flex-1">
                        {ins.name ?? ins.templateName ?? "Insert"}
                      </span>
                      {ins.interfaceType && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 shrink-0">
                          {ins.interfaceType}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                      <span>{ins.templateName ?? "(no template)"}</span>
                      <span>·</span>
                      <span className="tabular-nums">{dims}</span>
                      {ins.locationPath ? (
                        <>
                          <span>·</span>
                          <span className="text-amber-400">
                            currently at {ins.locationPath}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Sub-flow: create a new insert */}
        <div className="border-t border-slate-700 pt-4 mt-2">
          {!createOpen ? (
            <button
              onClick={() => setCreateOpen(true)}
              className="text-sm text-slate-300 hover:text-accent transition-colors"
            >
              + Create a new insert from a template
            </button>
          ) : (
            <div className="space-y-3">
              <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                New insert
              </h2>
              {templates.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No templates match this receptacle&apos;s interface.
                </p>
              ) : (
                <>
                  <label className="block">
                    <span className="text-xs text-slate-400 block mb-1">
                      Template
                    </span>
                    <select
                      value={newTemplateId}
                      onChange={(e) => setNewTemplateId(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 focus:border-accent focus:outline-none"
                    >
                      <option value="">Select a template…</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-400 block mb-1">
                      Name (optional)
                    </span>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder={
                        selectedTemplate
                          ? `e.g., ${selectedTemplate.name} #1`
                          : "Name this insert"
                      }
                      className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 focus:border-accent focus:outline-none"
                    />
                  </label>
                  {ver?.isParametric && (
                    <div className="flex gap-3">
                      <label className="flex flex-col gap-1 flex-1">
                        <span className="text-xs text-slate-400">
                          Rows
                          {ver.minRows != null && ver.maxRows != null && (
                            <span className="text-slate-600 ml-1">
                              ({ver.minRows}–{ver.maxRows})
                            </span>
                          )}
                        </span>
                        <input
                          type="number"
                          min={ver.minRows ?? 1}
                          max={ver.maxRows ?? 26}
                          value={newRows}
                          onChange={(e) =>
                            setNewRows(
                              e.target.value === ""
                                ? ""
                                : Number(e.target.value)
                            )
                          }
                          className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 focus:border-accent focus:outline-none tabular-nums"
                        />
                      </label>
                      <label className="flex flex-col gap-1 flex-1">
                        <span className="text-xs text-slate-400">
                          Columns
                          {ver.minColumns != null && ver.maxColumns != null && (
                            <span className="text-slate-600 ml-1">
                              ({ver.minColumns}–{ver.maxColumns})
                            </span>
                          )}
                        </span>
                        <input
                          type="number"
                          min={ver.minColumns ?? 1}
                          max={ver.maxColumns ?? 26}
                          value={newCols}
                          onChange={(e) =>
                            setNewCols(
                              e.target.value === ""
                                ? ""
                                : Number(e.target.value)
                            )
                          }
                          className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 focus:border-accent focus:outline-none tabular-nums"
                        />
                      </label>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={createAndPlace}
                      disabled={busy || !newTemplateId}
                      className="px-3 py-1.5 bg-accent text-white rounded text-sm hover:brightness-110 disabled:opacity-50"
                    >
                      {busy ? "Creating…" : "Create + place here"}
                    </button>
                    <button
                      onClick={() => {
                        setCreateOpen(false);
                        setNewTemplateId("");
                        setNewName("");
                      }}
                      className="px-3 py-1.5 border border-slate-600 text-slate-300 rounded text-sm hover:bg-slate-700/50"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
