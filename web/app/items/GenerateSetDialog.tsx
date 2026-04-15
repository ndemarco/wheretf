"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface GenerateSetDialogProps {
  designationId: string;
  designation: string;
  standardId: string;
  standardName: string;
  onClose: () => void;
  onCreated?: (itemIds: string[]) => void;
}

interface AspectLink {
  aspectId: string;
  aspectName: string;
}

interface CategorySuggestion {
  categoryId: string;
  name: string;
  icon: string | null;
  color: string | null;
  matched: number;
  total: number;
  score: number;
}

interface CategoryRow {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

interface ParameterOption {
  parameterDefinitionId: string;
  name: string;
  dataType: string;
  unit: string | null;
  constraints: { enumValues?: string[] } | null;
}

type RangeMode = "numeric" | "enum" | "list";

interface PreviewRow {
  included: boolean;
  value: string | number | boolean;
  display: string;
  name: string;
  duplicateOf?: string; // existing item name
}

interface SimilarCandidate {
  itemId: string;
  itemName: string;
  paramValues: Record<string, unknown>;
}

export default function GenerateSetDialog({
  designationId,
  designation,
  standardId,
  standardName,
  onClose,
  onCreated,
}: GenerateSetDialogProps) {
  const router = useRouter();
  const [linkedAspects, setLinkedAspects] = useState<AspectLink[]>([]);
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [allCategories, setAllCategories] = useState<CategoryRow[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );

  const [paramOptions, setParamOptions] = useState<ParameterOption[]>([]);
  const [variableParamId, setVariableParamId] = useState<string | null>(null);

  const [rangeMode, setRangeMode] = useState<RangeMode>("numeric");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [rangeStep, setRangeStep] = useState("1");
  const [enumChecked, setEnumChecked] = useState<Record<string, boolean>>({});
  const [listText, setListText] = useState("");

  const [nameTemplate, setNameTemplate] = useState("");
  const [preview, setPreview] = useState<PreviewRow[]>([]);

  const [similar, setSimilar] = useState<SimilarCandidate[]>([]);
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [failedRows, setFailedRows] = useState<number[]>([]);

  // Load aspects, parameters, categories, suggestions
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [stdRes, catsRes] = await Promise.all([
          fetch(`/api/standards/${standardId}`),
          fetch("/api/categories"),
        ]);
        const std = await stdRes.json();
        const cats = await catsRes.json();
        if (cancelled) return;

        const aspects: AspectLink[] = (std.aspects ?? []).map(
          (a: { aspectId: string; aspectName: string }) => ({
            aspectId: a.aspectId,
            aspectName: a.aspectName,
          })
        );
        setLinkedAspects(aspects);
        setAllCategories(cats.categories ?? []);

        const sugParams = new URLSearchParams();
        sugParams.set("standardId", standardId);
        for (const a of aspects) sugParams.append("aspectId", a.aspectId);
        const [sugRes, simRes] = await Promise.all([
          fetch(`/api/items/suggest-categories?${sugParams.toString()}`),
          fetch(
            `/api/items/find-similar?standardId=${standardId}&designationId=${designationId}`
          ),
        ]);
        const sug = await sugRes.json();
        const sim = await simRes.json();
        if (cancelled) return;
        setSuggestions(sug.suggestions ?? []);
        setSimilar(sim.candidates ?? []);

        // Aggregate all params across linked aspects
        const paramsList: ParameterOption[] = [];
        const seen = new Set<string>();
        for (const a of aspects) {
          const r = await fetch(`/api/aspects/${a.aspectId}/parameters`);
          const d = await r.json();
          for (const p of d.parameters ?? []) {
            if (seen.has(p.parameterDefinitionId)) continue;
            seen.add(p.parameterDefinitionId);
            paramsList.push({
              parameterDefinitionId: p.parameterDefinitionId,
              name: p.parameterName,
              dataType: p.dataType,
              unit: p.unit,
              constraints: p.constraints ?? null,
            });
          }
        }
        if (cancelled) return;
        setParamOptions(paramsList);
        // Pick first param of type numeric as default variable if available
        const numericFirst = paramsList.find((p) => p.dataType === "numeric");
        if (numericFirst)
          setVariableParamId(numericFirst.parameterDefinitionId);
        else if (paramsList.length > 0)
          setVariableParamId(paramsList[0].parameterDefinitionId);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Load failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [standardId]);

