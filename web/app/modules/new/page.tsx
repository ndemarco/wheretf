"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";

interface LevelConfig {
  label: string;
  type: "receptacle" | "fixed";
  notes: string;
  selected: boolean;
}

const DIMENSION_SUGGESTIONS = ["level", "drawer", "shelf", "row", "bay"];

export default function ModuleCreatePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Identity
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Step 2: Primary Dimension
  const [dimensionLabel, setDimensionLabel] = useState("");
  const [dimensionCount, setDimensionCount] = useState(1);

  // Step 3: Level Configuration
  const [levels, setLevels] = useState<LevelConfig[]>([]);

  // Generate levels when moving from step 2 to 3
  function goToStep3() {
    const count = Math.max(1, Math.min(dimensionCount, 50));
    const newLevels: LevelConfig[] = Array.from({ length: count }, (_, i) => ({
      label: String(i + 1),
      type: "receptacle",
      notes: "",
      selected: false,
    }));
    setLevels(newLevels);
    setStep(3);
  }

  function updateLevel(index: number, updates: Partial<LevelConfig>) {
    setLevels((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...updates } : l))
    );
  }

  function toggleSelect(index: number) {
    setLevels((prev) =>
      prev.map((l, i) =>
        i === index ? { ...l, selected: !l.selected } : l
      )
    );
  }

  function toggleSelectAll() {
    const allSelected = levels.every((l) => l.selected);
    setLevels((prev) => prev.map((l) => ({ ...l, selected: !allSelected })));
  }

  const selectedCount = useMemo(
    () => levels.filter((l) => l.selected).length,
    [levels]
  );

  function batchSetType(type: "receptacle" | "fixed") {
    setLevels((prev) =>
      prev.map((l) => (l.selected ? { ...l, type } : l))
    );
  }

  const canProceedStep1 = name.trim().length > 0;
  const canProceedStep2 =
    dimensionLabel.trim().length > 0 && dimensionCount >= 1;

  async function handleCreate() {
    setSaving(true);
    setError(null);

    try {
      // Create module
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

      // Create level locations
      for (const level of levels) {
        await fetch("/api/locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            moduleId,
            label: level.label,
            pathSegments: [moduleName, level.label],
            locationType: level.type,
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
    <div className="flex-1 flex flex-col min-w-0 p-6 max-w-2xl">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                s === step
                  ? "bg-accent text-white"
                  : s < step
                    ? "bg-accent/20 text-accent"
                    : "bg-slate-700 text-slate-500"
              }`}
            >
              {s}
            </div>
            {s < 4 && (
              <div
                className={`w-8 h-px ${
                  s < step ? "bg-accent/40" : "bg-slate-700"
                }`}
              />
            )}
          </div>
        ))}
        <span className="text-xs text-slate-500 ml-3">
          {step === 1 && "Identity"}
          {step === 2 && "Primary Dimension"}
          {step === 3 && "Level Configuration"}
          {step === 4 && "Review & Create"}
        </span>
      </div>

      {error && (
        <div className="px-3 py-2 bg-red-900/30 border border-red-700/50 rounded text-red-300 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Step 1: Identity */}
      {step === 1 && (
        <div className="flex flex-col gap-5">
          <h1 className="text-xl font-semibold text-slate-100">New Module</h1>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider">
              Name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g., "MUSE", "ALEX"'
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 placeholder:text-slate-600 focus:border-accent focus:outline-none"
              autoFocus
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider">
              Description
            </span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this module physically is"
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 placeholder:text-slate-600 focus:border-accent focus:outline-none"
            />
          </label>

          <div className="flex gap-3 mt-2">
            <button
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
              className="px-5 py-2 bg-accent text-white rounded-md hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
            <button
              onClick={() => router.push("/modules")}
              className="px-5 py-2 bg-slate-700 text-slate-300 rounded-md hover:bg-slate-600 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Primary Dimension */}
      {step === 2 && (
        <div className="flex flex-col gap-5">
          <h1 className="text-xl font-semibold text-slate-100">
            Primary Dimension
          </h1>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider">
              Dimension Label
            </span>
            <input
              type="text"
              value={dimensionLabel}
              onChange={(e) => setDimensionLabel(e.target.value)}
              placeholder="e.g., level, drawer, shelf"
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 placeholder:text-slate-600 focus:border-accent focus:outline-none"
              autoFocus
            />
            <div className="flex gap-2 mt-1">
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

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider">
              Count
            </span>
            <input
              type="number"
              min={1}
              max={50}
              value={dimensionCount}
              onChange={(e) =>
                setDimensionCount(Math.max(1, Number(e.target.value) || 1))
              }
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 focus:border-accent focus:outline-none tabular-nums w-24"
            />
          </label>

          {/* Stack preview */}
          {dimensionCount > 0 && (
            <div className="flex flex-col gap-1 mt-2">
              <span className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                Preview
              </span>
              <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                {Array.from({ length: Math.min(dimensionCount, 50) }, (_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded text-sm"
                  >
                    <span className="text-slate-500 text-xs w-6 text-right tabular-nums">
                      {i + 1}
                    </span>
                    <span className="text-slate-300">
                      {dimensionLabel || "unit"} {i + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-2">
            <button
              onClick={() => setStep(1)}
              className="px-5 py-2 bg-slate-700 text-slate-300 rounded-md hover:bg-slate-600 transition-all"
            >
              Back
            </button>
            <button
              onClick={goToStep3}
              disabled={!canProceedStep2}
              className="px-5 py-2 bg-accent text-white rounded-md hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Level Configuration */}
      {step === 3 && (
        <div className="flex flex-col gap-4">
          <h1 className="text-xl font-semibold text-slate-100">
            Configure{" "}
            {dimensionLabel.charAt(0).toUpperCase() + dimensionLabel.slice(1)}s
          </h1>

          {/* Batch actions */}
          {selectedCount > 0 && (
            <div className="flex items-center gap-3 px-3 py-2 bg-slate-800 border border-slate-700 rounded">
              <span className="text-xs text-slate-400">
                {selectedCount} selected
              </span>
              <button
                onClick={() => batchSetType("receptacle")}
                className="text-xs px-2 py-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
              >
                Set Receptacle
              </button>
              <button
                onClick={() => batchSetType("fixed")}
                className="text-xs px-2 py-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
              >
                Set Fixed
              </button>
            </div>
          )}

          <div className="overflow-auto rounded-lg border border-slate-700">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/50">
                  <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={levels.length > 0 && levels.every((l) => l.selected)}
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
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {levels.map((level, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-700/50 hover:bg-slate-800/30"
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={level.selected}
                        onChange={() => toggleSelect(i)}
                        className="accent-accent"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={level.label}
                        onChange={(e) =>
                          updateLevel(i, { label: e.target.value })
                        }
                        className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm focus:border-accent focus:outline-none w-20"
                      />
                    </td>
                    <td className="px-3 py-2">
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
                    <td className="px-3 py-2">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 mt-2">
            <button
              onClick={() => setStep(2)}
              className="px-5 py-2 bg-slate-700 text-slate-300 rounded-md hover:bg-slate-600 transition-all"
            >
              Back
            </button>
            <button
              onClick={() => setStep(4)}
              className="px-5 py-2 bg-accent text-white rounded-md hover:brightness-110 transition-all"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review & Create */}
      {step === 4 && (
        <div className="flex flex-col gap-5">
          <h1 className="text-xl font-semibold text-slate-100">
            Review & Create
          </h1>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex flex-col gap-3">
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wider">
                Module
              </span>
              <p className="text-slate-100 font-medium">{name}</p>
              {description && (
                <p className="text-sm text-slate-400">{description}</p>
              )}
            </div>

            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wider">
                Primary Dimension
              </span>
              <p className="text-slate-200">
                {levels.length}{" "}
                {levels.length === 1
                  ? dimensionLabel
                  : dimensionLabel + "s"}
              </p>
            </div>

            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1">
                Levels
              </span>
              <div className="overflow-auto rounded border border-slate-700 max-h-48">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-800/50">
                      <th className="px-3 py-1.5 text-xs text-slate-400">
                        Label
                      </th>
                      <th className="px-3 py-1.5 text-xs text-slate-400">
                        Type
                      </th>
                      <th className="px-3 py-1.5 text-xs text-slate-400">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {levels.map((level, i) => (
                      <tr
                        key={i}
                        className="border-b border-slate-700/30"
                      >
                        <td className="px-3 py-1 text-slate-200">
                          {level.label}
                        </td>
                        <td className="px-3 py-1 text-slate-400">
                          {level.type}
                        </td>
                        <td className="px-3 py-1 text-slate-500">
                          {level.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-2">
            <button
              onClick={() => setStep(3)}
              className="px-5 py-2 bg-slate-700 text-slate-300 rounded-md hover:bg-slate-600 transition-all"
            >
              Back
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="px-5 py-2 bg-accent text-white rounded-md hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Creating..." : "Create Module"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
