"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { getGridLabel } from "@/lib/gridLabels";

type Origin = "top-left" | "top-right" | "bottom-left" | "bottom-right";

function GridPreview({
  rows,
  columns,
  rowLabelScheme,
  columnLabelScheme,
  origin,
  rowDividersFixed,
  columnDividersFixed,
}: {
  rows: number;
  columns: number;
  rowLabelScheme: string;
  columnLabelScheme: string;
  origin: Origin;
  rowDividersFixed: boolean;
  columnDividersFixed: boolean;
}) {
  const cellSize = 72;
  const gap = 8;
  const labelPad = 32;
  const dividerThick = 3;

  const gridW = columns * cellSize + (columns - 1) * gap;
  const gridH = rows * cellSize + (rows - 1) * gap;
  const svgW = labelPad + gridW + 4;
  const svgH = labelPad + gridH + 4;

  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const x = labelPad + c * (cellSize + gap);
      const y = labelPad + r * (cellSize + gap);
      const rl = getGridLabel(rowLabelScheme, r, rows, origin, "row");
      const cl = getGridLabel(columnLabelScheme, c, columns, origin, "col");
      cells.push(
        <g key={`${r}-${c}`}>
          <rect
            x={x}
            y={y}
            width={cellSize}
            height={cellSize}
            fill="transparent"
            stroke="#475569"
            strokeWidth={1}
            rx={2}
          />
          <text
            x={x + cellSize / 2}
            y={y + cellSize / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#94a3b8"
            fontSize={12}
          >
            {rl}{cl}
          </text>
        </g>
      );
    }
  }

  // Row labels
  const rowLabels = [];
  for (let r = 0; r < rows; r++) {
    const y = labelPad + r * (cellSize + gap) + cellSize / 2;
    rowLabels.push(
      <text
        key={`rl-${r}`}
        x={labelPad - 8}
        y={y}
        textAnchor="end"
        dominantBaseline="central"
        fill="#64748b"
        fontSize={14}
      >
        {getGridLabel(rowLabelScheme, r, rows, origin, "row")}
      </text>
    );
  }

  // Column labels
  const colLabels = [];
  for (let c = 0; c < columns; c++) {
    const x = labelPad + c * (cellSize + gap) + cellSize / 2;
    colLabels.push(
      <text
        key={`cl-${c}`}
        x={x}
        y={labelPad - 8}
        textAnchor="middle"
        dominantBaseline="alphabetic"
        fill="#64748b"
        fontSize={14}
      >
        {getGridLabel(columnLabelScheme, c, columns, origin, "col")}
      </text>
    );
  }

  // Fixed dividers
  const dividers = [];
  if (rowDividersFixed) {
    for (let r = 1; r < rows; r++) {
      const y = labelPad + r * (cellSize + gap) - gap / 2;
      dividers.push(
        <line
          key={`rd-${r}`}
          x1={labelPad}
          x2={labelPad + gridW}
          y1={y}
          y2={y}
          stroke="#94a3b8"
          strokeWidth={dividerThick}
          opacity={0.8}
        />
      );
    }
  }
  if (columnDividersFixed) {
    for (let c = 1; c < columns; c++) {
      const x = labelPad + c * (cellSize + gap) - gap / 2;
      dividers.push(
        <line
          key={`cd-${c}`}
          x1={x}
          x2={x}
          y1={labelPad}
          y2={labelPad + gridH}
          stroke="#94a3b8"
          strokeWidth={dividerThick}
          opacity={0.8}
        />
      );
    }
  }

  // Origin marker
  const markerSize = 8;
  let markerPoints = "";
  if (origin === "top-left") {
    markerPoints = `${labelPad - 2},${labelPad - 2} ${labelPad - 2 - markerSize},${labelPad - 2} ${labelPad - 2},${labelPad - 2 - markerSize}`;
  } else if (origin === "top-right") {
    markerPoints = `${labelPad + gridW + 2},${labelPad - 2} ${labelPad + gridW + 2 + markerSize},${labelPad - 2} ${labelPad + gridW + 2},${labelPad - 2 - markerSize}`;
  } else if (origin === "bottom-left") {
    markerPoints = `${labelPad - 2},${labelPad + gridH + 2} ${labelPad - 2 - markerSize},${labelPad + gridH + 2} ${labelPad - 2},${labelPad + gridH + 2 + markerSize}`;
  } else {
    markerPoints = `${labelPad + gridW + 2},${labelPad + gridH + 2} ${labelPad + gridW + 2 + markerSize},${labelPad + gridH + 2} ${labelPad + gridW + 2},${labelPad + gridH + 2 + markerSize}`;
  }

  return (
    <svg width={svgW} height={svgH} className="max-w-full">
      {cells}
      {rowLabels}
      {colLabels}
      {dividers}
      <polygon points={markerPoints} fill="#ff6600" />
    </svg>
  );
}

