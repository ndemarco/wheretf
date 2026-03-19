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

// --- Main Page ---

export default function TaxonomyPage() {
  const [tab, setTab] = useState<"aspects" | "parameters" | "categories">(
    "aspects"
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab header */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-slate-700">
        <h1 className="text-lg font-semibold text-slate-100 mr-4">Taxonomy</h1>
        {(["aspects", "parameters", "categories"] as const).map((t) => (
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
      {tab === "parameters" && <ParametersTab />}
      {tab === "categories" && <CategoriesTab />}
    </div>
  );
}

// --- Aspects Tab ---

function AspectsTab() {
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

  return (
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
            {availableParamDefs.length > 0 && (
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
                        <span className="text-sm text-slate-300">
                          {pd.name}
                        </span>
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
              </div>
            )}
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
              <tr
                key={pd.id}
                className="border-b border-slate-700/50 hover:bg-slate-800/30"
              >
                <td className="px-3 py-2 text-sm text-slate-200">{pd.name}</td>
                <td className="px-3 py-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                    {pd.dataType}
                  </span>
                </td>
                <td className="px-3 py-2 text-sm text-slate-400">
                  {pd.unit || "—"}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500 font-mono">
                  {pd.constraints
                    ? JSON.stringify(pd.constraints)
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => deleteParam(pd.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
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
