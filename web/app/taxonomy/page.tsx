"use client";

import { useCallback, useEffect, useState } from "react";

// --- Types ---

interface Aspect {
  id: string;
  name: string;
  description: string | null;
}

interface AspectParameter {
  id: string;
  parameterDefinitionId: string;
  required: boolean;
  defaultValue: unknown;
  sortOrder: number;
  parameterName: string;
  dataType: string;
  unit: string | null;
  parameterDefaultValue: unknown;
  constraints: unknown;
}

interface ParameterDefinition {
  id: string;
  name: string;
  dataType: string;
  unit: string | null;
  defaultValue: unknown;
  constraints: unknown;
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
}

// --- Reusable inline editable text ---

function EditableText({
  value,
  onSave,
  className = "",
  placeholder = "—",
}: {
  value: string;
  onSave: (next: string) => void | Promise<void>;
  className?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft !== value) onSave(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setEditing(false);
            if (draft !== value) onSave(draft);
          } else if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        placeholder={placeholder}
        className={`${className} w-full px-2 py-0.5 bg-slate-900 border border-accent rounded focus:outline-none`}
      />
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className={`${className} cursor-text border border-dashed border-transparent hover:border-slate-600 rounded px-2 py-0.5 -mx-2 -my-0.5 ${
        value ? "" : "italic text-slate-600"
      }`}
    >
      {value || placeholder}
    </div>
  );
}

// --- Inline new parameter-definition creator (reusable in-place form) ---

function InlineNewParamDef({
  onCreated,
}: {
  onCreated: (def: ParameterDefinition) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [dataType, setDataType] = useState("text");
  const [unit, setUnit] = useState("");
  const [enumValues, setEnumValues] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setDataType("text");
    setUnit("");
    setEnumValues("");
    setError(null);
  }

  async function create() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        dataType,
      };
      if (unit.trim()) body.unit = unit.trim();
      if (dataType === "enum") {
        const vals = enumValues
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
        if (vals.length > 0) body.constraints = { enumValues: vals };
      }
      const res = await fetch("/api/parameter-definitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      const def: ParameterDefinition =
        data.parameterDefinition ?? data.definition ?? data;
      await onCreated(def);
      reset();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 w-full text-left px-3 py-2 rounded border border-dashed border-slate-700 text-xs text-slate-500 hover:text-accent hover:border-accent transition-colors"
      >
        + Create new parameter…
      </button>
    );
  }

  return (
    <div className="mt-2 p-3 bg-slate-900/60 border border-accent/40 rounded space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="name (e.g. thread_pitch)"
          className="col-span-2 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-accent focus:outline-none"
        />
        <select
          value={dataType}
          onChange={(e) => setDataType(e.target.value)}
          className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-accent focus:outline-none"
        >
          <option value="text">text</option>
          <option value="numeric">numeric</option>
          <option value="boolean">boolean</option>
          <option value="enum">enum</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="unit (optional)"
          className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-accent focus:outline-none"
        />
        {dataType === "enum" && (
          <input
            value={enumValues}
            onChange={(e) => setEnumValues(e.target.value)}
            placeholder="enum values (comma-separated)"
            className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-accent focus:outline-none"
          />
        )}
      </div>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={create}
          disabled={saving || !name.trim()}
          className="px-3 py-1 bg-accent text-white rounded text-xs hover:brightness-110 disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create + add"}
        </button>
        <button
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="text-xs text-slate-500 hover:text-slate-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// --- Main Page ---