  const variableParam = useMemo(
    () =>
      paramOptions.find((p) => p.parameterDefinitionId === variableParamId) ??
      null,
    [paramOptions, variableParamId]
  );

  // When variable param changes, re-pick a reasonable range mode
  useEffect(() => {
    if (!variableParam) return;
    if (variableParam.dataType === "enum") setRangeMode("enum");
    else if (variableParam.dataType === "numeric") setRangeMode("numeric");
    else setRangeMode("list");
    setEnumChecked({});
    setListText("");
  }, [variableParam]);

  // Default name template
  useEffect(() => {
    if (nameTemplate) return;
    const cat =
      allCategories.find((c) => c.id === selectedCategoryId)?.name ??
      suggestions.find((s) => s.categoryId === selectedCategoryId)?.name ??
      "";
    const varPart = "{var}";
    const unit = variableParam?.unit ? "{unit}" : "";
    const tpl = `${designation}${cat ? " " + cat : ""} ${varPart}${unit}`.trim();
    setNameTemplate(tpl);
  }, [
    designation,
    selectedCategoryId,
    variableParam,
    allCategories,
    suggestions,
    nameTemplate,
  ]);

  const buildValues = useCallback((): Array<string | number | boolean> => {
    if (!variableParam) return [];
    if (rangeMode === "numeric") {
      const from = Number(rangeFrom);
      const to = Number(rangeTo);
      const step = Number(rangeStep) || 1;
      if (!Number.isFinite(from) || !Number.isFinite(to)) return [];
      const out: number[] = [];
      if (step === 0) return [];
      if (from <= to && step > 0) {
        for (let v = from; v <= to + 1e-9; v += step) {
          out.push(Number(v.toFixed(6)));
          if (out.length > 500) break;
        }
      } else if (from >= to && step < 0) {
        for (let v = from; v >= to - 1e-9; v += step) {
          out.push(Number(v.toFixed(6)));
          if (out.length > 500) break;
        }
      }
      return out;
    }
    if (rangeMode === "enum") {
      return Object.entries(enumChecked)
        .filter(([, v]) => v)
        .map(([k]) => k);
    }
    if (rangeMode === "list") {
      return listText
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          if (variableParam.dataType === "numeric") {
            const n = Number(s);
            return Number.isFinite(n) ? n : s;
          }
          if (variableParam.dataType === "boolean") return s === "true";
          return s;
        });
    }
    return [];
  }, [rangeMode, rangeFrom, rangeTo, rangeStep, enumChecked, listText, variableParam]);

  // Rebuild preview whenever inputs change
  useEffect(() => {
    const values = buildValues();
    setPreview(
      values.map((v) => {
        const dup = variableParam
          ? similar.find((s) => {
              const existing = s.paramValues[variableParam.parameterDefinitionId];
              return existing !== undefined && String(existing) === String(v);
            })
          : undefined;
        return {
          included: !dup,
          value: v,
          display:
            typeof v === "number" && !Number.isInteger(v)
              ? v.toString()
              : String(v),
          name: substituteTemplate(nameTemplate, v, variableParam?.unit ?? ""),
          duplicateOf: dup?.itemName,
        };
      })
    );
  }, [buildValues, nameTemplate, variableParam, similar]);

  function substituteTemplate(
    tpl: string,
    v: string | number | boolean,
    unit: string
  ) {
    return tpl
      .replace(/\{var\}/g, String(v))
      .replace(/\{unit\}/g, unit)
      .trim();
  }

  function togglePreview(i: number) {
    setPreview((prev) => prev.map((r, idx) => (idx === i ? { ...r, included: !r.included } : r)));
  }

  async function runCreate() {
    const rows = preview
      .map((r, i) => ({ r, i }))
      .filter((x) => x.r.included);
    if (rows.length === 0 || !variableParam) return;
    setCreating(true);
    setError(null);
    setFailedRows([]);
    setProgress({ done: 0, total: rows.length });

    const newIds: string[] = [];
    const failed: number[] = [];

    for (const { r, i } of rows) {
      try {
        const createRes = await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: r.name }),
        });
        const cData = await createRes.json();
        if (!createRes.ok)
          throw new Error(cData.error || "create failed");
        const itemId = cData.item.id;

        await fetch(`/api/items/${itemId}/standards`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ standardId, designationId }),
        });
        await Promise.all(
          linkedAspects.map((a) =>
            fetch(`/api/items/${itemId}/aspects`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ aspectId: a.aspectId }),
            })
          )
        );
        if (selectedCategoryId) {
          await fetch(`/api/items/${itemId}/categories`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              categoryId: selectedCategoryId,
              isPrimary: true,
            }),
          });
        }
        // Override variable parameter on the item
        await fetch(`/api/items/${itemId}/parameters`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parameterDefinitionId: variableParam.parameterDefinitionId,
            value: r.value,
          }),
        });
        newIds.push(itemId);
      } catch (err) {
        console.error(err);
        failed.push(i);
      } finally {
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    }

    setCreating(false);
    setFailedRows(failed);
    if (newIds.length > 0) {
      onCreated?.(newIds);
    }
    if (failed.length === 0) {
      onClose();
      router.push("/items");
    } else {
      setError(
        `${failed.length} row(s) failed. The failed rows stay checked; resolve and retry.`
      );
    }
  }

  const suggestedIds = new Set(suggestions.map((s) => s.categoryId));
  const remainingCategories = allCategories.filter(
    (c) => !suggestedIds.has(c.id)
  );
  const includedCount = preview.filter((r) => r.included).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 shrink-0">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">
            Generate a set of items
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-base font-semibold text-slate-100">
              {standardName}
            </span>
            <span className="text-slate-500">·</span>
            <span className="font-mono text-accent">{designation}</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-900/30 border border-red-700/50 rounded text-red-300 text-xs">
              {error}
            </div>
          )}

          {/* Aspects (informational) */}
          {linkedAspects.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">
                Applied to each item
              </div>
              <div className="flex flex-wrap gap-1.5">
                {linkedAspects.map((a) => (
                  <span
                    key={a.aspectId}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded-full text-[11px] text-slate-300"
                  >
                    {a.aspectName}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Category */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">
              Category
            </div>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => {
                const isSel = selectedCategoryId === s.categoryId;
                return (
                  <button
                    key={s.categoryId}
                    onClick={() =>
                      setSelectedCategoryId(isSel ? null : s.categoryId)
                    }
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      isSel
                        ? "bg-accent/20 border-accent text-accent"
                        : "bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500"
                    }`}
                  >
                    {s.icon && <span>{s.icon}</span>}
                    <span>{s.name}</span>
                    <span className="text-[10px] text-slate-500 tabular-nums">
                      {Math.round(s.score * 100)}%
                    </span>
                  </button>
                );
              })}
              <button
                onClick={() => setShowAll((v) => !v)}
                className="text-[11px] text-slate-500 hover:text-slate-300 px-2"
              >
                {showAll ? "Hide all" : "Show all…"}
              </button>
            </div>
            {showAll && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {remainingCategories.map((c) => {
                  const isSel = selectedCategoryId === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() =>
                        setSelectedCategoryId(isSel ? null : c.id)
                      }
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        isSel
                          ? "bg-accent/20 border-accent text-accent"
                          : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      {c.icon && <span>{c.icon}</span>}
                      <span>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Variable parameter */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">
              Varying parameter
            </div>
            <select
              value={variableParamId ?? ""}
              onChange={(e) => setVariableParamId(e.target.value || null)}
              className="w-full max-w-sm px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 focus:border-accent focus:outline-none"
            >
              <option value="" disabled>
                Select a parameter…
              </option>
              {paramOptions.map((p) => (
                <option key={p.parameterDefinitionId} value={p.parameterDefinitionId}>
                  {p.name}
                  {p.unit ? ` (${p.unit})` : ""} · {p.dataType}
                </option>
              ))}
            </select>
            {paramOptions.length === 0 && (
              <p className="text-[11px] text-amber-400 mt-1">
                No parameters on linked aspects. Link aspects + parameters
                first.
              </p>
            )}
          </div>

          {/* Range input */}
          {variableParam && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">
                Values
              </div>
              <div className="flex gap-3 mb-2">
                {(["numeric", "enum", "list"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setRangeMode(m)}
                    disabled={m === "enum" && variableParam.dataType !== "enum"}
                    className={`text-[11px] px-2 py-0.5 rounded ${
                      rangeMode === m
                        ? "bg-accent/20 text-accent"
                        : "text-slate-400 hover:text-slate-200"
                    } disabled:opacity-30 disabled:cursor-not-allowed`}
                  >
                    {m === "numeric"
                      ? "Range"
                      : m === "enum"
                        ? "Enum"
                        : "List"}
                  </button>
                ))}
              </div>
              {rangeMode === "numeric" && (
                <div className="flex items-center gap-2 text-xs">
                  <label className="flex items-center gap-1">
                    <span className="text-slate-500">from</span>
                    <input
                      value={rangeFrom}
                      onChange={(e) => setRangeFrom(e.target.value)}
                      placeholder="4"
                      className="w-20 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-slate-200 focus:border-accent focus:outline-none"
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    <span className="text-slate-500">to</span>
                    <input
                      value={rangeTo}
                      onChange={(e) => setRangeTo(e.target.value)}
                      placeholder="25"
                      className="w-20 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-slate-200 focus:border-accent focus:outline-none"
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    <span className="text-slate-500">step</span>
                    <input
                      value={rangeStep}
                      onChange={(e) => setRangeStep(e.target.value)}
                      placeholder="1"
                      className="w-16 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-slate-200 focus:border-accent focus:outline-none"
                    />
                  </label>
                </div>
              )}
              {rangeMode === "enum" && (
                <div className="flex flex-wrap gap-2">
                  {(variableParam.constraints?.enumValues ?? []).map((v) => (
                    <label
                      key={v}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={!!enumChecked[v]}
                        onChange={(e) =>
                          setEnumChecked((prev) => ({
                            ...prev,
                            [v]: e.target.checked,
                          }))
                        }
                        className="accent-accent"
                      />
                      {v}
                    </label>
                  ))}
                  {(variableParam.constraints?.enumValues ?? []).length ===
                    0 && (
                    <span className="text-xs text-slate-500 italic">
                      Parameter has no enum values defined.
                    </span>
                  )}
                </div>
              )}
              {rangeMode === "list" && (
                <textarea
                  value={listText}
                  onChange={(e) => setListText(e.target.value)}
                  placeholder="4, 5, 6, 10, 12, 16, 20"
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 focus:border-accent focus:outline-none font-mono"
                  rows={3}
                />
              )}
            </div>
          )}

          {/* Name template */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">
              Name template
            </div>
            <input
              value={nameTemplate}
              onChange={(e) => setNameTemplate(e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-slate-100 font-mono focus:border-accent focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-slate-600">
              <span className="font-mono">{"{var}"}</span> = varying value,{" "}
              <span className="font-mono">{"{unit}"}</span> = parameter unit.
            </p>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[11px] uppercase tracking-wider text-slate-500">
                  Preview ({includedCount} of {preview.length})
                </div>
              </div>
              <div className="border border-slate-700 rounded overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <tbody>
                    {preview.map((r, i) => (
                      <tr
                        key={i}
                        className={`border-b border-slate-800 last:border-b-0 ${
                          r.included ? "" : "opacity-40"
                        } ${failedRows.includes(i) ? "bg-red-900/20" : ""}`}
                      >
                        <td className="w-8 px-2 py-1">
                          <input
                            type="checkbox"
                            checked={r.included}
                            onChange={() => togglePreview(i)}
                            className="accent-accent"
                          />
                        </td>
                        <td className="px-2 py-1 font-mono text-slate-100">
                          {r.name}
                          {r.duplicateOf && (
                            <span
                              className="ml-2 text-[10px] text-amber-400"
                              title={`Already exists: ${r.duplicateOf}`}
                            >
                              dup of {r.duplicateOf}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1 text-slate-500 text-right tabular-nums">
                          {r.display}
                          {variableParam?.unit && (
                            <span className="text-slate-600 ml-1">
                              {variableParam.unit}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-slate-500">
            {creating
              ? `Creating ${progress.done} of ${progress.total}…`
              : includedCount > 0
                ? `${includedCount} item${includedCount === 1 ? "" : "s"} will be created`
                : "Configure a range to preview"}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={creating}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={runCreate}
              disabled={creating || includedCount === 0 || !variableParam}
              className="px-4 py-1.5 bg-accent text-white rounded text-xs hover:brightness-110 disabled:opacity-50"
            >
              {creating ? "Creating…" : `Create ${includedCount}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