export default function TemplateCreatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isParametric, setIsParametric] = useState(false);
  const [rows, setRows] = useState(4);
  const [columns, setColumns] = useState(6);
  const [minRows, setMinRows] = useState<number | null>(null);
  const [maxRows, setMaxRows] = useState<number | null>(null);
  const [minColumns, setMinColumns] = useState<number | null>(null);
  const [maxColumns, setMaxColumns] = useState<number | null>(null);
  const [rowLabelScheme, setRowLabelScheme] = useState("alpha");
  const [columnLabelScheme, setColumnLabelScheme] = useState("numeric");
  const [origin, setOrigin] = useState<Origin>("top-left");
  const [rowDividersFixed, setRowDividersFixed] = useState(false);
  const [columnDividersFixed, setColumnDividersFixed] = useState(false);
  const [unitSystem, setUnitSystem] = useState("metric");

  // Cross-validate label schemes
  const labelError = useMemo(() => {
    if (rowLabelScheme === columnLabelScheme) {
      return "Row and column labels must use different types.";
    }
    return null;
  }, [rowLabelScheme, columnLabelScheme]);

  const canSubmit = name.trim() && !labelError && rows > 0 && columns > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || undefined,
        isParametric,
        rows,
        columns,
        rowLabelScheme,
        columnLabelScheme,
        originPosition: origin,
        rowDividersFixed,
        columnDividersFixed,
        metadata: { unitSystem },
      };

      if (isParametric) {
        body.minRows = minRows;
        body.maxRows = maxRows;
        body.minColumns = minColumns;
        body.maxColumns = maxColumns;
      }

      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create template");

      router.push(`/templates/${data.template.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 flex min-w-0 h-full overflow-auto">
      <form
        onSubmit={handleSubmit}
        className="flex-1 flex gap-8 p-6 max-w-6xl"
      >
        {/* Left: Form fields */}
        <div className="flex-1 flex flex-col gap-5 min-w-[320px] max-w-md">
          <h1 className="text-xl font-semibold text-slate-100 mb-2">
            New Template
          </h1>

          {error && (
            <div className="px-3 py-2 bg-red-900/30 border border-red-700/50 rounded text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Name */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider">
              Name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Plano 3600 Stowaway"
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 placeholder:text-slate-600 focus:border-accent focus:outline-none"
              required
            />
          </label>

          {/* Description */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider">
              Description
            </span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 placeholder:text-slate-600 focus:border-accent focus:outline-none"
            />
          </label>

          {/* Type */}
          <fieldset className="flex flex-col gap-1">
            <legend className="text-xs text-slate-400 uppercase tracking-wider mb-1">
              Type
            </legend>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  checked={!isParametric}
                  onChange={() => setIsParametric(false)}
                  className="accent-accent"
                />
                <span className="text-slate-200">Fixed</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  checked={isParametric}
                  onChange={() => setIsParametric(true)}
                  className="accent-accent"
                />
                <span className="text-slate-200">Parametric</span>
              </label>
            </div>
          </fieldset>

          {/* Dimensions */}
          <div className="flex gap-4">
            <label className="flex flex-col gap-1 flex-1">
              <span className="text-xs text-slate-400 uppercase tracking-wider">
                Rows
              </span>
              <input
                type="number"
                min={1}
                max={26}
                value={rows}
                onChange={(e) => setRows(Number(e.target.value) || 1)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 focus:border-accent focus:outline-none tabular-nums"
              />
            </label>
            <label className="flex flex-col gap-1 flex-1">
              <span className="text-xs text-slate-400 uppercase tracking-wider">
                Columns
              </span>
              <input
                type="number"
                min={1}
                max={26}
                value={columns}
                onChange={(e) => setColumns(Number(e.target.value) || 1)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 focus:border-accent focus:outline-none tabular-nums"
              />
            </label>
          </div>

          {/* Parametric constraints */}
          {isParametric && (
            <div className="flex flex-col gap-3 pl-4 border-l-2 border-purple-700/50">
              <span className="text-xs text-purple-300 uppercase tracking-wider">
                Parametric Constraints
              </span>
              <div className="flex gap-4">
                <label className="flex flex-col gap-1 flex-1">
                  <span className="text-xs text-slate-500">Min Rows</span>
                  <input
                    type="number"
                    min={1}
                    value={minRows ?? ""}
                    onChange={(e) =>
                      setMinRows(e.target.value ? Number(e.target.value) : null)
                    }
                    className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm focus:border-accent focus:outline-none tabular-nums"
                  />
                </label>
                <label className="flex flex-col gap-1 flex-1">
                  <span className="text-xs text-slate-500">Max Rows</span>
                  <input
                    type="number"
                    min={1}
                    value={maxRows ?? ""}
                    onChange={(e) =>
                      setMaxRows(e.target.value ? Number(e.target.value) : null)
                    }
                    className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm focus:border-accent focus:outline-none tabular-nums"
                  />
                </label>
              </div>
              <div className="flex gap-4">
                <label className="flex flex-col gap-1 flex-1">
                  <span className="text-xs text-slate-500">Min Columns</span>
                  <input
                    type="number"
                    min={1}
                    value={minColumns ?? ""}
                    onChange={(e) =>
                      setMinColumns(
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm focus:border-accent focus:outline-none tabular-nums"
                  />
                </label>
                <label className="flex flex-col gap-1 flex-1">
                  <span className="text-xs text-slate-500">Max Columns</span>
                  <input
                    type="number"
                    min={1}
                    value={maxColumns ?? ""}
                    onChange={(e) =>
                      setMaxColumns(
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm focus:border-accent focus:outline-none tabular-nums"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Row Labels */}
          <fieldset className="flex flex-col gap-1">
            <legend className="text-xs text-slate-400 uppercase tracking-wider mb-1">
              Row Labels
            </legend>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="rowLabels"
                  checked={rowLabelScheme === "alpha"}
                  onChange={() => setRowLabelScheme("alpha")}
                  className="accent-accent"
                />
                <span className="text-slate-200">Alpha (A, B, C)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="rowLabels"
                  checked={rowLabelScheme === "numeric"}
                  onChange={() => setRowLabelScheme("numeric")}
                  className="accent-accent"
                />
                <span className="text-slate-200">Numeric (1, 2, 3)</span>
              </label>
            </div>
          </fieldset>

          {/* Column Labels */}
          <fieldset className="flex flex-col gap-1">
            <legend className="text-xs text-slate-400 uppercase tracking-wider mb-1">
              Column Labels
            </legend>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="colLabels"
                  checked={columnLabelScheme === "numeric"}
                  onChange={() => setColumnLabelScheme("numeric")}
                  className="accent-accent"
                />
                <span className="text-slate-200">Numeric (1, 2, 3)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="colLabels"
                  checked={columnLabelScheme === "alpha"}
                  onChange={() => setColumnLabelScheme("alpha")}
                  className="accent-accent"
                />
                <span className="text-slate-200">Alpha (A, B, C)</span>
              </label>
            </div>
            {labelError && (
              <p className="text-red-400 text-xs mt-1">{labelError}</p>
            )}
          </fieldset>

          {/* Origin */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider">
              Origin
            </span>
            <select
              value={origin}
              onChange={(e) => setOrigin(e.target.value as Origin)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 focus:border-accent focus:outline-none"
            >
              <option value="top-left">Top-left</option>
              <option value="top-right">Top-right</option>
              <option value="bottom-left">Bottom-left</option>
              <option value="bottom-right">Bottom-right</option>
            </select>
          </label>

          {/* Dividers */}
          <div className="flex flex-col gap-2">
            <span className="text-xs text-slate-400 uppercase tracking-wider">
              Dividers
            </span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rowDividersFixed}
                onChange={(e) => setRowDividersFixed(e.target.checked)}
                className="accent-accent"
              />
              <span className="text-slate-200">Row dividers fixed</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={columnDividersFixed}
                onChange={(e) => setColumnDividersFixed(e.target.checked)}
                className="accent-accent"
              />
              <span className="text-slate-200">Column dividers fixed</span>
            </label>
          </div>

          {/* Unit System */}
          <fieldset className="flex flex-col gap-1">
            <legend className="text-xs text-slate-400 uppercase tracking-wider mb-1">
              Unit System
            </legend>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="units"
                  checked={unitSystem === "metric"}
                  onChange={() => setUnitSystem("metric")}
                  className="accent-accent"
                />
                <span className="text-slate-200">Metric</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="units"
                  checked={unitSystem === "imperial"}
                  onChange={() => setUnitSystem("imperial")}
                  className="accent-accent"
                />
                <span className="text-slate-200">Imperial</span>
              </label>
            </div>
          </fieldset>

          {/* Submit */}
          <div className="flex gap-3 mt-2">
            <button
              type="submit"
              disabled={!canSubmit || saving}
              className="px-5 py-2 bg-accent text-white rounded-md hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Creating..." : "Create Template"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/templates")}
              className="px-5 py-2 bg-slate-700 text-slate-300 rounded-md hover:bg-slate-600 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Right: Grid preview */}
        <div className="flex-1 flex flex-col items-center pt-12 min-w-[300px]">
          <span className="text-xs text-slate-500 uppercase tracking-wider mb-4">
            Preview
          </span>
          <GridPreview
            rows={rows}
            columns={columns}
            rowLabelScheme={rowLabelScheme}
            columnLabelScheme={columnLabelScheme}
            origin={origin}
            rowDividersFixed={rowDividersFixed}
            columnDividersFixed={columnDividersFixed}
          />
        </div>
      </form>
    </div>
  );
}
