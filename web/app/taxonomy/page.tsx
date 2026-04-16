"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CreateFromDesignationDialog from "@/app/items/CreateFromDesignationDialog";
import GenerateSetDialog from "@/app/items/GenerateSetDialog";
import BulkAspectImport from "./BulkAspectImport";
import { parseSiValue } from "@/lib/siPrefix";

// --- Types ---

interface Aspect {
  id: string;
  name: string;
  description: string | null;
  // Optional usage counts — present when loaded via listWithUsage().
  parameterCount?: number;
  itemCount?: number;
  standardCount?: number;
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
  description: string | null;
  searchTerms: string[] | null;
  defaultValue: unknown;
  constraints: unknown;
  // Optional usage counts — present when loaded via listWithUsage().
  aspectCount?: number;
  itemCount?: number;
  standardCount?: number;
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

// --- Parameter typeahead (attach existing or inline-create) ---

interface CoOccurrenceSuggestion {
  parameterDefinitionId: string;
  name: string;
  dataType: string;
  unit: string | null;
  frequency: number;
  sourceAspects: string[];
}

function ParamTypeahead({
  available,
  onAdd,
  onCreateAndAdd,
  aspectId,
  placeholder = "Search to add parameter…",
}: {
  available: ParameterDefinition[];
  onAdd: (pd: ParameterDefinition) => Promise<void> | void;
  onCreateAndAdd: (def: ParameterDefinition) => Promise<void> | void;
  // Optional aspect context — when set the typeahead asks the backend
  // for co-occurring-parameter suggestions and surfaces them as a
  // "commonly paired with" strip above the dropdown when the input is
  // empty.
  aspectId?: string;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [creating, setCreating] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createDataType, setCreateDataType] = useState("text");
  const [createUnit, setCreateUnit] = useState("");
  const [createEnumValues, setCreateEnumValues] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<CoOccurrenceSuggestion[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-fetch suggestions whenever the aspect changes or the attached
  // parameter set changes (available.length is a coarse but cheap proxy
  // for "something added/removed").
  useEffect(() => {
    if (!aspectId) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/aspects/${aspectId}/suggested-parameters?limit=5`
        );
        const data = await res.json();
        if (!cancelled) setSuggestions(data.suggestions ?? []);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [aspectId, available.length]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? available.filter(
        (pd) =>
          pd.name.toLowerCase().includes(q) ||
          (pd.unit ?? "").toLowerCase().includes(q) ||
          pd.dataType.toLowerCase().includes(q)
      )
    : available.slice(0, 8);

  const exactMatch = filtered.some(
    (pd) => pd.name.toLowerCase() === q
  );
  const canCreate = q.length > 0 && !exactMatch;
  // Total selectable items in dropdown
  const total = filtered.length + (canCreate ? 1 : 0);
  const clampedHighlight = total === 0 ? -1 : Math.min(highlight, total - 1);

  useEffect(() => {
    setHighlight(0);
  }, [q, available.length]);

  async function addAt(idx: number) {
    if (idx < filtered.length) {
      const pd = filtered[idx];
      await onAdd(pd);
      setQuery("");
      setHighlight(0);
      inputRef.current?.focus();
    } else if (canCreate && idx === filtered.length) {
      // Open inline create form with query as name seed
      setCreating(true);
    }
  }

  async function performCreate() {
    if (!query.trim()) return;
    setCreateSaving(true);
    setCreateError(null);
    try {
      const body: Record<string, unknown> = {
        name: query.trim(),
        dataType: createDataType,
      };
      if (createUnit.trim()) body.unit = createUnit.trim();
      if (createDataType === "enum") {
        const vals = createEnumValues
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
      await onCreateAndAdd(def);
      setQuery("");
      setCreateDataType("text");
      setCreateUnit("");
      setCreateEnumValues("");
      setCreating(false);
      inputRef.current?.focus();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreateSaving(false);
    }
  }

  if (creating) {
    return (
      <div className="p-3 bg-slate-900/60 border border-accent/40 rounded space-y-2">
        <div className="text-[11px] text-slate-400">
          Create parameter{" "}
          <span className="font-mono text-slate-100 bg-slate-800 px-1.5 py-0.5 rounded">
            {query}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select
            autoFocus
            value={createDataType}
            onChange={(e) => setCreateDataType(e.target.value)}
            className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-accent focus:outline-none"
          >
            <option value="text">text</option>
            <option value="numeric">numeric</option>
            <option value="boolean">boolean</option>
            <option value="enum">enum</option>
          </select>
          <input
            value={createUnit}
            onChange={(e) => setCreateUnit(e.target.value)}
            placeholder="unit (optional)"
            className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-accent focus:outline-none"
          />
        </div>
        {createDataType === "enum" && (
          <input
            value={createEnumValues}
            onChange={(e) => setCreateEnumValues(e.target.value)}
            placeholder="enum values (comma-separated)"
            className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-accent focus:outline-none"
          />
        )}
        {createError && (
          <p className="text-[11px] text-red-400">{createError}</p>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={performCreate}
            disabled={createSaving}
            className="px-3 py-1 bg-accent text-white rounded text-xs hover:brightness-110 disabled:opacity-50"
          >
            {createSaving ? "Creating…" : "Create + add"}
          </button>
          <button
            onClick={() => {
              setCreating(false);
              inputRef.current?.focus();
            }}
            className="text-[11px] text-slate-500 hover:text-slate-300"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => (total === 0 ? 0 : (h + 1) % total));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => (total === 0 ? 0 : (h - 1 + total) % total));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (clampedHighlight >= 0) addAt(clampedHighlight);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder:text-slate-500 focus:border-accent focus:outline-none"
      />

      {/* Commonly-paired-with chips — aspect context + empty query */}
      {aspectId && !query.trim() && suggestions.length > 0 && (
        <div className="mt-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
            Commonly paired with
          </div>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s.parameterDefinitionId}
                onClick={async () => {
                  // Use the existing add-by-definition path. Build a
                  // minimal ParameterDefinition shape; the onAdd call
                  // only needs .id to link to the aspect.
                  await onAdd({
                    id: s.parameterDefinitionId,
                    name: s.name,
                    dataType: s.dataType,
                    unit: s.unit,
                    description: null,
                    searchTerms: null,
                    defaultValue: null,
                    constraints: null,
                  });
                }}
                title={`Seen in: ${s.sourceAspects.join(", ")}`}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs bg-slate-800 border border-dashed border-slate-600 text-slate-300 rounded-full hover:border-accent hover:text-accent transition-colors"
              >
                <span className="font-mono">{s.name}</span>
                {s.unit && (
                  <span className="text-[10px] text-slate-500">{s.unit}</span>
                )}
                <span className="text-[9px] text-slate-500 tabular-nums">
                  ×{s.frequency}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {open && (filtered.length > 0 || canCreate) && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-64 overflow-y-auto bg-slate-900 border border-slate-600 rounded shadow-lg">
          {filtered.map((pd, i) => (
            <button
              key={pd.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addAt(i)}
              onMouseEnter={() => setHighlight(i)}
              className={`w-full text-left flex items-center justify-between px-3 py-1.5 ${
                i === clampedHighlight ? "bg-slate-700/70" : "hover:bg-slate-800/80"
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="text-sm text-slate-200 font-mono truncate">
                  {pd.name}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                  {pd.dataType}
                </span>
                {pd.unit && (
                  <span className="text-[10px] text-slate-500">{pd.unit}</span>
                )}
                {pd.aspectCount !== undefined && pd.aspectCount > 0 && (
                  <span className="text-[10px] text-slate-500">
                    in {pd.aspectCount}{" "}
                    aspect{pd.aspectCount === 1 ? "" : "s"}
                  </span>
                )}
              </span>
              <span className="text-[10px] text-accent shrink-0">+ add</span>
            </button>
          ))}
          {filtered.length === 0 && !canCreate && (
            <div className="px-3 py-2 text-xs text-slate-500 italic">
              No matches
            </div>
          )}
          {canCreate && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addAt(filtered.length)}
              onMouseEnter={() => setHighlight(filtered.length)}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 border-t border-slate-700 ${
                clampedHighlight === filtered.length
                  ? "bg-slate-700/70"
                  : "hover:bg-slate-800/80"
              }`}
            >
              <span className="text-accent text-sm">+</span>
              <span className="text-xs text-slate-300">
                Create new parameter{" "}
                <span className="font-mono text-slate-100 bg-slate-800 px-1 rounded">
                  {query}
                </span>
                …
              </span>
            </button>
          )}
        </div>
      )}
      {!open && available.length === 0 && (
        <p className="mt-1.5 text-[11px] text-slate-500">
          No parameters defined yet. Type a name and press Enter to create
          one.
        </p>
      )}
    </div>
  );
}


// --- Main Page ---

// Tabs have moved to sibling routes (/taxonomy/aspects, /parameters, etc.).
// Visiting /taxonomy on its own redirects to /taxonomy/aspects.
export default function TaxonomyIndex() {
  if (typeof window !== "undefined") {
    window.location.replace("/taxonomy/aspects");
  }
  return null;
}

// --- Aspects Tab ---

export function AspectsTab() {
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [filter, setFilter] = useState("");
  const [aspects, setAspects] = useState<Aspect[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [params, setParams] = useState<AspectParameter[]>([]);
  const [allParamDefs, setAllParamDefs] = useState<ParameterDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsUsing, setItemsUsing] = useState<
    { itemId: string; itemName: string }[]
  >([]);
  const [showItems, setShowItems] = useState(false);
  const [selectedParamDefId, setSelectedParamDefId] = useState<string | null>(
    null
  );
  const [panelTab, setPanelTab] = useState<"parameter" | "info">("info");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteExpanded, setDeleteExpanded] = useState(false);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");


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

  useEffect(() => {
    // Reset + lazily fetch items-using list on aspect change.
    setItemsUsing([]);
    setShowItems(false);
    setSelectedParamDefId(null);
    setPanelTab("info");
    setDeleteConfirmText("");
    setDeleteExpanded(false);
    if (!selectedId) return;
    (async () => {
      try {
        const res = await fetch(`/api/aspects/${selectedId}/items`);
        const data = await res.json();
        setItemsUsing(data.items ?? []);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [selectedId]);

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

  async function updateAspectMeta(updates: { name?: string; description?: string | null }) {
    if (!selectedId) return;
    try {
      await fetch(`/api/aspects/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      await fetchAspects();
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteSelectedAspect() {
    if (!selectedId) return;
    try {
      await fetch(`/api/aspects/${selectedId}`, { method: "DELETE" });
      setSelectedId(null);
      setDeleteExpanded(false);
      setDeleteConfirmText("");
      await fetchAspects();
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
      {/* Aspect list */}
      <div className="w-72 border-r border-slate-700 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-700 flex items-center justify-between">
          <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">
            Aspects
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBulkImport(true)}
              className="text-[10px] text-slate-500 hover:text-accent"
            >
              Bulk import
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="text-xs text-accent hover:brightness-110"
            >
              + New
            </button>
          </div>
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

        <div className="p-2 border-b border-slate-700">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter aspects…"
            className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 placeholder:text-slate-500 focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-slate-500 text-sm">Loading...</div>
          ) : aspects.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">
              No aspects defined yet.
            </div>
          ) : (
            aspects
              .filter((a) => {
                const q = filter.trim().toLowerCase();
                if (!q) return true;
                return (
                  a.name.toLowerCase().includes(q) ||
                  (a.description ?? "").toLowerCase().includes(q)
                );
              })
              .map((aspect) => (
              <button
                key={aspect.id}
                onClick={() => setSelectedId(aspect.id)}
                className={`w-full text-left px-4 py-3 border-b border-slate-700/50 transition-colors ${
                  selectedId === aspect.id
                    ? "bg-slate-700/50"
                    : "hover:bg-slate-800/30"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-slate-200 font-medium truncate">
                    {aspect.name}
                  </span>
                  {(aspect.itemCount !== undefined ||
                    aspect.parameterCount !== undefined) && (
                    <span
                      className="text-[10px] text-slate-500 tabular-nums shrink-0"
                      title={`${aspect.itemCount ?? 0} items · ${aspect.parameterCount ?? 0} parameters · ${aspect.standardCount ?? 0} standards`}
                    >
                      {aspect.itemCount ?? 0}·{aspect.parameterCount ?? 0}
                    </span>
                  )}
                </div>
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

      {/* Middle: aspect detail — editable header + parameters */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selectedAspect ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
            Select an aspect to view its parameters.
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-slate-700 shrink-0 space-y-1">
              <EditableText
                value={selectedAspect.name}
                onSave={(name) => updateAspectMeta({ name })}
                className="text-lg font-semibold text-slate-100"
                placeholder="Aspect name"
              />
              <EditableText
                value={selectedAspect.description ?? ""}
                onSave={(description) =>
                  updateAspectMeta({ description: description || null })
                }
                className="text-xs text-slate-500"
                placeholder="Description…"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
                    {params.map((p) => {
                      const isSel =
                        selectedParamDefId === p.parameterDefinitionId;
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            setSelectedParamDefId(p.parameterDefinitionId);
                            setPanelTab("parameter");
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 border rounded transition-colors text-left ${
                            isSel
                              ? "bg-accent/10 border-accent"
                              : "bg-slate-800/50 border-slate-700 hover:bg-slate-800"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm ${
                                isSel ? "text-accent" : "text-slate-200"
                              }`}
                            >
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
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                  Add Parameter
                </h3>
                <ParamTypeahead
                  available={availableParamDefs}
                  onAdd={async (pd) => addParamToAspect(pd.id)}
                  onCreateAndAdd={async (newDef) => addParamToAspect(newDef.id)}
                  aspectId={selectedId ?? undefined}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right: tabbed info / parameter panel */}
      {selectedAspect && (
        <aside className="w-80 shrink-0 border-l border-slate-700 bg-slate-800/20 overflow-y-auto flex flex-col">
          <div className="flex border-b border-slate-700 shrink-0">
            <button
              onClick={() => setPanelTab("parameter")}
              disabled={!selectedParamDefId}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors disabled:opacity-40 ${
                panelTab === "parameter"
                  ? "text-accent border-b-2 border-accent -mb-px"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Parameter
            </button>
            <button
              onClick={() => setPanelTab("info")}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                panelTab === "info"
                  ? "text-accent border-b-2 border-accent -mb-px"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Info
            </button>
          </div>

          {panelTab === "parameter" ? (
            <AspectParamPanel
              param={
                selectedParamDefId
                  ? params.find(
                      (p) => p.parameterDefinitionId === selectedParamDefId
                    ) ?? null
                  : null
              }
              onRemove={async (pdId) => {
                await removeParamFromAspect(pdId);
                setSelectedParamDefId(null);
                setPanelTab("info");
              }}
            />
          ) : (
            <AspectInfoPanel
              aspect={selectedAspect}
              itemsUsing={itemsUsing}
              showItems={showItems}
              onToggleItems={() => setShowItems((v) => !v)}
              deleteExpanded={deleteExpanded}
              onDeleteExpand={() => setDeleteExpanded(true)}
              onDeleteCancel={() => {
                setDeleteExpanded(false);
                setDeleteConfirmText("");
              }}
              deleteConfirmText={deleteConfirmText}
              onDeleteConfirmTextChange={setDeleteConfirmText}
              onDelete={deleteSelectedAspect}
            />
          )}
        </aside>
      )}

      {showBulkImport && (
        <BulkAspectImport
          onComplete={() => {
            fetchAspects();
          }}
          onClose={() => setShowBulkImport(false)}
        />
      )}

      </div>
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

// --- Aspect right-pane panels ---

function AspectParamPanel({
  param,
  onRemove,
}: {
  param: AspectParameter | null;
  onRemove: (parameterDefinitionId: string) => Promise<void> | void;
}) {
  if (!param) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-xs p-6 text-center">
        Click a parameter on the left to see details here.
      </div>
    );
  }
  const c = (param.constraints ?? {}) as {
    enumValues?: string[];
    min?: number;
    max?: number;
  };
  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      <div className="p-4 space-y-4 flex-1">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
            Parameter
          </div>
          <div className="text-sm font-mono text-slate-100">
            {param.parameterName}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">
              Type
            </div>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
              {param.dataType}
            </span>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">
              Unit
            </div>
            <div className="text-slate-300">{param.unit || "—"}</div>
          </div>
        </div>
        {c.enumValues && c.enumValues.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
              Enum values
            </div>
            <div className="flex flex-wrap gap-1">
              {c.enumValues.map((v) => (
                <span
                  key={v}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                >
                  {v}
                </span>
              ))}
            </div>
          </div>
        )}
        {(c.min !== undefined || c.max !== undefined) && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
              Range
            </div>
            <div className="text-xs text-slate-300 tabular-nums">
              {c.min ?? "…"} … {c.max ?? "…"}
            </div>
          </div>
        )}
        {param.required && (
          <div className="text-[11px] text-amber-400">
            Required when this aspect is applied.
          </div>
        )}
        <p className="text-[11px] text-slate-500">
          Full edit — dataType, unit, constraints, description, search terms —
          lives on{" "}
          <a
            href={`/taxonomy/parameters?selected=${param.parameterDefinitionId}`}
            className="text-accent hover:brightness-110"
          >
            Taxonomy → Parameters
          </a>
          .
        </p>
      </div>
      <div className="shrink-0 border-t border-slate-700 p-4">
        <button
          onClick={() => onRemove(param.parameterDefinitionId)}
          className="w-full text-xs text-red-400 hover:text-red-300 border border-red-900/50 hover:border-red-700 rounded py-1.5 transition-colors"
        >
          Remove from this aspect
        </button>
      </div>
    </div>
  );
}

