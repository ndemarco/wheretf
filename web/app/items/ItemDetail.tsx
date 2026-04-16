"use client";

import { useCallback, useEffect, useState } from "react";
import CreateFromDesignationDialog from "./CreateFromDesignationDialog";
import { parseSiValue } from "@/lib/siPrefix";

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
    description: string | null;
    parameters: {
      parameterDefinitionId: string;
      itemAspectId: string | null;
      value: unknown;
      parameterName: string;
      dataType: string;
      unit: string | null;
      constraints: unknown;
    }[];
  }[];
  standaloneParameters: {
    parameterDefinitionId: string;
    itemAspectId: null;
    value: unknown;
    parameterName: string;
    dataType: string;
    unit: string | null;
    constraints: unknown;
  }[];
  assignments: {
    assignmentType: string;
    locationId: string;
    locationPath: string;
  }[];
}

function CompletenessIndicator({
  filled,
  total,
}: {
  filled: number;
  total: number;
}) {
  const color =
    filled === total
      ? "text-green-500"
      : filled > 0
        ? "text-amber-500"
        : "text-slate-500";
  return (
    <span className={`text-xs ${color}`}>
      ({filled}/{total})
    </span>
  );
}

function ParamRow({
  parameterName,
  value,
  unit,
  parameterDefinitionId,
  dataType,
  itemId,
  onAddFilter,
  onRefresh,
}: {
  parameterName: string;
  value: unknown;
  unit: string | null;
  parameterDefinitionId: string;
  dataType: string;
  itemId: string;
  onAddFilter: (paramDefId: string, paramName: string, value: unknown) => void;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const displayValue =
    value === null || value === undefined ? null : String(value);

  const startEdit = () => {
    setEditValue(displayValue || "");
    setEditing(true);
  };

  const saveEdit = async () => {
    setEditing(false);
    let parsed: unknown = editValue;
    if (dataType === "numeric") {
      // parseSiValue handles plain numbers and SI prefixes ("4.7k" → 4700).
      parsed = editValue === "" ? null : parseSiValue(editValue);
      // If SI parse failed, fall back to Number so we don't silently drop input.
      if (parsed === null && editValue !== "") {
        const n = Number(editValue);
        parsed = Number.isFinite(n) ? n : null;
      }
    } else if (dataType === "boolean") {
      parsed = editValue === "true";
    }
    try {
      await fetch(`/api/items/${itemId}/parameters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parameterDefinitionId, value: parsed }),
      });
      onRefresh();
    } catch (err) {
      console.error("Failed to save parameter:", err);
    }
  };

  return (
    <div className="flex items-center justify-between py-1 group">
      <span className="text-slate-400 text-xs">{parameterName}</span>
      <div className="flex items-center gap-1.5">
        {editing ? (
          <input
            // text so users can type "4.7k"; numeric parsing happens on save.
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
              if (e.key === "Escape") setEditing(false);
            }}
            autoFocus
            className="w-24 px-1.5 py-0.5 bg-slate-900 border border-accent rounded text-xs text-slate-200 outline-none"
          />
        ) : (
          <span
            onClick={startEdit}
            className={`text-xs cursor-pointer hover:text-accent transition-colors ${
              displayValue ? "text-slate-200" : "text-slate-600 italic"
            }`}
          >
            {displayValue || "—"}
          </span>
        )}
        {unit && <span className="text-xs text-slate-500">{unit}</span>}
        {displayValue && (
          <button
            onClick={() => onAddFilter(parameterDefinitionId, parameterName, value)}
            className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-accent transition-all text-xs"
            title={`Filter by ${parameterName}: ${displayValue}`}
          >
            ⧫
          </button>
        )}
      </div>
    </div>
  );
}

function AppliedStandardRow({
  itemId,
  standard,
  onChanged,
}: {
  itemId: string;
  standard: {
    standardId: string;
    standardName: string;
    designationId: string | null;
    designation: string | null;
    isCustom: boolean;
  };
  onChanged: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<
    { id: string; designation: string }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [spawnDesignation, setSpawnDesignation] = useState<
    { id: string; label: string } | null
  >(null);

  useEffect(() => {
    if (!picking) return;
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const qs = new URLSearchParams({ limit: "20" });
        if (query.trim()) qs.set("q", query.trim());
        const res = await fetch(
          `/api/standards/${standard.standardId}/designations?${qs}`
        );
        const data = await res.json();
        setHits(data.designations ?? []);
      } finally {
        setSearching(false);
      }
    }, 150);
    return () => clearTimeout(handle);
  }, [picking, query, standard.standardId]);

  async function selectDesignation(id: string | null) {
    await fetch(`/api/items/${itemId}/standards`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ standardId: standard.standardId, designationId: id }),
    });
    setPicking(false);
    setQuery("");
    onChanged();
  }

  async function removeStandard() {
    await fetch(`/api/items/${itemId}/standards`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ standardId: standard.standardId }),
    });
    onChanged();
  }

  return (
    <div className="bg-slate-900/50 rounded border border-slate-700 px-3 py-1.5 text-xs group">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-slate-200 truncate">
          {standard.standardName}
        </span>
        <button
          onClick={removeStandard}
          className="text-red-400 hover:text-red-300 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
          title="Remove standard"
        >
          ×
        </button>
      </div>
      <div className="mt-1 flex items-center gap-2">
        {picking ? (
          <div className="flex-1">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => setTimeout(() => setPicking(false), 150)}
              placeholder="Type to search…"
              className="w-full px-2 py-1 bg-slate-900 border border-accent rounded text-xs text-slate-100 outline-none"
            />
            <div className="mt-1 max-h-36 overflow-y-auto border border-slate-700 rounded bg-slate-950/80">
              {searching && hits.length === 0 ? (
                <div className="px-2 py-1 text-slate-500 text-[10px]">
                  Searching…
                </div>
              ) : hits.length === 0 ? (
                <div className="px-2 py-1 text-slate-500 text-[10px]">
                  No matches
                </div>
              ) : (
                hits.map((h) => (
                  <div
                    key={h.id}
                    className="group flex items-stretch border-b border-slate-800 last:border-b-0"
                  >
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectDesignation(h.id)}
                      className={`flex-1 text-left px-2 py-1 text-[11px] hover:bg-slate-700/50 ${
                        h.id === standard.designationId
                          ? "text-accent"
                          : "text-slate-300"
                      }`}
                    >
                      {h.designation}
                    </button>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() =>
                        setSpawnDesignation({ id: h.id, label: h.designation })
                      }
                      title="Create a new item using this designation"
                      className="shrink-0 px-2 text-[10px] text-slate-600 hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      + new
                    </button>
                  </div>
                ))
              )}
              {standard.designationId && (
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectDesignation(null)}
                  className="w-full text-left px-2 py-1 text-[10px] text-slate-500 italic hover:bg-slate-700/50 border-t border-slate-700"
                >
                  Clear designation
                </button>
              )}
            </div>
          </div>
        ) : standard.designation ? (
          <button
            onClick={() => setPicking(true)}
            className="text-accent hover:brightness-110 font-mono"
          >
            {standard.designation}
          </button>
        ) : (
          <button
            onClick={() => setPicking(true)}
            className="text-slate-500 italic hover:text-slate-300"
          >
            Pick designation…
          </button>
        )}
        {standard.isCustom && (
          <span
            className="text-amber-400 text-[10px]"
            title="Values overridden"
          >
            custom
          </span>
        )}
      </div>

      {spawnDesignation && (
        <CreateFromDesignationDialog
          designationId={spawnDesignation.id}
          designation={spawnDesignation.label}
          standardId={standard.standardId}
          standardName={standard.standardName}
          onClose={() => setSpawnDesignation(null)}
        />
      )}
    </div>
  );
}

export default function ItemDetail({
  item,
  onAddFilter,
  onRefresh,
}: {
  item: RichItem | null;
  onAddFilter: (paramDefId: string, paramName: string, value: unknown) => void;
  onRefresh: () => void;
}) {
  const [collapsedAspects, setCollapsedAspects] = useState<Set<string>>(
    new Set()
  );
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState("");

  // Aspect picker
  const [showAspectPicker, setShowAspectPicker] = useState(false);
  const [allAspects, setAllAspects] = useState<{ id: string; name: string; description: string | null }[]>([]);

  // Category picker
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [allCategories, setAllCategories] = useState<{ id: string; name: string; icon: string | null; color: string | null }[]>([]);

  // Standards
  type AppliedStandard = {
    id: string;
    standardId: string;
    standardName: string;
    designationId: string | null;
    designation: string | null;
    isCustom: boolean;
  };
  const [appliedStandards, setAppliedStandards] = useState<AppliedStandard[]>(
    []
  );
  const [showStandardPicker, setShowStandardPicker] = useState(false);
  const [allStandards, setAllStandards] = useState<
    { id: string; name: string; domainTag: string | null }[]
  >([]);
  const [standardsLoading, setStandardsLoading] = useState(false);

  const fetchAllAspects = useCallback(async () => {
    try {
      const res = await fetch("/api/aspects");
      const data = await res.json();
      setAllAspects(data.aspects || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchAllCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      setAllCategories(data.categories || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchAllStandards = useCallback(async () => {
    try {
      const res = await fetch("/api/standards");
      const data = await res.json();
      setAllStandards(data.standards || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchAppliedStandards = useCallback(async (itemId: string) => {
    setStandardsLoading(true);
    try {
      const res = await fetch(`/api/items/${itemId}/standards`);
      const data = await res.json();
      setAppliedStandards(data.standards || data.itemStandards || []);
    } catch (err) {
      console.error(err);
    } finally {
      setStandardsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (item) fetchAppliedStandards(item.id);
    else setAppliedStandards([]);
  }, [item, fetchAppliedStandards]);

  if (!item) {
    return (
      <div className="w-80 bg-slate-800 border-l border-slate-700 shrink-0 flex items-center justify-center">
        <p className="text-slate-500 text-xs">Select an item to view details</p>
      </div>
    );
  }

  const toggleAspect = (aspectId: string) => {
    setCollapsedAspects((prev) => {
      const next = new Set(prev);
      if (next.has(aspectId)) {
        next.delete(aspectId);
      } else {
        next.add(aspectId);
      }
      return next;
    });
  };

  const saveName = async () => {
    setEditingName(false);
    if (nameValue === item.name) return;
    try {
      await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameValue }),
      });
      onRefresh();
    } catch (err) {
      console.error("Failed to update name:", err);
    }
  };

  const saveDesc = async () => {
    setEditingDesc(false);
    if (descValue === (item.description || "")) return;
    try {
      await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: descValue || null }),
      });
      onRefresh();
    } catch (err) {
      console.error("Failed to update description:", err);
    }
  };

  const deleteItem = async () => {
    try {
      await fetch(`/api/items/${item.id}`, { method: "DELETE" });
      onRefresh();
    } catch (err) {
      console.error("Failed to delete item:", err);
    }
  };

  const addAspect = async (aspectId: string) => {
    try {
      await fetch(`/api/items/${item.id}/aspects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aspectId }),
      });
      setShowAspectPicker(false);
      onRefresh();
    } catch (err) {
      console.error("Failed to add aspect:", err);
    }
  };

  const removeAspect = async (aspectId: string) => {
    try {
      await fetch(`/api/items/${item.id}/aspects`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aspectId }),
      });
      onRefresh();
    } catch (err) {
      console.error("Failed to remove aspect:", err);
    }
  };

  const addCategory = async (categoryId: string) => {
    try {
      await fetch(`/api/items/${item.id}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, isPrimary: item.categories.length === 0 }),
      });
      setShowCategoryPicker(false);
      onRefresh();
    } catch (err) {
      console.error("Failed to add category:", err);
    }
  };

  const removeCategory = async (categoryId: string) => {
    try {
      await fetch(`/api/items/${item.id}/categories`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId }),
      });
      onRefresh();
    } catch (err) {
      console.error("Failed to remove category:", err);
    }
  };

  const appliedAspectIds = new Set(item.aspects.map((a) => a.aspectId));
  const appliedCategoryIds = new Set(item.categories.map((c) => c.categoryId));
  const availableAspects = allAspects.filter((a) => !appliedAspectIds.has(a.id));
  const availableCategories = allCategories.filter((c) => !appliedCategoryIds.has(c.id));

  const primaryCat = item.categories.find((c) => c.isPrimary);

  return (
    <div className="w-80 bg-slate-800 border-l border-slate-700 shrink-0 overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div>
          {editingName ? (
            <input
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") setEditingName(false);
              }}
              autoFocus
              className="w-full px-2 py-1 bg-slate-900 border border-accent rounded text-base font-semibold text-slate-100 outline-none"
            />
          ) : (
            <h2
              onClick={() => {
                setNameValue(item.name);
                setEditingName(true);
              }}
              className="text-base font-semibold text-slate-100 cursor-pointer hover:text-accent transition-colors"
            >
              {item.name}
            </h2>
          )}

          {editingDesc ? (
            <input
              type="text"
              value={descValue}
              onChange={(e) => setDescValue(e.target.value)}
              onBlur={saveDesc}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveDesc();
                if (e.key === "Escape") setEditingDesc(false);
              }}
              autoFocus
              placeholder="Add description..."
              className="w-full mt-1 px-2 py-1 bg-slate-900 border border-accent rounded text-xs text-slate-300 outline-none"
            />
          ) : (
            <p
              onClick={() => {
                setDescValue(item.description || "");
                setEditingDesc(true);
              }}
              className={`text-xs mt-1 cursor-pointer hover:text-accent transition-colors ${
                item.description ? "text-slate-400" : "text-slate-600 italic"
              }`}
            >
              {item.description || "Add description..."}
            </p>
          )}
        </div>

        {/* Categories */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Categories
            </h3>
            <button
              onClick={() => {
                setShowCategoryPicker(!showCategoryPicker);
                if (!showCategoryPicker) fetchAllCategories();
              }}
              className="text-[10px] text-accent hover:brightness-110"
            >
              {showCategoryPicker ? "Done" : "+ Add"}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {item.categories.map((cat) => (
              <span
                key={cat.categoryId}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-900 border border-slate-600 rounded-full text-xs group"
              >
                {cat.icon && <span>{cat.icon}</span>}
                <span className={cat.isPrimary ? "text-accent" : "text-slate-300"}>
                  {cat.name}
                </span>
                {cat.isPrimary && (
                  <span className="text-accent text-[10px]">★</span>
                )}
                <button
                  onClick={() => removeCategory(cat.categoryId)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-[10px] ml-0.5 transition-opacity"
                >
                  ×
                </button>
              </span>
            ))}
            {item.categories.length === 0 && !showCategoryPicker && (
              <span className="text-xs text-slate-600 italic">None</span>
            )}
          </div>
          {showCategoryPicker && (
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {availableCategories.length === 0 ? (
                <p className="text-xs text-slate-500">No more categories available.</p>
              ) : (
                availableCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => addCategory(cat.id)}
                    className="w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-700/50 transition-colors"
                  >
                    {cat.icon && <span>{cat.icon}</span>}
                    <span className="text-xs text-slate-300">{cat.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Aspects */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Aspects
            </h3>
            <button
              onClick={() => {
                setShowAspectPicker(!showAspectPicker);
                if (!showAspectPicker) fetchAllAspects();
              }}
              className="text-[10px] text-accent hover:brightness-110"
            >
              {showAspectPicker ? "Done" : "+ Add"}
            </button>
          </div>
          {showAspectPicker && (
            <div className="mb-2 space-y-1 max-h-32 overflow-y-auto">
              {availableAspects.length === 0 ? (
                <p className="text-xs text-slate-500">No more aspects available.</p>
              ) : (
                availableAspects.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => addAspect(a.id)}
                    className="w-full text-left flex items-center justify-between px-2 py-1 rounded hover:bg-slate-700/50 transition-colors"
                  >
                    <div>
                      <span className="text-xs text-slate-300">{a.name}</span>
                      {a.description && (
                        <span className="text-[10px] text-slate-500 ml-2">
                          {a.description}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-accent">+ Add</span>
                  </button>
                ))
              )}
            </div>
          )}
          {item.aspects.length === 0 && !showAspectPicker && (
            <p className="text-xs text-slate-600 italic">No aspects applied.</p>
          )}
          <div className="space-y-1">
            {item.aspects.map((aspect) => {
              const isCollapsed = collapsedAspects.has(aspect.aspectId);
              const filled = aspect.parameters.filter(
                (p) => p.value !== null && p.value !== undefined
              ).length;
              const total = aspect.parameters.length;

              return (
                <div
                  key={aspect.itemAspectId}
                  className="bg-slate-900/50 rounded border border-slate-700"
                >
                  <div className="flex items-center justify-between px-3 py-1.5 text-xs">
                    <button
                      onClick={() => toggleAspect(aspect.aspectId)}
                      className="flex items-center gap-2"
                    >
                      <span className="text-slate-400 text-[10px]">
                        {isCollapsed ? "▶" : "▼"}
                      </span>
                      <span className="font-medium text-slate-200">
                        {aspect.name}
                      </span>
                      <CompletenessIndicator filled={filled} total={total} />
                    </button>
                    <button
                      onClick={() => removeAspect(aspect.aspectId)}
                      className="text-red-400 hover:text-red-300 text-[10px] opacity-0 hover:opacity-100 transition-opacity"
                      title="Remove aspect"
                    >
                      ×
                    </button>
                  </div>
                  {!isCollapsed && (
                    <div className="px-3 pb-2 border-t border-slate-700/50">
                      {aspect.parameters.map((param) => (
                        <ParamRow
                          key={param.parameterDefinitionId}
                          parameterName={param.parameterName}
                          value={param.value}
                          unit={param.unit}
                          parameterDefinitionId={param.parameterDefinitionId}
                          dataType={param.dataType}
                          itemId={item.id}
                          onAddFilter={onAddFilter}
                          onRefresh={onRefresh}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Standalone Parameters */}
        {item.standaloneParameters.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Other Parameters
            </h3>
            <div className="bg-slate-900/50 rounded border border-slate-700 px-3 py-1">
              {item.standaloneParameters.map((param) => (
                <ParamRow
                  key={param.parameterDefinitionId}
                  parameterName={param.parameterName}
                  value={param.value}
                  unit={param.unit}
                  parameterDefinitionId={param.parameterDefinitionId}
                  dataType={param.dataType}
                  itemId={item.id}
                  onAddFilter={onAddFilter}
                  onRefresh={onRefresh}
                />
              ))}
            </div>
          </div>
        )}

        {/* Standards */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Standards
            </h3>
            <button
              onClick={() => {
                setShowStandardPicker(!showStandardPicker);
                if (!showStandardPicker) fetchAllStandards();
              }}
              className="text-[10px] text-accent hover:brightness-110"
            >
              {showStandardPicker ? "Done" : "+ Add"}
            </button>
          </div>

          {showStandardPicker && (
            <div className="mb-2 space-y-1 max-h-40 overflow-y-auto">
              {allStandards
                .filter(
                  (s) =>
                    !appliedStandards.some((a) => a.standardId === s.id)
                )
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={async () => {
                      await fetch(`/api/items/${item.id}/standards`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ standardId: s.id }),
                      });
                      setShowStandardPicker(false);
                      fetchAppliedStandards(item.id);
                      onRefresh();
                    }}
                    className="w-full text-left flex items-center justify-between px-2 py-1 rounded hover:bg-slate-700/50 transition-colors"
                  >
                    <span className="text-xs text-slate-300">{s.name}</span>
                    {s.domainTag && (
                      <span className="text-[10px] text-slate-500">
                        {s.domainTag}
                      </span>
                    )}
                  </button>
                ))}
            </div>
          )}

          {standardsLoading && appliedStandards.length === 0 ? (
            <p className="text-xs text-slate-600 italic">Loading…</p>
          ) : appliedStandards.length === 0 && !showStandardPicker ? (
            <p className="text-xs text-slate-600 italic">None applied.</p>
          ) : (
            <div className="space-y-1">
              {appliedStandards.map((std) => (
                <AppliedStandardRow
                  key={std.id}
                  itemId={item.id}
                  standard={std}
                  onChanged={() => {
                    fetchAppliedStandards(item.id);
                    onRefresh();
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Locations */}
        {item.assignments.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Stored At
            </h3>
            <div className="space-y-1">
              {item.assignments.map((a, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <span className="text-accent hover:underline cursor-pointer">
                    {a.locationPath.replace(/:/g, " › ")}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      a.assignmentType === "placed"
                        ? "bg-green-900/40 text-green-400"
                        : "bg-amber-900/40 text-amber-400"
                    }`}
                  >
                    {a.assignmentType}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="pt-2 border-t border-slate-700">
          <button
            onClick={deleteItem}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Delete Item
          </button>
        </div>
      </div>
    </div>
  );
}
