"use client";

import { useState } from "react";

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
      parsed = editValue === "" ? null : Number(editValue);
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
            type={dataType === "numeric" ? "number" : "text"}
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
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Categories
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {item.categories.map((cat) => (
              <span
                key={cat.categoryId}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-900 border border-slate-600 rounded-full text-xs"
              >
                {cat.icon && <span>{cat.icon}</span>}
                <span className={cat.isPrimary ? "text-accent" : "text-slate-300"}>
                  {cat.name}
                </span>
                {cat.isPrimary && (
                  <span className="text-accent text-[10px]">★</span>
                )}
              </span>
            ))}
            {item.categories.length === 0 && (
              <span className="text-xs text-slate-600 italic">None</span>
            )}
          </div>
        </div>

        {/* Aspects */}
        {item.aspects.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Aspects
            </h3>
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
                    <button
                      onClick={() => toggleAspect(aspect.aspectId)}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-slate-400 text-[10px]">
                          {isCollapsed ? "▶" : "▼"}
                        </span>
                        <span className="font-medium text-slate-200">
                          {aspect.name}
                        </span>
                        <CompletenessIndicator filled={filled} total={total} />
                      </span>
                    </button>
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
        )}

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
