"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

interface LevelConfig {
  label: string;
  type: "receptacle" | "fixed";
  /** interface_types.id (UUID) — empty string = no interface set. */
  interfaceTypeId: string;
  notes: string;
  selected: boolean;
}

const DIMENSION_SUGGESTIONS = ["level", "drawer", "shelf", "row", "bay"];

export default function NewModulePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dimensionLabel, setDimensionLabel] = useState("level");
  const [defaultIface, setDefaultIface] = useState("");
  const [levels, setLevels] = useState<LevelConfig[]>([
    {
      label: "1",
      type: "receptacle",
      interfaceTypeId: "",
      notes: "",
      selected: false,
    },
  ]);

  const [interfaceOptions, setInterfaceOptions] = useState<
    Array<{ id: string; identifier: string; description: string | null }>
  >([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/interface-types?status=active");
        const d = await r.json();
        setInterfaceOptions(d.interfaceTypes ?? []);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  // When the default interface changes, propagate it to receptacle rows
  // that still hold the old default (don't overwrite user-set values).
  useEffect(() => {
    setLevels((prev) =>
      prev.map((l) =>
        l.type === "receptacle" && l.interfaceTypeId === ""
          ? { ...l, interfaceTypeId: defaultIface }
          : l
      )
    );
  }, [defaultIface]);

  function addLevel() {
    setLevels((p) => [
      ...p,
      {
        label: String(p.length + 1),
        type: "receptacle",
        interfaceTypeId: defaultIface,
        notes: "",
        selected: false,
      },
    ]);
  }
  function removeLevel(i: number) {
    setLevels((p) => p.filter((_, k) => k !== i));
  }

  function updateLevel(i: number, updates: Partial<LevelConfig>) {
    setLevels((p) => p.map((l, k) => (k === i ? { ...l, ...updates } : l)));
  }
  function toggleSelect(i: number) {
    setLevels((p) =>
      p.map((l, k) => (k === i ? { ...l, selected: !l.selected } : l))
    );
  }
  function toggleSelectAll() {
    const all = levels.every((l) => l.selected);
    setLevels((p) => p.map((l) => ({ ...l, selected: !all })));
  }
  const selectedCount = useMemo(
    () => levels.filter((l) => l.selected).length,
    [levels]
  );
  function batchType(type: "receptacle" | "fixed") {
    setLevels((p) => p.map((l) => (l.selected ? { ...l, type } : l)));
  }
  function batchIface(ifaceId: string) {
    setLevels((p) =>
      p.map((l) =>
        l.selected ? { ...l, interfaceTypeId: ifaceId } : l
      )
    );
  }

  const canSubmit =
    name.trim().length > 0 &&
    dimensionLabel.trim().length > 0 &&
    levels.length > 0;

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const modRes = await fetch("/api/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          primaryDimensionLabel: dimensionLabel.trim(),
          primaryDimensionCount: levels.length,
        }),
      });
      const modData = await modRes.json();
      if (!modRes.ok) throw new Error(modData.error || "Failed to create module");
      const moduleId = modData.module.id;
      const moduleName = modData.module.name;

      for (const level of levels) {
        await fetch("/api/locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            moduleId,
            label: level.label,
            pathSegments: [moduleName, level.label],
            locationType: level.type,
            interfacesAcceptedIds:
              level.type === "receptacle" && level.interfaceTypeId
                ? [level.interfaceTypeId]
                : undefined,
            metadata: level.notes ? { notes: level.notes } : undefined,
          }),
        });
      }

      router.push(`/modules/${moduleId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <div className="max-w-3xl w-full mx-auto p-6 flex flex-col gap-6">
        <h1 className="text-xl font-semibold text-slate-100">New module</h1>

        {error && (
          <div className="px-3 py-2 bg-red-900/30 border border-red-700/50 rounded text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Identity */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider">
              Name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g., "MUSE"'
              autoFocus
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 placeholder:text-slate-600 focus:border-accent focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider">
              Description (optional)
            </span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Physical location, notes"
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 placeholder:text-slate-600 focus:border-accent focus:outline-none"
            />
          </label>
        </div>

        {/* Primary dimension */}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400 uppercase tracking-wider">
            Primary dimension label
          </span>
          <input
            type="text"
            value={dimensionLabel}
            onChange={(e) => setDimensionLabel(e.target.value)}
            placeholder="level / drawer / shelf / row / bay"
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 placeholder:text-slate-600 focus:border-accent focus:outline-none"
          />
          <div className="flex gap-2 mt-1 flex-wrap">
            {DIMENSION_SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setDimensionLabel(s)}
                className={`text-xs px-2 py-0.5 rounded transition-colors ${
                  dimensionLabel === s
                    ? "bg-accent/20 text-accent"
                    : "bg-slate-700 text-slate-400 hover:text-slate-200"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </label>

        {/* Default interface (applied to new receptacle rows) */}
        <label className="flex flex-col gap-1 max-w-xs">
          <span className="text-xs text-slate-400 uppercase tracking-wider">
            Default interface for receptacles
          </span>
          <select
            value={defaultIface}
            onChange={(e) => setDefaultIface(e.target.value)}
            className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 focus:border-accent focus:outline-none"
          >
            <option value="">— none —</option>
            {interfaceOptions.map((i) => (
              <option key={i.id} value={i.id}>
                {i.identifier}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-slate-500">
            Applied to new receptacle rows. Individual rows can be changed
            below.
          </span>
        </label>

        {/* Levels table */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-200">Levels</h2>
            {selectedCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  {selectedCount} selected
                </span>
                <button
                  onClick={() => batchType("receptacle")}
                  className="text-xs px-2 py-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
                >
                  Receptacle
                </button>
                <button
                  onClick={() => batchType("fixed")}
                  className="text-xs px-2 py-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
                >
                  Fixed
                </button>
                <select
                  onChange={(e) => {
                    batchIface(e.target.value);
                    e.target.value = "";
                  }}
                  defaultValue=""
                  className="text-xs px-2 py-1 bg-slate-700 text-slate-300 rounded"
                >
                  <option value="" disabled>
                    Set interface…
                  </option>
                  <option value="">— none —</option>
                  {interfaceOptions.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.identifier}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="overflow-auto rounded border border-slate-700">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/50">
                  <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={
                        levels.length > 0 && levels.every((l) => l.selected)
                      }
                      onChange={toggleSelectAll}
                      className="accent-accent"
                    />
                  </th>
                  <th className="px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Label
                  </th>
                  <th className="px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Interface
                  </th>
                  <th className="px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="px-2 py-2 w-8" aria-label="remove" />
                </tr>
              </thead>
              <tbody>
                {levels.map((level, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-700/50 hover:bg-slate-800/30"
                  >
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={level.selected}
                        onChange={() => toggleSelect(i)}
                        className="accent-accent"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        value={level.label}
                        onChange={(e) =>
                          updateLevel(i, { label: e.target.value })
                        }
                        className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm focus:border-accent focus:outline-none w-20"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={level.type}
                        onChange={(e) =>
                          updateLevel(i, {
                            type: e.target.value as "receptacle" | "fixed",
                          })
                        }
                        className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm focus:border-accent focus:outline-none"
                      >
                        <option value="receptacle">Receptacle</option>
                        <option value="fixed">Fixed</option>
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      {level.type === "receptacle" ? (
                        <select
                          value={level.interfaceTypeId}
                          onChange={(e) =>
                            updateLevel(i, {
                              interfaceTypeId: e.target.value,
                            })
                          }
                          className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm focus:border-accent focus:outline-none w-36"
                        >
                          <option value="">— none —</option>
                          {interfaceOptions.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.identifier}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        value={level.notes}
                        onChange={(e) =>
                          updateLevel(i, { notes: e.target.value })
                        }
                        placeholder="Optional"
                        className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm placeholder:text-slate-600 focus:border-accent focus:outline-none w-full"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        onClick={() => removeLevel(i)}
                        disabled={levels.length <= 1}
                        title={
                          levels.length <= 1
                            ? "A module needs at least one level"
                            : "Remove this level"
                        }
                        className="w-6 h-6 rounded text-slate-400 hover:text-red-400 hover:bg-red-900/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label="Remove level"
                      >
                        −
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={addLevel}
            className="self-start px-3 py-1.5 border border-dashed border-slate-600 text-slate-400 rounded text-xs hover:border-slate-500 hover:text-slate-200 transition-colors"
          >
            + Add {dimensionLabel || "level"}
          </button>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/modules"
            className="px-5 py-2 border border-slate-600 text-slate-300 rounded-md hover:bg-slate-700/50 transition-colors text-sm"
          >
            Cancel
          </Link>
          <button
            onClick={handleCreate}
            disabled={!canSubmit || saving}
            className="px-5 py-2 bg-accent text-white rounded-md hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {saving ? "Creating…" : "Create module"}
          </button>
        </div>
      </div>
    </div>
  );
}