function AspectInfoPanel({
  aspect,
  itemsUsing,
  showItems,
  onToggleItems,
  deleteExpanded,
  onDeleteExpand,
  onDeleteCancel,
  deleteConfirmText,
  onDeleteConfirmTextChange,
  onDelete,
}: {
  aspect: Aspect;
  itemsUsing: { itemId: string; itemName: string }[];
  showItems: boolean;
  onToggleItems: () => void;
  deleteExpanded: boolean;
  onDeleteExpand: () => void;
  onDeleteCancel: () => void;
  deleteConfirmText: string;
  onDeleteConfirmTextChange: (s: string) => void;
  onDelete: () => void;
}) {
  const confirmed = deleteConfirmText === aspect.name;
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-5 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <Tile label="Items using" value={aspect.itemCount ?? 0} />
            <Tile label="Parameters" value={aspect.parameterCount ?? 0} />
            <Tile label="Standards" value={aspect.standardCount ?? 0} />
          </div>

          <div>
            <button
              onClick={onToggleItems}
              className="w-full flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 hover:text-slate-200 transition-colors"
            >
              <span>
                Applied to items ({itemsUsing.length})
              </span>
              <span>{showItems ? "▼" : "▶"}</span>
            </button>
            {showItems && (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {itemsUsing.length === 0 ? (
                  <p className="text-[11px] text-slate-600 italic">
                    Not applied yet.
                  </p>
                ) : (
                  itemsUsing.map((i) => (
                    <a
                      key={i.itemId}
                      href={`/items?selected=${i.itemId}`}
                      className="block px-2 py-1 bg-slate-900/40 border border-slate-700 rounded text-[11px] text-slate-300 hover:text-accent hover:bg-slate-800 transition-colors truncate"
                    >
                      {i.itemName}
                    </a>
                  ))
                )}
              </div>
            )}
          </div>

          {aspect.description && (
            <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500">
              {aspect.description}
            </div>
          )}
        </div>
      </div>
      <div className="shrink-0 border-t border-slate-700 p-4 bg-slate-900/40">
        {!deleteExpanded ? (
          <button
            onClick={onDeleteExpand}
            className="w-full text-xs text-red-400 hover:text-red-300 border border-red-900/50 hover:border-red-700 rounded py-1.5 transition-colors"
          >
            Delete aspect…
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-400 leading-snug">
              {(aspect.itemCount ?? 0) > 0 ? (
                <>
                  Applied to{" "}
                  <span className="text-slate-100 font-semibold">
                    {aspect.itemCount} item
                    {aspect.itemCount === 1 ? "" : "s"}
                  </span>
                  . Their parameter values for this aspect will be erased.
                </>
              ) : (
                <>Not applied to any items.</>
              )}{" "}
              This cannot be undone.
            </p>
            <label className="block text-[11px] text-slate-400">
              Type{" "}
              <span className="font-mono text-slate-200 bg-slate-700 px-1.5 py-0.5 rounded">
                {aspect.name}
              </span>{" "}
              to confirm:
            </label>
            <input
              value={deleteConfirmText}
              onChange={(e) => onDeleteConfirmTextChange(e.target.value)}
              placeholder={aspect.name}
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
                Delete this aspect
              </button>
              <button
                onClick={onDeleteCancel}
                className="text-[11px] text-slate-500 hover:text-slate-300 px-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Parameters Tab ---

export function ParametersTab() {
  const [view, setView] = useState<"detail" | "matrix">("detail");
  const [paramDefs, setParamDefs] = useState<ParameterDefinition[]>([]);
  const [aspectsForMatrix, setAspectsForMatrix] = useState<Aspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDataType, setNewDataType] = useState("text");
  const [newUnit, setNewUnit] = useState("");
  const [newEnumValues, setNewEnumValues] = useState("");
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [usage, setUsage] = useState<ParamUsage | null>(null);
  const [deleteExpanded, setDeleteExpanded] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

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

  useEffect(() => {
    if (view !== "matrix") return;
    (async () => {
      try {
        const res = await fetch("/api/aspects");
        const data = await res.json();
        setAspectsForMatrix(data.aspects || []);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [view]);

  // Lazy-load usage per selected parameter.
  useEffect(() => {
    setUsage(null);
    setDeleteExpanded(false);
    setDeleteConfirmText("");
    if (!selectedId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/parameter-definitions/${selectedId}/usage`
        );
        const data = await res.json();
        if (!cancelled) setUsage(data);
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

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

  async function deleteSelectedParam() {
    if (!selectedId) return;
    try {
      await fetch(`/api/parameter-definitions/${selectedId}`, {
        method: "DELETE",
      });
      setSelectedId(null);
      setDeleteExpanded(false);
      setDeleteConfirmText("");
      await fetchParams();
    } catch (err) {
      console.error(err);
    }
  }

  async function updateParam(
    id: string,
    updates: Partial<ParameterDefinition>
  ) {
    await fetch(`/api/parameter-definitions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    await fetchParams();
  }

  const filteredParamDefs = paramDefs.filter((pd) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    if (pd.name.toLowerCase().includes(q)) return true;
    if ((pd.description ?? "").toLowerCase().includes(q)) return true;
    if ((pd.unit ?? "").toLowerCase().includes(q)) return true;
    if ((pd.searchTerms ?? []).some((t) => t.toLowerCase().includes(q))) {
      return true;
    }
    return false;
  });
  const selectedParam = paramDefs.find((pd) => pd.id === selectedId) ?? null;

  if (view === "matrix") {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h2 className="text-sm font-medium text-slate-300">
            Parameter Definitions
          </h2>
          <div className="flex items-center gap-1">
            {(["detail", "matrix"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
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
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter rows (parameters) and columns (aspects)…"
            className="flex-1 max-w-md px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 placeholder:text-slate-500 focus:border-accent focus:outline-none"
          />
        </div>
        <AspectParameterMatrix
          aspects={aspectsForMatrix.filter((a) => {
            const q = filter.trim().toLowerCase();
            if (!q) return true;
            return a.name.toLowerCase().includes(q);
          })}
          allParamDefs={filteredParamDefs.length > 0 ? filteredParamDefs : null}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* Left: parameter list */}
      <div className="w-72 border-r border-slate-700 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-700 flex items-center justify-between">
          <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">
            Parameters
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView("matrix")}
              className="text-[10px] text-slate-500 hover:text-accent"
              title="Switch to matrix view"
            >
              Matrix
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="text-xs text-accent hover:brightness-110"
            >
              + New
            </button>
          </div>
        </div>

        {showCreate && (
          <div className="p-3 border-b border-slate-700 space-y-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Parameter name"
              autoFocus
              className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 placeholder:text-slate-500 focus:border-accent focus:outline-none"
            />
            <select
              value={newDataType}
              onChange={(e) => setNewDataType(e.target.value)}
              className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-accent focus:outline-none"
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
              className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 placeholder:text-slate-500 focus:border-accent focus:outline-none"
            />
            {newDataType === "enum" && (
              <input
                type="text"
                value={newEnumValues}
                onChange={(e) => setNewEnumValues(e.target.value)}
                placeholder="Enum values (comma-separated)"
                className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 placeholder:text-slate-500 focus:border-accent focus:outline-none"
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

        <div className="p-2 border-b border-slate-700">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter parameters…"
            className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 placeholder:text-slate-500 focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-slate-500 text-sm">
              Loading…
            </div>
          ) : filteredParamDefs.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">
              {paramDefs.length === 0 ? "No parameters yet." : "No matches."}
            </div>
          ) : (
            filteredParamDefs.map((pd) => {
              const isSel = pd.id === selectedId;
              return (
                <button
                  key={pd.id}
                  onClick={() => setSelectedId(pd.id)}
                  className={`w-full text-left px-3 py-2 border-b border-slate-700/50 transition-colors ${
                    isSel
                      ? "bg-slate-700/50"
                      : "hover:bg-slate-800/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-sm font-mono truncate ${
                        isSel ? "text-accent" : "text-slate-200"
                      }`}
                    >
                      {pd.name}
                    </span>
                    <span className="text-[10px] text-slate-500 tabular-nums shrink-0">
                      {(pd.aspectCount ?? 0)}·{(pd.itemCount ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] px-1 py-px rounded bg-slate-800 text-slate-500">
                      {pd.dataType}
                    </span>
                    {pd.unit && (
                      <span className="text-[9px] text-slate-600">
                        {pd.unit}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Middle: parameter editor */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selectedParam ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
            Select a parameter to edit.
          </div>
        ) : (
          <ParameterEditor
            key={selectedParam.id}
            pd={selectedParam}
            onSave={(updates) => updateParam(selectedParam.id, updates)}
          />
        )}
      </div>

      {/* Right: usage panel */}
      {selectedParam && (
        <ParameterUsagePanel
          pd={selectedParam}
          usage={usage}
          deleteExpanded={deleteExpanded}
          onDeleteExpand={() => setDeleteExpanded(true)}
          onDeleteCancel={() => {
            setDeleteExpanded(false);
            setDeleteConfirmText("");
          }}
          deleteConfirmText={deleteConfirmText}
          onDeleteConfirmTextChange={setDeleteConfirmText}
          onDelete={deleteSelectedParam}
        />
      )}
    </div>
  );
}

interface ParamUsage {
  aspects: { id: string; name: string }[];
  items: { id: string; name: string }[];
  standards: { id: string; name: string }[];
}

// --- Parameters three-pane: editor + usage panel ---

function ParameterEditor({
  pd,
  onSave,
}: {
  pd: ParameterDefinition;
  onSave: (updates: Partial<ParameterDefinition>) => Promise<void>;
}) {
  const [name, setName] = useState(pd.name);
  const [dataType, setDataType] = useState(pd.dataType);
  const [unit, setUnit] = useState(pd.unit ?? "");
  const [description, setDescription] = useState(pd.description ?? "");
  const [searchTerms, setSearchTerms] = useState(
    (pd.searchTerms ?? []).join(", ")
  );
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
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const originalName = pd.name;

  async function commit() {
    setSaving(true);
    try {
      const updates: Partial<ParameterDefinition> = {
        name: name.trim() || originalName,
        dataType,
        unit: unit.trim() || null,
        description: description.trim() || null,
        searchTerms:
          searchTerms
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean).length > 0
            ? searchTerms
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : null,
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
        if (minStr.trim() !== "") {
          const n = parseSiValue(minStr);
          if (n !== null) nextConstraints.min = n;
        }
        if (maxStr.trim() !== "") {
          const n = parseSiValue(maxStr);
          if (n !== null) nextConstraints.max = n;
        }
      }
      updates.constraints =
        Object.keys(nextConstraints).length > 0 ? nextConstraints : null;
      await onSave(updates);
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="px-6 py-4 border-b border-slate-700 shrink-0 flex items-baseline justify-between gap-4">
        <div className="flex-1 min-w-0">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-lg font-semibold text-slate-100 font-mono bg-transparent border-b border-dashed border-transparent hover:border-slate-600 focus:border-accent outline-none w-full"
          />
          <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            in <span className="text-slate-300">{pd.aspectCount ?? 0}</span>{" "}
            aspect{(pd.aspectCount ?? 0) === 1 ? "" : "s"} ·{" "}
            <span className="text-slate-300">{pd.itemCount ?? 0}</span>{" "}
            item{(pd.itemCount ?? 0) === 1 ? "" : "s"} ·{" "}
            <span className="text-slate-300">{pd.standardCount ?? 0}</span>{" "}
            standard{(pd.standardCount ?? 0) === 1 ? "" : "s"}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {savedAt && (
            <span className="text-[10px] text-slate-500">saved</span>
          )}
          <button
            onClick={commit}
            disabled={saving}
            className="px-3 py-1 bg-accent text-white rounded text-xs hover:brightness-110 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">
              Data type
            </span>
            <select
              value={dataType}
              onChange={(e) => setDataType(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:border-accent focus:outline-none"
            >
              <option value="text">text</option>
              <option value="numeric">numeric</option>
              <option value="boolean">boolean</option>
              <option value="enum">enum</option>
            </select>
          </label>
          <label className="block col-span-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">
              Unit
            </span>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="ohm, mm, V, …"
              className="mt-1 w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder:text-slate-600 focus:border-accent focus:outline-none"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            Description
          </span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="One-line description…"
            className="mt-1 w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder:text-slate-600 focus:border-accent focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            Search terms
          </span>
          <input
            value={searchTerms}
            onChange={(e) => setSearchTerms(e.target.value)}
            placeholder="alias, synonym, abbrev"
            className="mt-1 w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder:text-slate-600 focus:border-accent focus:outline-none"
          />
        </label>

        {dataType === "enum" && (
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">
              Enum values
            </span>
            <input
              value={enumValues}
              onChange={(e) => setEnumValues(e.target.value)}
              placeholder="val1, val2, val3"
              className="mt-1 w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder:text-slate-600 focus:border-accent focus:outline-none"
            />
          </label>
        )}

        {dataType === "numeric" && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">
                Min
              </span>
              <input
                value={minStr}
                onChange={(e) => setMinStr(e.target.value)}
                placeholder="(optional)"
                className="mt-1 w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder:text-slate-600 focus:border-accent focus:outline-none tabular-nums"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">
                Max
              </span>
              <input
                value={maxStr}
                onChange={(e) => setMaxStr(e.target.value)}
                placeholder="(optional)"
                className="mt-1 w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder:text-slate-600 focus:border-accent focus:outline-none tabular-nums"
              />
            </label>
          </div>
        )}
      </div>
    </>
  );
}

function ParameterUsagePanel({
  pd,
  usage,
  deleteExpanded,
  onDeleteExpand,
  onDeleteCancel,
  deleteConfirmText,
  onDeleteConfirmTextChange,
  onDelete,
}: {
  pd: ParameterDefinition;
  usage: ParamUsage | null;
  deleteExpanded: boolean;
  onDeleteExpand: () => void;
  onDeleteCancel: () => void;
  deleteConfirmText: string;
  onDeleteConfirmTextChange: (s: string) => void;
  onDelete: () => void;
}) {
  const confirmed = deleteConfirmText === pd.name;
  return (
    <aside className="w-80 shrink-0 border-l border-slate-700 bg-slate-800/20 overflow-y-auto flex flex-col">
      <div className="flex border-b border-slate-700 shrink-0">
        <button className="flex-1 px-3 py-2 text-xs font-medium text-accent border-b-2 border-accent -mb-px">
          Usage
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-5 text-xs">
          {!usage ? (
            <div className="text-slate-500 text-xs">Loading usage…</div>
          ) : (
            <>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
                  Aspects ({usage.aspects.length})
                </div>
                {usage.aspects.length === 0 ? (
                  <span className="text-slate-600 italic text-[11px]">
                    none
                  </span>
                ) : (
                  <ul className="space-y-0.5">
                    {usage.aspects.map((a) => (
                      <li
                        key={a.id}
                        className="text-slate-300 text-[11px] px-2 py-1 rounded bg-slate-900/40 border border-slate-700"
                      >
                        {a.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
                  Items ({usage.items.length})
                </div>
                {usage.items.length === 0 ? (
                  <span className="text-slate-600 italic text-[11px]">
                    none
                  </span>
                ) : (
                  <ul className="space-y-0.5 max-h-64 overflow-y-auto">
                    {usage.items.map((i) => (
                      <li key={i.id}>
                        <a
                          href={`/items?selected=${i.id}`}
                          className="block px-2 py-1 rounded bg-slate-900/40 border border-slate-700 text-[11px] text-slate-300 hover:text-accent hover:bg-slate-800 transition-colors truncate"
                        >
                          {i.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
                  Standards ({usage.standards.length})
                </div>
                {usage.standards.length === 0 ? (
                  <span className="text-slate-600 italic text-[11px]">
                    none
                  </span>
                ) : (
                  <ul className="space-y-0.5">
                    {usage.standards.map((s) => (
                      <li
                        key={s.id}
                        className="text-slate-300 text-[11px] px-2 py-1 rounded bg-slate-900/40 border border-slate-700"
                      >
                        {s.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-700 p-4 bg-slate-900/40">
        {!deleteExpanded ? (
          <button
            onClick={onDeleteExpand}
            className="w-full text-xs text-red-400 hover:text-red-300 border border-red-900/50 hover:border-red-700 rounded py-1.5 transition-colors"
          >
            Delete parameter…
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-400 leading-snug">
              {usage && (usage.aspects.length + usage.items.length + usage.standards.length) > 0 ? (
                <>
                  Used by{" "}
                  <span className="text-slate-100">
                    {usage.aspects.length} aspects
                  </span>
                  ,{" "}
                  <span className="text-slate-100">
                    {usage.items.length} items
                  </span>
                  ,{" "}
                  <span className="text-slate-100">
                    {usage.standards.length} standards
                  </span>
                  . All references will be removed.
                </>
              ) : (
                <>Not used anywhere.</>
              )}{" "}
              This cannot be undone.
            </p>
            <label className="block text-[11px] text-slate-400">
              Type{" "}
              <span className="font-mono text-slate-200 bg-slate-700 px-1.5 py-0.5 rounded">
                {pd.name}
              </span>{" "}
              to confirm:
            </label>
            <input
              value={deleteConfirmText}
              onChange={(e) => onDeleteConfirmTextChange(e.target.value)}
              placeholder={pd.name}
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
                Delete this parameter
              </button>
              <button
                onClick={onDeleteCancel}
                className="text-[11px] text-slate-500 hover:text-slate-300 px-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}


// --- Categories Tab ---

// --- Audit Tab ---

interface AuditSubject {
  id: string;
  name: string;
}
interface AuditCheckRow {
  check: string;
  severity: "info" | "warning" | "error";
  subjects: AuditSubject[];
  suggestion: string | null;
}

const AUDIT_LABELS: Record<string, string> = {
  "param.no_description": "Parameter: no description",
  "param.numeric_no_unit": "Parameter: numeric without unit",
  "param.enum_no_values": "Parameter: enum without values",
  "param.orphan": "Parameter: orphan (no aspect)",
  "param.name_collision_with_searchterm": "Parameter: search-term collides with another name",
  "param.duplicate_name_ignoring_separators": "Parameter: duplicate names (ignoring separators)",
  "param.near_duplicate": "Parameter: near-duplicate (same type + unit, similar name)",
  "param.value_outliers": "Parameter: value outlier (>10× median)",
  "param.enum_free_text_drift": "Parameter: text with few distinct values (enum candidate)",
  "aspect.empty": "Aspect: empty (no parameters)",
  "aspect.no_items": "Aspect: never applied to items",
  "aspect.duplicate_param_set": "Aspect: identical parameter sets",
  "aspect.subset_overlap": "Aspect: parameter set is subset of another",
  "aspect.name_similarity": "Aspect: similar name to another",
};

export function AuditTab() {
  const [checks, setChecks] = useState<AuditCheckRow[]>([]);
  const [runAt, setRunAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/taxonomy/audit");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Audit failed");
      setChecks(data.checks || []);
      setRunAt(data.runAt ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  const grouped: Record<"error" | "warning" | "info", AuditCheckRow[]> = {
    error: checks.filter((c) => c.severity === "error"),
    warning: checks.filter((c) => c.severity === "warning"),
    info: checks.filter((c) => c.severity === "info"),
  };
  const total = checks.reduce((n, c) => n + c.subjects.length, 0);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-medium text-slate-200">Taxonomy audit</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {runAt ? (
              <>run {timeAgo(runAt)} · {total} findings</>
            ) : loading ? (
              "running…"
            ) : (
              "never run"
            )}
          </p>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="text-xs text-accent hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "Running…" : "Re-run"}
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 bg-red-900/30 border border-red-700/50 rounded text-red-300 text-xs mb-4">
          {error}
        </div>
      )}

      {!loading && checks.length === 0 && !error && (
        <div className="text-slate-500 text-sm py-8 text-center">
          No issues detected. Taxonomy looks clean.
        </div>
      )}

      {(["error", "warning", "info"] as const).map((sev) => {
        const list = grouped[sev];
        if (list.length === 0) return null;
        const n = list.reduce((x, c) => x + c.subjects.length, 0);
        return (
          <section key={sev} className="mb-6">
            <h3
              className={`text-xs font-semibold uppercase tracking-wider mb-2 ${
                sev === "error"
                  ? "text-red-400"
                  : sev === "warning"
                    ? "text-amber-400"
                    : "text-slate-400"
              }`}
            >
              {sev}s ({n})
            </h3>
            <div className="space-y-2">
              {list.map((c) => (
                <AuditCheckCard key={c.check} check={c} severity={sev} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AuditCheckCard({
  check,
  severity,
}: {
  check: AuditCheckRow;
  severity: "info" | "warning" | "error";
}) {
  const [expanded, setExpanded] = useState(false);
  const borderColour =
    severity === "error"
      ? "border-red-800/60"
      : severity === "warning"
        ? "border-amber-800/60"
        : "border-slate-700";
  return (
    <div className={`border rounded ${borderColour} bg-slate-900/30`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-3 py-2 flex items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors"
      >
        <div>
          <div className="text-sm text-slate-200">
            {AUDIT_LABELS[check.check] ?? check.check}
          </div>
          {check.suggestion && (
            <div className="text-[11px] text-slate-500 mt-0.5">
              {check.suggestion}
            </div>
          )}
        </div>
        <span className="text-[10px] text-slate-500 tabular-nums shrink-0">
          {check.subjects.length} {expanded ? "▼" : "▶"}
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-2 pt-1 flex flex-wrap gap-1.5 border-t border-slate-800">
          {check.subjects.map((s) => (
            <span
              key={s.id}
              className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono"
              title={s.id}
            >
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.floor((now - then) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleString();
}

export function CategoriesTab() {
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

export function StandardsTab() {
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

  const selected = standards.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Breadcrumb bar (matches modules/inserts) */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-slate-700 bg-slate-800/30 text-xs text-slate-400 shrink-0">
        <span>Taxonomy</span>
        <span className="text-slate-600">/</span>
        <span className="text-slate-300">Standards</span>
        {selected && (
          <>
            <span className="text-slate-600">/</span>
            <span className="text-slate-100">{selected.name}</span>
            {selected.domainTag && (
              <span className="text-slate-500 ml-1">
                ({selected.domainTag})
              </span>
            )}
          </>
        )}
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* Left: list */}
      <div className="w-72 shrink-0 border-r border-slate-700 flex flex-col bg-slate-900/40">
        <div className="p-3 border-b border-slate-700 flex items-center justify-between">
          <span className="text-xs uppercase text-slate-500 tracking-wider font-medium">
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
      {/* Right: detail (center + info panel) */}
      <div className="flex-1 flex min-w-0 overflow-hidden">
        {selectedId ? (
          <StandardDetail
            key={selectedId}
            standardId={selectedId}
            onDelete={() => deleteStandard(selectedId)}
            onMutated={fetchStandards}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
            Select or create a standard.
          </div>
        )}
      </div>
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
  const [createFromDesignation, setCreateFromDesignation] = useState<{
    designationId: string;
    designation: string;
  } | null>(null);
  const [generateSetFrom, setGenerateSetFrom] = useState<{
    designationId: string;
    designation: string;
  } | null>(null);
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
              const num = parseSiValue(raw);
              if (num !== null) payload[p.parameterDefinitionId] = num;
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
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Prominent standard title bar (matches module/level header style) */}
        {meta && (
          <div className="px-6 py-4 border-b border-slate-700 shrink-0 space-y-1">
            <EditableText
              value={meta.name}
              onSave={(name) => updateMeta({ name })}
              className="text-lg font-semibold text-slate-100"
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

        <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl">

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
                    <td className="px-2 py-1 text-right whitespace-nowrap">
                      <button
                        onClick={() =>
                          setCreateFromDesignation({
                            designationId: d.id,
                            designation: d.designation,
                          })
                        }
                        className="text-accent hover:brightness-110 text-[10px] mr-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Create one item using this designation"
                      >
                        + item
                      </button>
                      <button
                        onClick={() =>
                          setGenerateSetFrom({
                            designationId: d.id,
                            designation: d.designation,
                          })
                        }
                        className="text-accent hover:brightness-110 text-[10px] mr-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Generate a set of items varying one parameter"
                      >
                        + set
                      </button>
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

      {createFromDesignation && meta && (
        <CreateFromDesignationDialog
          designationId={createFromDesignation.designationId}
          designation={createFromDesignation.designation}
          standardId={standardId}
          standardName={meta.name}
          onClose={() => setCreateFromDesignation(null)}
          onCreated={() => refreshAll()}
        />
      )}
      {generateSetFrom && meta && (
        <GenerateSetDialog
          designationId={generateSetFrom.designationId}
          designation={generateSetFrom.designation}
          standardId={standardId}
          standardName={meta.name}
          onClose={() => setGenerateSetFrom(null)}
          onCreated={() => refreshAll()}
        />
      )}
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