export default function TaxonomyPage() {
  const [tab, setTab] = useState<
    "aspects" | "standards" | "parameters" | "categories"
  >("aspects");

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab header */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-slate-700">
        <h1 className="text-lg font-semibold text-slate-100 mr-4">Taxonomy</h1>
        {(["aspects", "standards", "parameters", "categories"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              tab === t
                ? "bg-slate-700 text-slate-100"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "aspects" && <AspectsTab />}
      {tab === "standards" && <StandardsTab />}
      {tab === "parameters" && <ParametersTab />}
      {tab === "categories" && <CategoriesTab />}
    </div>
  );
}

// --- Aspects Tab ---

function AspectsTab() {
  const [view, setView] = useState<"detail" | "matrix">("detail");
  const [aspects, setAspects] = useState<Aspect[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [params, setParams] = useState<AspectParameter[]>([]);
  const [allParamDefs, setAllParamDefs] = useState<ParameterDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{
    aspect: Aspect;
    itemCount: number;
    parameterCount: number;
  } | null>(null);

  const fetchAspects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/aspects");
      const data = await res.json();
      setAspects(data.aspects || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchParams = useCallback(async (aspectId: string) => {
    try {
      const [paramsRes, defsRes] = await Promise.all([
        fetch(`/api/aspects/${aspectId}/parameters`),
        fetch("/api/parameter-definitions"),
      ]);
      const paramsData = await paramsRes.json();
      const defsData = await defsRes.json();
      setParams(paramsData.parameters || []);
      setAllParamDefs(defsData.parameterDefinitions || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchAspects();
  }, [fetchAspects]);

  useEffect(() => {
    if (selectedId) fetchParams(selectedId);
  }, [selectedId, fetchParams]);

  const selectedAspect = aspects.find((a) => a.id === selectedId) || null;

  // Parameter IDs already on this aspect
  const attachedParamDefIds = new Set(params.map((p) => p.parameterDefinitionId));
  const availableParamDefs = allParamDefs.filter(
    (pd) => !attachedParamDefIds.has(pd.id)
  );

  async function createAspect() {
    if (!newName.trim()) return;
    try {
      await fetch("/api/aspects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim() || null,
        }),
      });
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
      await fetchAspects();
    } catch (err) {
      console.error(err);
    }
  }

  async function prepareDeleteAspect(aspect: Aspect) {
    try {
      const res = await fetch(`/api/aspects/${aspect.id}`);
      const data = await res.json();
      setDeleteTarget({
        aspect,
        itemCount: data.itemCount ?? 0,
        parameterCount: data.parameters?.length ?? 0,
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function confirmDeleteAspect() {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/aspects/${deleteTarget.aspect.id}`, { method: "DELETE" });
      if (selectedId === deleteTarget.aspect.id) setSelectedId(null);
      setDeleteTarget(null);
      await fetchAspects();
    } catch (err) {
      console.error(err);
    }
  }

  async function addParamToAspect(parameterDefinitionId: string) {
    if (!selectedId) return;
    try {
      await fetch(`/api/aspects/${selectedId}/parameters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parameterDefinitionId }),
      });
      await fetchParams(selectedId);
    } catch (err) {
      console.error(err);
    }
  }

  async function removeParamFromAspect(parameterDefinitionId: string) {
    if (!selectedId) return;
    try {
      await fetch(`/api/aspects/${selectedId}/parameters`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parameterDefinitionId }),
      });
      await fetchParams(selectedId);
    } catch (err) {
      console.error(err);
    }
  }

  if (view === "matrix") {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <ViewToggle view={view} onChange={setView} />
        <AspectParameterMatrix
          aspects={aspects}
          allParamDefs={allParamDefs.length ? allParamDefs : null}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ViewToggle view={view} onChange={setView} />
      <div className="flex-1 flex overflow-hidden">
      {/* Aspect list */}
      <div className="w-72 border-r border-slate-700 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-700 flex items-center justify-between">
          <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">
            Aspects
          </span>
          <button
            onClick={() => setShowCreate(true)}
            className="text-xs text-accent hover:brightness-110"
          >
            + New
          </button>
        </div>

        {showCreate && (
          <div className="p-3 border-b border-slate-700 space-y-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Aspect name"
              autoFocus
              className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder:text-slate-500 focus:border-accent focus:outline-none"
            />
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder:text-slate-500 focus:border-accent focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={createAspect}
                className="px-3 py-1 bg-accent text-white rounded text-xs hover:brightness-110"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="text-xs text-slate-500 hover:text-slate-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-slate-500 text-sm">Loading...</div>
          ) : aspects.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">
              No aspects defined yet.
            </div>
          ) : (
            aspects.map((aspect) => (
              <button
                key={aspect.id}
                onClick={() => setSelectedId(aspect.id)}
                className={`w-full text-left px-4 py-3 border-b border-slate-700/50 transition-colors ${
                  selectedId === aspect.id
                    ? "bg-slate-700/50"
                    : "hover:bg-slate-800/30"
                }`}
              >
                <span className="text-sm text-slate-200 font-medium">
                  {aspect.name}
                </span>
                {aspect.description && (
                  <span className="block text-xs text-slate-500 mt-0.5 line-clamp-1">
                    {aspect.description}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Aspect detail */}
      <div className="flex-1 overflow-y-auto">
        {!selectedAspect ? (
          <div className="flex-1 flex items-center justify-center h-full text-slate-500 text-sm">
            Select an aspect to view its parameters.
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  {selectedAspect.name}
                </h2>
                {selectedAspect.description && (
                  <p className="text-sm text-slate-400 mt-1">
                    {selectedAspect.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => prepareDeleteAspect(selectedAspect)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Delete
              </button>
            </div>

            {/* Current parameters */}
            <div>
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                Parameters ({params.length})
              </h3>
              {params.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No parameters attached. Add one below.
                </p>
              ) : (
                <div className="space-y-1">
                  {params.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-3 py-2 bg-slate-800/50 border border-slate-700 rounded"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-200">
                          {p.parameterName}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                          {p.dataType}
                        </span>
                        {p.unit && (
                          <span className="text-[10px] text-slate-500">
                            {p.unit}
                          </span>
                        )}
                        {p.required && (
                          <span className="text-[10px] text-amber-400">
                            required
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() =>
                          removeParamFromAspect(p.parameterDefinitionId)
                        }
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add parameter */}
            <div>
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                Add Parameter
              </h3>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {availableParamDefs.map((pd) => (
                  <button
                    key={pd.id}
                    onClick={() => addParamToAspect(pd.id)}
                    className="w-full text-left flex items-center justify-between px-3 py-2 rounded border border-dashed border-slate-600 hover:border-slate-500 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-300">{pd.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                        {pd.dataType}
                      </span>
                      {pd.unit && (
                        <span className="text-[10px] text-slate-500">
                          {pd.unit}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-accent">+ Add</span>
                  </button>
                ))}
              </div>

              <InlineNewParamDef
                onCreated={async (newDef) => {
                  await addParamToAspect(newDef.id);
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <DeleteAspectModal
          aspect={deleteTarget.aspect}
          itemCount={deleteTarget.itemCount}
          parameterCount={deleteTarget.parameterCount}
          onConfirm={confirmDeleteAspect}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      </div>
    </div>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: "detail" | "matrix";
  onChange: (v: "detail" | "matrix") => void;
}) {
  return (
    <div className="px-4 py-2 border-b border-slate-700 flex items-center justify-end gap-1 bg-slate-900/40">
      {(["detail", "matrix"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
            view === v
              ? "bg-slate-700 text-slate-100"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {v === "detail" ? "Detail" : "Matrix"}
        </button>
      ))}
    </div>
  );
}

function AspectParameterMatrix({
  aspects,
  allParamDefs: allParamDefsSeed,
}: {
  aspects: Aspect[];
  allParamDefs: ParameterDefinition[] | null;
}) {
  const [paramDefs, setParamDefs] = useState<ParameterDefinition[]>(
    allParamDefsSeed ?? []
  );
  const [links, setLinks] = useState<Map<string, Set<string>>>(new Map());
  const [pendingCells, setPendingCells] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const cellKey = (aspectId: string, pdId: string) => `${aspectId}:${pdId}`;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [defsRes, ...aspectParamRes] = await Promise.all([
        fetch("/api/parameter-definitions"),
        ...aspects.map((a) => fetch(`/api/aspects/${a.id}/parameters`)),
      ]);
      const defsData = await defsRes.json();
      setParamDefs(defsData.parameterDefinitions ?? []);
      const nextLinks = new Map<string, Set<string>>();
      for (let i = 0; i < aspects.length; i++) {
        const d = await aspectParamRes[i].json();
        const pdIds = new Set<string>(
          (d.parameters ?? []).map(
            (p: AspectParameter) => p.parameterDefinitionId
          )
        );
        nextLinks.set(aspects[i].id, pdIds);
      }
      setLinks(nextLinks);
    } finally {
      setLoading(false);
    }
  }, [aspects]);

  useEffect(() => {
    if (aspects.length > 0) refresh();
  }, [refresh, aspects.length]);

  async function toggle(aspectId: string, pdId: string) {
    const key = cellKey(aspectId, pdId);
    if (pendingCells.has(key)) return;
    setPendingCells((prev) => new Set(prev).add(key));
    const current = links.get(aspectId)?.has(pdId) ?? false;

    // optimistic update
    setLinks((prev) => {
      const next = new Map(prev);
      const s = new Set(next.get(aspectId) ?? []);
      if (current) s.delete(pdId);
      else s.add(pdId);
      next.set(aspectId, s);
      return next;
    });

    try {
      if (current) {
        await fetch(`/api/aspects/${aspectId}/parameters`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parameterDefinitionId: pdId }),
        });
      } else {
        await fetch(`/api/aspects/${aspectId}/parameters`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parameterDefinitionId: pdId }),
        });
      }
    } catch (err) {
      console.error(err);
      // revert on failure
      setLinks((prev) => {
        const next = new Map(prev);
        const s = new Set(next.get(aspectId) ?? []);
        if (current) s.add(pdId);
        else s.delete(pdId);
        next.set(aspectId, s);
        return next;
      });
    } finally {
      setPendingCells((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  function toggleRow(pdId: string) {
    // If param is in *every* aspect, clear all. Otherwise, add to all missing.
    const missing = aspects.filter((a) => !(links.get(a.id)?.has(pdId) ?? false));
    if (missing.length === 0) {
      for (const a of aspects) toggle(a.id, pdId);
    } else {
      for (const a of missing) toggle(a.id, pdId);
    }
  }

  function toggleCol(aspectId: string) {
    const setOf = links.get(aspectId) ?? new Set<string>();
    const missing = paramDefs.filter((pd) => !setOf.has(pd.id));
    if (missing.length === 0) {
      for (const pd of paramDefs) toggle(aspectId, pd.id);
    } else {
      for (const pd of missing) toggle(aspectId, pd.id);
    }
  }

  const rowUsage = new Map<string, number>();
  for (const pd of paramDefs) {
    let n = 0;
    for (const a of aspects) if (links.get(a.id)?.has(pd.id)) n++;
    rowUsage.set(pd.id, n);
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        Loading matrix…
      </div>
    );
  }

  if (aspects.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        No aspects defined yet.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4">
        <p className="text-[11px] text-slate-500 mb-3">
          Click a cell to toggle the parameter on that aspect. Click a row or
          column header to toggle the whole row/column. Parameters are global
          — a parameter appearing in two aspects is the same canonical
          definition, not a duplicate.
        </p>
        <div className="inline-block border border-slate-700 rounded overflow-hidden">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-slate-900 border-b border-r border-slate-700 px-3 py-2 text-left text-[10px] uppercase tracking-wider text-slate-500 min-w-[180px]">
                  Parameter
                </th>
                <th className="border-b border-slate-700 px-2 py-2 text-[10px] uppercase tracking-wider text-slate-500 text-center">
                  Used in
                </th>
                {aspects.map((a) => (
                  <th
                    key={a.id}
                    className="border-b border-l border-slate-700 px-2 py-2 text-center min-w-[90px] cursor-pointer hover:bg-slate-800/60"
                    onClick={() => toggleCol(a.id)}
                    title="Click to toggle all parameters for this aspect"
                  >
                    <div className="text-[11px] font-medium text-slate-200 truncate max-w-[120px]">
                      {a.name}
                    </div>
                    <div className="text-[9px] text-slate-500 tabular-nums mt-0.5">
                      {links.get(a.id)?.size ?? 0}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paramDefs.map((pd) => (
                <tr
                  key={pd.id}
                  className="border-t border-slate-800 hover:bg-slate-900/30"
                >
                  <td
                    className="sticky left-0 z-10 bg-slate-900 border-r border-slate-700 px-3 py-1.5 cursor-pointer hover:bg-slate-800/60"
                    onClick={() => toggleRow(pd.id)}
                    title="Click to toggle this parameter across all aspects"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-200 text-[11px] truncate">
                        {pd.name}
                      </span>
                      <span className="text-[9px] px-1 py-px rounded bg-slate-800 text-slate-500">
                        {pd.dataType}
                      </span>
                      {pd.unit && (
                        <span className="text-[9px] text-slate-600">
                          {pd.unit}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="border-l border-slate-800 px-2 py-1.5 text-center text-[10px] tabular-nums text-slate-500">
                    {rowUsage.get(pd.id) ?? 0}
                  </td>
                  {aspects.map((a) => {
                    const on = links.get(a.id)?.has(pd.id) ?? false;
                    const pending = pendingCells.has(cellKey(a.id, pd.id));
                    return (
                      <td
                        key={a.id}
                        onClick={() => toggle(a.id, pd.id)}
                        className={`border-l border-slate-800 px-2 py-1.5 text-center cursor-pointer transition-colors ${
                          on
                            ? "bg-accent/20 hover:bg-accent/30"
                            : "hover:bg-slate-800/60"
                        } ${pending ? "opacity-50" : ""}`}
                      >
                        <span
                          className={`inline-block w-4 h-4 rounded border ${
                            on
                              ? "bg-accent border-accent"
                              : "border-slate-600 bg-transparent"
                          }`}
                        >
                          {on && (
                            <svg
                              viewBox="0 0 16 16"
                              fill="none"
                              className="w-4 h-4 text-white"
                            >
                              <path
                                d="M3 8l3 3 6-6"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {paramDefs.length === 0 && (
          <p className="text-xs text-slate-500 italic mt-3">
            No parameters yet. Create some in the Parameters tab.
          </p>
        )}
      </div>
    </div>
  );
}

// --- Delete Aspect Modal ---

function DeleteAspectModal({
  aspect,
  itemCount,
  parameterCount,
  onConfirm,
  onCancel,
}: {
  aspect: Aspect;
  itemCount: number;
  parameterCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const isConfirmed = confirmText === aspect.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="p-5 border-b border-slate-700">
          <h2 className="text-base font-semibold text-red-400">
            Delete aspect: {aspect.name}
          </h2>
        </div>

        <div className="p-5 space-y-4">
          {/* Impact summary */}
          <div className="space-y-2">
            {itemCount > 0 ? (
              <p className="text-sm text-slate-300">
                Applied to{" "}
                <span className="font-semibold text-slate-100">
                  {itemCount} item{itemCount !== 1 ? "s" : ""}
                </span>
                . Their {parameterCount} parameter value
                {parameterCount !== 1 ? "s" : ""} will be permanently erased.
              </p>
            ) : (
              <p className="text-sm text-slate-400">
                Not applied to any items.
              </p>
            )}

            <p className="text-xs text-slate-500">
              This cannot be undone. You would need to re-create the aspect
              and re-enter all values manually.
            </p>
          </div>

          {/* Type-to-confirm */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              Type{" "}
              <span className="font-mono text-slate-200 bg-slate-700 px-1.5 py-0.5 rounded">
                {aspect.name}
              </span>{" "}
              to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 placeholder:text-slate-600 focus:border-red-500 focus:outline-none"
              placeholder={aspect.name}
            />
          </div>
        </div>

        <div className="p-5 border-t border-slate-700 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-300 hover:text-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!isConfirmed}
            className={`px-4 py-2 text-sm rounded font-medium transition-all ${
              isConfirmed
                ? "bg-red-600 text-white hover:bg-red-500"
                : "bg-slate-700 text-slate-500 cursor-not-allowed"
            }`}
          >
            Delete this aspect
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Parameters Tab ---

function ParametersTab() {
  const [paramDefs, setParamDefs] = useState<ParameterDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDataType, setNewDataType] = useState("text");
  const [newUnit, setNewUnit] = useState("");
  const [newEnumValues, setNewEnumValues] = useState("");

  const fetchParams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/parameter-definitions");
      const data = await res.json();
      setParamDefs(data.parameterDefinitions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchParams();
  }, [fetchParams]);

  async function createParam() {
    if (!newName.trim()) return;
    const body: Record<string, unknown> = {
      name: newName.trim(),
      dataType: newDataType,
    };
    if (newUnit.trim()) body.unit = newUnit.trim();
    if (newDataType === "enum" && newEnumValues.trim()) {
      body.constraints = {
        enumValues: newEnumValues.split(",").map((v) => v.trim()),
      };
    }
    try {
      await fetch("/api/parameter-definitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setNewName("");
      setNewUnit("");
      setNewEnumValues("");
      setShowCreate(false);
      await fetchParams();
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteParam(id: string) {
    if (!confirm("Delete this parameter definition? It will be removed from all aspects and items.")) return;
    try {
      await fetch(`/api/parameter-definitions/${id}`, { method: "DELETE" });
      await fetchParams();
    } catch (err) {
      console.error(err);
    }
  }

  async function updateParam(id: string, updates: Partial<ParameterDefinition>) {
    await fetch(`/api/parameter-definitions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    await fetchParams();
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-slate-300">
          Parameter Definitions
        </h2>
        <button
          onClick={() => setShowCreate(true)}
          className="text-xs text-accent hover:brightness-110"
        >
          + New Parameter
        </button>
      </div>

      {showCreate && (
        <div className="mb-4 p-4 bg-slate-800/50 border border-slate-700 rounded space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Parameter name"
              autoFocus
              className="px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder:text-slate-500 focus:border-accent focus:outline-none"
            />
            <select
              value={newDataType}
              onChange={(e) => setNewDataType(e.target.value)}
              className="px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:border-accent focus:outline-none"
            >
              <option value="text">Text</option>
              <option value="numeric">Numeric</option>
              <option value="boolean">Boolean</option>
              <option value="enum">Enum</option>
            </select>
            <input
              type="text"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              placeholder="Unit (optional)"
              className="px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder:text-slate-500 focus:border-accent focus:outline-none"
            />
          </div>
          {newDataType === "enum" && (
            <input
              type="text"
              value={newEnumValues}
              onChange={(e) => setNewEnumValues(e.target.value)}
              placeholder="Enum values (comma-separated)"
              className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder:text-slate-500 focus:border-accent focus:outline-none"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={createParam}
              className="px-3 py-1 bg-accent text-white rounded text-xs hover:brightness-110"
            >
              Create
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="text-xs text-slate-500 hover:text-slate-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-slate-500 text-sm py-8">Loading...</div>
      ) : paramDefs.length === 0 ? (
        <div className="text-center text-slate-500 text-sm py-8">
          No parameter definitions yet.
        </div>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Name
              </th>
              <th className="px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Type
              </th>
              <th className="px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Unit
              </th>
              <th className="px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Constraints
              </th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {paramDefs.map((pd) => (
              <ParamDefRow
                key={pd.id}
                pd={pd}
                onSave={(updates) => updateParam(pd.id, updates)}
                onDelete={() => deleteParam(pd.id)}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ParamDefRow({
  pd,
  onSave,
  onDelete,
}: {
  pd: ParameterDefinition;
  onSave: (updates: Partial<ParameterDefinition>) => Promise<void>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [dataType, setDataType] = useState(pd.dataType);
  const [unit, setUnit] = useState(pd.unit ?? "");
  const constraints = (pd.constraints ?? {}) as {
    enumValues?: string[];
    min?: number;
    max?: number;
  };
  const [enumValues, setEnumValues] = useState(
    (constraints.enumValues ?? []).join(", ")
  );
  const [minStr, setMinStr] = useState(
    constraints.min !== undefined ? String(constraints.min) : ""
  );
  const [maxStr, setMaxStr] = useState(
    constraints.max !== undefined ? String(constraints.max) : ""
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const updates: Partial<ParameterDefinition> = {
        dataType,
        unit: unit.trim() || null,
      };
      const nextConstraints: Record<string, unknown> = {};
      if (dataType === "enum") {
        const vals = enumValues
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
        if (vals.length > 0) nextConstraints.enumValues = vals;
      }
      if (dataType === "numeric") {
        if (minStr.trim() !== "" && !Number.isNaN(Number(minStr)))
          nextConstraints.min = Number(minStr);
        if (maxStr.trim() !== "" && !Number.isNaN(Number(maxStr)))
          nextConstraints.max = Number(maxStr);
      }
      updates.constraints =
        Object.keys(nextConstraints).length > 0 ? nextConstraints : null;
      await onSave(updates);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    const displayConstraints = pd.constraints
      ? (() => {
          const c = pd.constraints as {
            enumValues?: string[];
            min?: number;
            max?: number;
          };
          if (c.enumValues?.length) return c.enumValues.join(" · ");
          const bits: string[] = [];
          if (c.min !== undefined) bits.push(`min ${c.min}`);
          if (c.max !== undefined) bits.push(`max ${c.max}`);
          return bits.join(", ") || "—";
        })()
      : "—";
    return (
      <tr className="border-b border-slate-700/50 hover:bg-slate-800/30 group">
        <td className="px-3 py-2 text-sm text-slate-200 font-mono">{pd.name}</td>
        <td className="px-3 py-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
            {pd.dataType}
          </span>
        </td>
        <td className="px-3 py-2 text-sm text-slate-400">{pd.unit || "—"}</td>
        <td className="px-3 py-2 text-xs text-slate-400">
          {displayConstraints}
        </td>
        <td className="px-3 py-2 text-right whitespace-nowrap">
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-accent hover:brightness-110 mr-3"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="text-xs text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Delete
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-700 bg-slate-900/30">
      <td className="px-3 py-2 text-sm text-slate-200 font-mono">{pd.name}</td>
      <td className="px-3 py-2">
        <select
          value={dataType}
          onChange={(e) => setDataType(e.target.value)}
          className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-accent focus:outline-none"
        >
          <option value="text">text</option>
          <option value="numeric">numeric</option>
          <option value="boolean">boolean</option>
          <option value="enum">enum</option>
        </select>
      </td>
      <td className="px-3 py-2">
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="—"
          className="w-20 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-accent focus:outline-none"
        />
      </td>
      <td className="px-3 py-2">
        {dataType === "enum" ? (
          <input
            value={enumValues}
            onChange={(e) => setEnumValues(e.target.value)}
            placeholder="val1, val2, val3"
            className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-accent focus:outline-none"
          />
        ) : dataType === "numeric" ? (
          <div className="flex items-center gap-1">
            <input
              value={minStr}
              onChange={(e) => setMinStr(e.target.value)}
              placeholder="min"
              className="w-16 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-accent focus:outline-none"
            />
            <span className="text-slate-600">–</span>
            <input
              value={maxStr}
              onChange={(e) => setMaxStr(e.target.value)}
              placeholder="max"
              className="w-16 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-accent focus:outline-none"
            />
          </div>
        ) : (
          <span className="text-xs text-slate-600">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <button
          onClick={save}
          disabled={saving}
          className="text-xs text-accent hover:brightness-110 mr-3 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="text-xs text-slate-500 hover:text-slate-300"
        >
          Cancel
        </button>
      </td>
    </tr>
  );
}

// --- Categories Tab ---

function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("");
  const [newColor, setNewColor] = useState("");

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  async function createCategory() {
    if (!newName.trim()) return;
    try {
      await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          icon: newIcon.trim() || null,
          color: newColor.trim() || null,
        }),
      });
      setNewName("");
      setNewIcon("");
      setNewColor("");
      setShowCreate(false);
      await fetchCategories();
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm("Delete this category? It will be removed from all items.")) return;
    try {
      await fetch(`/api/categories/${id}`, { method: "DELETE" });
      await fetchCategories();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-slate-300">Categories</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="text-xs text-accent hover:brightness-110"
        >
          + New Category
        </button>
      </div>

      {showCreate && (
        <div className="mb-4 p-4 bg-slate-800/50 border border-slate-700 rounded space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Category name"
              autoFocus
              className="px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder:text-slate-500 focus:border-accent focus:outline-none"
            />
            <input
              type="text"
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              placeholder="Icon (emoji or key)"
              className="px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder:text-slate-500 focus:border-accent focus:outline-none"
            />
            <input
              type="text"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              placeholder="Color (#hex)"
              className="px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder:text-slate-500 focus:border-accent focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={createCategory}
              className="px-3 py-1 bg-accent text-white rounded text-xs hover:brightness-110"
            >
              Create
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="text-xs text-slate-500 hover:text-slate-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-slate-500 text-sm py-8">Loading...</div>
      ) : categories.length === 0 ? (
        <div className="text-center text-slate-500 text-sm py-8">
          No categories yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="p-3 bg-slate-800/50 border border-slate-700 rounded-md flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                {cat.icon && <span className="text-lg">{cat.icon}</span>}
                <div>
                  <span className="text-sm text-slate-200">{cat.name}</span>
                  {cat.color && (
                    <span
                      className="inline-block w-3 h-3 rounded-full ml-2 align-middle"
                      style={{ backgroundColor: cat.color }}
                    />
                  )}
                </div>
              </div>
              <button
                onClick={() => deleteCategory(cat.id)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Standards Tab ---

interface StandardSummary {
  id: string;
  name: string;
  description: string | null;
  domainTag: string | null;
  aspectCount?: number;
}

interface StandardAspectLink {
  aspectId: string;
  aspectName: string;
  parameterCount: number;
  coveredCount: number;
}

interface StandardParameter {
  id: string;
  parameterDefinitionId: string;
  parameterName: string;
  dataType: string;
  unit: string | null;
  role: string;
  sortOrder: number;
}

interface Designation {
  id: string;
  designation: string;
  values: Record<string, unknown>;
  metadata: unknown;
}

interface StandardItemUsage {
  itemStandardId: string;
  itemId: string;
  itemName: string;
  designation: string | null;
  isCustom: boolean;
  createdAt: string;
}

interface DesignationUsage {
  designationId: string | null;
  designation: string | null;
  itemCount: number;
}

function StandardsTab() {
  const [standards, setStandards] = useState<StandardSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDomainTag, setNewDomainTag] = useState("");

  const fetchStandards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/standards");
      const data = await res.json();
      setStandards(data.standards || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStandards();
  }, [fetchStandards]);

  async function createStandard() {
    if (!newName.trim()) return;
    const res = await fetch("/api/standards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        domainTag: newDomainTag.trim() || undefined,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setNewName("");
      setNewDomainTag("");
      setShowCreate(false);
      await fetchStandards();
      setSelectedId(data.standard?.id ?? null);
    }
  }

  async function deleteStandard(id: string) {
    const res = await fetch(`/api/standards/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (selectedId === id) setSelectedId(null);
      fetchStandards();
    }
  }

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* Left: list */}
      <div className="w-64 shrink-0 border-r border-slate-700 flex flex-col bg-slate-900/40">
        <div className="p-3 border-b border-slate-700 flex items-center justify-between">
          <span className="text-xs uppercase text-slate-500 tracking-wider">
            Standards
          </span>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="text-[11px] text-accent hover:brightness-110"
          >
            {showCreate ? "Cancel" : "+ New"}
          </button>
        </div>
        {showCreate && (
          <div className="p-3 border-b border-slate-700 space-y-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name (e.g. ISO 4762)"
              className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-accent focus:outline-none"
            />
            <input
              value={newDomainTag}
              onChange={(e) => setNewDomainTag(e.target.value)}
              placeholder="Domain tag (optional)"
              className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-accent focus:outline-none"
            />
            <button
              onClick={createStandard}
              className="w-full px-2 py-1 bg-accent text-white rounded text-xs hover:brightness-110"
            >
              Create
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-xs text-slate-500">Loading…</div>
          ) : standards.length === 0 ? (
            <div className="p-3 text-xs text-slate-500 italic">None yet</div>
          ) : (
            standards.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`w-full text-left px-3 py-2 border-b border-slate-800 hover:bg-slate-800/60 transition-colors ${
                  selectedId === s.id
                    ? "bg-slate-800 text-accent"
                    : "text-slate-300"
                }`}
              >
                <div className="text-xs font-medium">{s.name}</div>
                {s.domainTag && (
                  <div className="text-[10px] text-slate-500">{s.domainTag}</div>
                )}
              </button>
            ))
          )}
        </div>
      </div>
      {/* Right: detail */}
      <div className="flex-1 overflow-y-auto">
        {selectedId ? (
          <StandardDetail
            key={selectedId}
            standardId={selectedId}
            onDelete={() => deleteStandard(selectedId)}
            onMutated={fetchStandards}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            Select or create a standard.
          </div>
        )}
      </div>
    </div>
  );
}

function StandardDetail({
  standardId,
  onDelete,
  onMutated,
}: {
  standardId: string;
  onDelete: () => void;
  onMutated: () => void;
}) {
  const [meta, setMeta] = useState<StandardSummary | null>(null);
  const [aspects, setAspects] = useState<StandardAspectLink[]>([]);
  const [parameters, setParameters] = useState<StandardParameter[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [designationTotal, setDesignationTotal] = useState(0);
  const [usage, setUsage] = useState<{
    itemCount: number;
    designationCount: number;
    items: StandardItemUsage[];
    designationUsage: DesignationUsage[];
  }>({
    itemCount: 0,
    designationCount: 0,
    items: [],
    designationUsage: [],
  });
  const [allAspects, setAllAspects] = useState<Aspect[]>([]);
  const [aspectParamsById, setAspectParamsById] = useState<
    Map<string, AspectParameter[]>
  >(new Map());
  const [designationQuery, setDesignationQuery] = useState("");

  // Pending designation rows (not yet persisted).
  type PendingRow = {
    tmpId: string;
    designation: string;
    values: Record<string, string>;
  };
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [savingBatch, setSavingBatch] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  const refreshAll = useCallback(async () => {
    const [stdRes, paramsRes, desRes, aspectsRes] = await Promise.all([
      fetch(`/api/standards/${standardId}`),
      fetch(`/api/standards/${standardId}/parameters`),
      fetch(
        `/api/standards/${standardId}/designations?${new URLSearchParams({
          limit: "100",
          ...(designationQuery.trim() ? { q: designationQuery.trim() } : {}),
        })}`
      ),
      fetch(`/api/aspects`),
    ]);
    const std = await stdRes.json();
    const pData = await paramsRes.json();
    const dData = await desRes.json();
    const aData = await aspectsRes.json();
    setMeta(std.standard ?? null);
    setAspects(std.aspects ?? []);
    setParameters(pData.parameters ?? []);
    setDesignations(dData.designations ?? []);
    setDesignationTotal(dData.total ?? 0);
    setUsage({
      itemCount: std.itemCount ?? 0,
      designationCount: std.designationCount ?? 0,
      items: std.items ?? [],
      designationUsage: std.designationUsage ?? [],
    });
    setAllAspects(aData.aspects ?? []);
  }, [standardId, designationQuery]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const fetchAspectParams = useCallback(async (aspectId: string) => {
    if (aspectParamsById.has(aspectId)) return;
    const res = await fetch(`/api/aspects/${aspectId}/parameters`);
    const data = await res.json();
    setAspectParamsById((prev) => {
      const next = new Map(prev);
      next.set(aspectId, data.parameters ?? []);
      return next;
    });
  }, [aspectParamsById]);

  useEffect(() => {
    for (const a of aspects) fetchAspectParams(a.aspectId);
  }, [aspects, fetchAspectParams]);

  async function linkAspect(aspectId: string) {
    await fetch(`/api/standards/${standardId}/aspects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aspectId }),
    });
    refreshAll();
    onMutated();
  }

  async function unlinkAspect(aspectId: string) {
    await fetch(
      `/api/standards/${standardId}/aspects?aspectId=${aspectId}`,
      { method: "DELETE" }
    );
    refreshAll();
    onMutated();
  }

  async function addParameter(parameterDefinitionId: string, role = "key") {
    await fetch(`/api/standards/${standardId}/parameters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parameterDefinitionId, role }),
    });
    refreshAll();
  }

  async function removeParameter(parameterDefinitionId: string) {
    await fetch(
      `/api/standards/${standardId}/parameters?parameterDefinitionId=${parameterDefinitionId}`,
      { method: "DELETE" }
    );
    refreshAll();
  }

  async function deleteDesignation(id: string) {
    await fetch(`/api/standards/${standardId}/designations?id=${id}`, {
      method: "DELETE",
    });
    refreshAll();
  }

  const linkedAspectIds = new Set(aspects.map((a) => a.aspectId));
  const linkableAspects = allAspects.filter((a) => !linkedAspectIds.has(a.id));
  const parameterIds = new Set(parameters.map((p) => p.parameterDefinitionId));
  const availableParams: { id: string; name: string; dataType: string; unit: string | null }[] = [];
  for (const a of aspects) {
    const aspectParams = aspectParamsById.get(a.aspectId) ?? [];
    for (const ap of aspectParams) {
      if (
        !parameterIds.has(ap.parameterDefinitionId) &&
        !availableParams.some((p) => p.id === ap.parameterDefinitionId)
      ) {
        availableParams.push({
          id: ap.parameterDefinitionId,
          name: ap.parameterName,
          dataType: ap.dataType,
          unit: ap.unit,
        });
      }
    }
  }

  async function updateMeta(updates: Partial<StandardSummary>) {
    if (!meta) return;
    const res = await fetch(`/api/standards/${standardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      refreshAll();
      onMutated();
    }
  }

  function addPendingRow() {
    setPending((prev) => [
      ...prev,
      {
        tmpId: `tmp-${Date.now()}-${Math.random()}`,
        designation: "",
        values: {},
      },
    ]);
  }

  function updatePending(tmpId: string, patch: Partial<PendingRow>) {
    setPending((prev) =>
      prev.map((r) => (r.tmpId === tmpId ? { ...r, ...patch } : r))
    );
  }

  function updatePendingValue(tmpId: string, paramDefId: string, v: string) {
    setPending((prev) =>
      prev.map((r) =>
        r.tmpId === tmpId
          ? { ...r, values: { ...r.values, [paramDefId]: v } }
          : r
      )
    );
  }

  function removePending(tmpId: string) {
    setPending((prev) => prev.filter((r) => r.tmpId !== tmpId));
  }

  async function saveBatch() {
    const rows = pending.filter((r) => r.designation.trim());
    if (rows.length === 0) return;
    setSavingBatch(true);
    setBatchError(null);
    try {
      const results = await Promise.all(
        rows.map(async (r) => {
          const payload: Record<string, unknown> = {};
          for (const p of parameters) {
            const raw = r.values[p.parameterDefinitionId];
            if (raw === undefined || raw === "") continue;
            if (p.dataType === "numeric") {
              const num = Number(raw);
              if (!Number.isNaN(num)) payload[p.parameterDefinitionId] = num;
            } else if (p.dataType === "boolean") {
              payload[p.parameterDefinitionId] = raw === "true";
            } else {
              payload[p.parameterDefinitionId] = raw;
            }
          }
          const res = await fetch(
            `/api/standards/${standardId}/designations`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                designation: r.designation.trim(),
                values: payload,
              }),
            }
          );
          return { r, ok: res.ok };
        })
      );
      const failed = results.filter((x) => !x.ok).map((x) => x.r.tmpId);
      // Keep only failed rows as pending
      setPending((prev) => prev.filter((r) => failed.includes(r.tmpId)));
      if (failed.length > 0) {
        setBatchError(`${failed.length} row(s) failed to save`);
      }
      refreshAll();
    } finally {
      setSavingBatch(false);
    }
  }

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl">
      {/* Header */}
      {meta && (
        <div className="space-y-1">
          <EditableText
            value={meta.name}
            onSave={(name) => updateMeta({ name })}
            className="text-base font-semibold text-slate-100"
            placeholder="Standard name"
          />
          <EditableText
            value={meta.domainTag ?? ""}
            onSave={(domainTag) =>
              updateMeta({ domainTag: domainTag || null })
            }
            className="text-xs text-slate-400"
            placeholder="Domain tag (e.g. Metric Thread)"
          />
          <EditableText
            value={meta.description ?? ""}
            onSave={(description) =>
              updateMeta({ description: description || null })
            }
            className="text-xs text-slate-500"
            placeholder="Description…"
          />
        </div>
      )}

      {/* Aspects */}
      <section className="space-y-2">
        <h3 className="text-xs uppercase tracking-wider text-slate-500">
          Aspects ({aspects.length})
        </h3>
        <div className="flex flex-wrap gap-2">
          {aspects.map((a) => (
            <span
              key={a.aspectId}
              className="inline-flex items-center gap-2 px-2.5 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 group"
            >
              {a.aspectName}
              <span className="text-[10px] text-slate-500">
                {a.coveredCount}/{a.parameterCount}
              </span>
              <button
                onClick={() => unlinkAspect(a.aspectId)}
                className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 text-[10px]"
              >
                ×
              </button>
            </span>
          ))}
          {linkableAspects.length > 0 && (
            <select
              onChange={(e) => {
                if (e.target.value) {
                  linkAspect(e.target.value);
                  e.target.value = "";
                }
              }}
              defaultValue=""
              className="px-2 py-1 bg-slate-800 border border-dashed border-slate-600 rounded text-xs text-slate-400"
            >
              <option value="" disabled>
                + Link aspect…
              </option>
              {linkableAspects.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </section>

      {/* Parameters */}
      <section className="space-y-2">
        <h3 className="text-xs uppercase tracking-wider text-slate-500">
          Parameters ({parameters.length})
        </h3>
        <div className="flex flex-wrap gap-2">
          {parameters.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-2 px-2.5 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 group"
            >
              <span className="font-mono">{p.parameterName}</span>
              <span className="text-[10px] text-slate-500">{p.role}</span>
              <button
                onClick={() => removeParameter(p.parameterDefinitionId)}
                className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 text-[10px]"
              >
                ×
              </button>
            </span>
          ))}
          {availableParams.length > 0 && (
            <select
              onChange={(e) => {
                if (e.target.value) {
                  addParameter(e.target.value);
                  e.target.value = "";
                }
              }}
              defaultValue=""
              className="px-2 py-1 bg-slate-800 border border-dashed border-slate-600 rounded text-xs text-slate-400"
            >
              <option value="" disabled>
                + Add parameter…
              </option>
              {availableParams.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {parameters.length === 0 && availableParams.length === 0 && (
          <p className="text-xs text-slate-500 italic">
            Link an aspect first so its parameters become available here.
          </p>
        )}
      </section>

      {/* Designations */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-wider text-slate-500">
            Designations ({designationTotal})
          </h3>
        </div>

        {parameters.length === 0 && (
          <p className="text-xs text-amber-400">
            Link an aspect + add parameters before creating designations.
          </p>
        )}
        {batchError && (
          <p className="text-xs text-red-400">{batchError}</p>
        )}

        <input
          value={designationQuery}
          onChange={(e) => setDesignationQuery(e.target.value)}
          placeholder="Filter designations…"
          className="w-full max-w-xs px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-accent focus:outline-none"
        />

        {designations.length === 0 && pending.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No designations.</p>
        ) : (
          <div className="overflow-x-auto border border-slate-700 rounded">
            <table className="w-full text-xs">
              <thead className="bg-slate-800/60 text-slate-400">
                <tr>
                  <th className="text-left px-2 py-1.5">Designation</th>
                  {parameters.map((p) => (
                    <th key={p.id} className="text-left px-2 py-1.5">
                      {p.parameterName}
                      {p.unit && (
                        <span className="text-slate-600 ml-1">({p.unit})</span>
                      )}
                    </th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {designations.map((d) => (
                  <tr
                    key={d.id}
                    className="border-t border-slate-700 hover:bg-slate-800/30 group"
                  >
                    <td className="px-2 py-1 font-mono text-slate-200">
                      {d.designation}
                    </td>
                    {parameters.map((p) => {
                      const raw = d.values?.[p.parameterDefinitionId];
                      const scalar =
                        raw && typeof raw === "object" && "value" in raw
                          ? (raw as { value: unknown }).value
                          : raw;
                      return (
                        <td key={p.id} className="px-2 py-1 text-slate-300">
                          {scalar === undefined || scalar === null ? (
                            <span className="text-slate-600">—</span>
                          ) : (
                            String(scalar)
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1 text-right">
                      <button
                        onClick={() => deleteDesignation(d.id)}
                        className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 text-[10px]"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
                {pending.map((r) => (
                  <tr
                    key={r.tmpId}
                    className="border-t border-accent/30 bg-accent/5"
                  >
                    <td className="px-1 py-1">
                      <input
                        value={r.designation}
                        onChange={(e) =>
                          updatePending(r.tmpId, {
                            designation: e.target.value,
                          })
                        }
                        autoFocus
                        placeholder="e.g. M3x0.5"
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-100 focus:border-accent focus:outline-none"
                      />
                    </td>
                    {parameters.map((p) => (
                      <td key={p.id} className="px-1 py-1">
                        <input
                          value={r.values[p.parameterDefinitionId] ?? ""}
                          onChange={(e) =>
                            updatePendingValue(
                              r.tmpId,
                              p.parameterDefinitionId,
                              e.target.value
                            )
                          }
                          placeholder={p.dataType === "numeric" ? "0" : "…"}
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 focus:border-accent focus:outline-none"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1 text-right">
                      <button
                        onClick={() => removePending(r.tmpId)}
                        className="text-slate-500 hover:text-red-400 text-[10px]"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add-row / Save controls at the bottom (table convention) */}
        <div className="flex items-center gap-3">
          <button
            onClick={addPendingRow}
            disabled={parameters.length === 0}
            className="text-[11px] px-2 py-1 border border-dashed border-slate-600 rounded text-slate-400 hover:text-accent hover:border-accent disabled:opacity-40 transition-colors"
            title={
              parameters.length === 0
                ? "Add parameters to this standard first"
                : "Append an empty row"
            }
          >
            + Add row
          </button>
          {pending.length > 0 && (
            <>
              <button
                onClick={saveBatch}
                disabled={
                  savingBatch || !pending.some((r) => r.designation.trim())
                }
                className="text-[11px] px-3 py-1 bg-accent text-white rounded hover:brightness-110 disabled:opacity-50"
              >
                {savingBatch
                  ? "Saving…"
                  : `Save ${pending.filter((r) => r.designation.trim()).length} row${
                      pending.filter((r) => r.designation.trim()).length === 1 ? "" : "s"
                    }`}
              </button>
              <button
                onClick={() => setPending([])}
                className="text-[11px] text-slate-500 hover:text-slate-300"
              >
                Discard
              </button>
            </>
          )}
        </div>
      </section>
      </div>

      {/* Right info panel */}
      <StandardInfoPanel
        meta={meta}
        usage={usage}
        aspectCount={aspects.length}
        parameterCount={parameters.length}
        designationTotal={designationTotal}
        onDelete={onDelete}
      />
    </div>
  );
}

function StandardInfoPanel({
  meta,
  usage,
  aspectCount,
  parameterCount,
  designationTotal,
  onDelete,
}: {
  meta: StandardSummary | null;
  usage: {
    itemCount: number;
    designationCount: number;
    items: StandardItemUsage[];
    designationUsage: DesignationUsage[];
  };
  aspectCount: number;
  parameterCount: number;
  designationTotal: number;
  onDelete: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const confirmed = !!meta && confirmText === meta.name;

  return (
    <aside className="w-80 shrink-0 border-l border-slate-700 bg-slate-800/20 overflow-y-auto flex flex-col">
      {/* Tab header (single Info tab — keeps room to add more later) */}
      <div className="flex border-b border-slate-700 shrink-0">
        <button
          className="flex-1 px-3 py-2 text-xs font-medium text-accent border-b-2 border-accent -mb-px"
          aria-current="true"
        >
          Info
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-5 text-xs">
          {/* Summary tiles */}
          <div className="grid grid-cols-2 gap-2">
            <Tile label="Items using" value={usage.itemCount} />
            <Tile label="Designations" value={designationTotal} />
            <Tile label="Aspects linked" value={aspectCount} />
            <Tile label="Parameters" value={parameterCount} />
          </div>

          {/* Where applied */}
          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
              Applied to items ({usage.items.length}
              {usage.itemCount > usage.items.length
                ? ` of ${usage.itemCount}`
                : ""}
              )
            </h3>
            {usage.items.length === 0 ? (
              <p className="text-[11px] text-slate-600 italic">
                Not applied yet.
              </p>
            ) : (
              <ul className="divide-y divide-slate-800 rounded border border-slate-800">
                {usage.items.map((i) => (
                  <li
                    key={i.itemStandardId}
                    className="px-2 py-1.5 flex items-center justify-between gap-2 hover:bg-slate-800/40"
                  >
                    <span
                      className="text-slate-200 truncate"
                      title={i.itemName}
                    >
                      {i.itemName}
                    </span>
                    <span className="shrink-0 flex items-center gap-1.5">
                      {i.designation ? (
                        <span className="font-mono text-accent">
                          {i.designation}
                        </span>
                      ) : (
                        <span className="text-slate-600 italic">no desig.</span>
                      )}
                      {i.isCustom && (
                        <span className="text-amber-400 text-[9px]">custom</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Top designations */}
          {usage.designationUsage.length > 0 && (
            <div>
              <h3 className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
                Designation usage
              </h3>
              <ul className="space-y-1">
                {usage.designationUsage.slice(0, 8).map((d) => {
                  const max = Math.max(
                    ...usage.designationUsage.map((x) => x.itemCount),
                    1
                  );
                  const pct = (d.itemCount / max) * 100;
                  return (
                    <li
                      key={d.designationId ?? "none"}
                      className="flex items-center gap-2 text-[11px]"
                    >
                      <span className="w-24 truncate font-mono text-slate-300">
                        {d.designation ?? (
                          <span className="italic text-slate-600">none</span>
                        )}
                      </span>
                      <div className="flex-1 h-1.5 bg-slate-800 rounded overflow-hidden">
                        <div
                          className="h-full bg-accent/70"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-6 text-right tabular-nums text-slate-400">
                        {d.itemCount}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Metadata */}
          {meta && (
            <div className="pt-3 border-t border-slate-800 space-y-1 text-[11px] text-slate-500">
              {meta.domainTag && (
                <div>
                  <span className="text-slate-600">Tag:</span>{" "}
                  <span className="text-slate-400">{meta.domainTag}</span>
                </div>
              )}
              <div>
                <span className="text-slate-600">ID:</span>{" "}
                <span className="font-mono text-slate-500 text-[10px]">
                  {meta.id}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: heavy-delete */}
      {meta && (
        <div className="shrink-0 border-t border-slate-700 p-4 bg-slate-900/40">
          {!deleteOpen ? (
            <button
              onClick={() => setDeleteOpen(true)}
              className="w-full text-xs text-red-400 hover:text-red-300 border border-red-900/50 hover:border-red-700 rounded py-1.5 transition-colors"
            >
              Delete standard…
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-400 leading-snug">
                {usage.itemCount > 0 ? (
                  <>
                    Applied to{" "}
                    <span className="text-slate-100 font-semibold">
                      {usage.itemCount} item
                      {usage.itemCount === 1 ? "" : "s"}
                    </span>
                    . Those applications will be removed; parameter values
                    already auto-filled stay on the items.
                  </>
                ) : (
                  <>Not applied to any items.</>
                )}{" "}
                Designations will be erased. This cannot be undone.
              </p>
              <label className="block text-[11px] text-slate-400">
                Type{" "}
                <span className="font-mono text-slate-200 bg-slate-700 px-1.5 py-0.5 rounded">
                  {meta.name}
                </span>{" "}
                to confirm:
              </label>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={meta.name}
                className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 placeholder:text-slate-600 focus:border-red-500 focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={onDelete}
                  disabled={!confirmed}
                  className={`flex-1 px-3 py-1.5 text-xs rounded transition-colors ${
                    confirmed
                      ? "bg-red-600 text-white hover:bg-red-500"
                      : "bg-slate-700 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  Delete this standard
                </button>
                <button
                  onClick={() => {
                    setDeleteOpen(false);
                    setConfirmText("");
                  }}
                  className="text-[11px] text-slate-500 hover:text-slate-300 px-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="text-base font-semibold text-slate-100 tabular-nums">
        {value}
      </div>
    </div>
  );
}

