"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Origin = "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface Template {
  id: string;
  name: string;
  description: string | null;
  currentVersion: number;
  activeVersion: number;
  metadata: Record<string, unknown> | null;
}

interface Version {
  id: string;
  templateId: string;
  version: number;
  isParametric: boolean;
  rows: number | null;
  columns: number | null;
  minRows: number | null;
  maxRows: number | null;
  minColumns: number | null;
  maxColumns: number | null;
  rowLabelScheme: string;
  columnLabelScheme: string;
  originPosition: string;
  rowDividersFixed: boolean;
  columnDividersFixed: boolean;
  createdAt: string;
}

function getLabel(
  scheme: string,
  index: number,
  count: number,
  origin: Origin,
  axis: "row" | "col"
): string {
  const reversed =
    (axis === "row" && origin.startsWith("bottom")) ||
    (axis === "col" && origin.endsWith("right"));
  const i = reversed ? count - 1 - index : index;
  return scheme === "alpha" ? String.fromCharCode(65 + i) : String(i + 1);
}

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
  const svgW = labelPad + gridW + 12;
  const svgH = labelPad + gridH + 12;

  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const x = labelPad + c * (cellSize + gap);
      const y = labelPad + r * (cellSize + gap);
      const rl = getLabel(rowLabelScheme, r, rows, origin, "row");
      const cl = getLabel(columnLabelScheme, c, columns, origin, "col");
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
            {rl}
            {cl}
          </text>
        </g>
      );
    }
  }

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
        {getLabel(rowLabelScheme, r, rows, origin, "row")}
      </text>
    );
  }

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
        {getLabel(columnLabelScheme, c, columns, origin, "col")}
      </text>
    );
  }

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

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [template, setTemplate] = useState<Template | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Editable name/description
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Property form state
  const [formRows, setFormRows] = useState(1);
  const [formCols, setFormCols] = useState(1);
  const [formRowLabels, setFormRowLabels] = useState("alpha");
  const [formColLabels, setFormColLabels] = useState("numeric");
  const [formOrigin, setFormOrigin] = useState<Origin>("top-left");
  const [formRowDivFixed, setFormRowDivFixed] = useState(false);
  const [formColDivFixed, setFormColDivFixed] = useState(false);
  const [formUnitSystem, setFormUnitSystem] = useState("metric");

  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [tRes, vRes] = await Promise.all([
        fetch(`/api/templates/${id}`),
        fetch(`/api/templates/${id}/versions`),
      ]);
      const tData = await tRes.json();
      const vData = await vRes.json();

      if (!tRes.ok) {
        router.push("/templates");
        return;
      }

      setTemplate(tData.template);
      setVersions(
        (vData.versions || []).sort(
          (a: Version, b: Version) => b.version - a.version
        )
      );
      setEditName(tData.template.name);
      setEditDesc(tData.template.description || "");

      // Select current version by default
      if (selectedVersion === null) {
        setSelectedVersion(tData.template.currentVersion);
      }
    } catch (err) {
      console.error("Failed to fetch template:", err);
    } finally {
      setLoading(false);
    }
  }, [id, router, selectedVersion]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Populate form when selected version changes
  const activeVer = useMemo(
    () => versions.find((v) => v.version === selectedVersion),
    [versions, selectedVersion]
  );

  useEffect(() => {
    if (!activeVer) return;
    setFormRows(activeVer.rows ?? 1);
    setFormCols(activeVer.columns ?? 1);
    setFormRowLabels(activeVer.rowLabelScheme);
    setFormColLabels(activeVer.columnLabelScheme);
    setFormOrigin(activeVer.originPosition as Origin);
    setFormRowDivFixed(activeVer.rowDividersFixed);
    setFormColDivFixed(activeVer.columnDividersFixed);
    const meta = template?.metadata as Record<string, unknown> | null;
    setFormUnitSystem((meta?.unitSystem as string) || "metric");
  }, [activeVer, template?.metadata]);

  // Dirty detection
  const isDirty = useMemo(() => {
    if (!activeVer) return false;
    return (
      formRows !== (activeVer.rows ?? 1) ||
      formCols !== (activeVer.columns ?? 1) ||
      formRowLabels !== activeVer.rowLabelScheme ||
      formColLabels !== activeVer.columnLabelScheme ||
      formOrigin !== activeVer.originPosition ||
      formRowDivFixed !== activeVer.rowDividersFixed ||
      formColDivFixed !== activeVer.columnDividersFixed
    );
  }, [
    activeVer,
    formRows,
    formCols,
    formRowLabels,
    formColLabels,
    formOrigin,
    formRowDivFixed,
    formColDivFixed,
  ]);

  const labelError = useMemo(() => {
    if (formRowLabels === formColLabels) {
      return "Row and column labels must use different types.";
    }
    return null;
  }, [formRowLabels, formColLabels]);

  function revert() {
    if (!activeVer) return;
    setFormRows(activeVer.rows ?? 1);
    setFormCols(activeVer.columns ?? 1);
    setFormRowLabels(activeVer.rowLabelScheme);
    setFormColLabels(activeVer.columnLabelScheme);
    setFormOrigin(activeVer.originPosition as Origin);
    setFormRowDivFixed(activeVer.rowDividersFixed);
    setFormColDivFixed(activeVer.columnDividersFixed);
  }

  async function publishVersion() {
    if (!template || labelError) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/templates/${id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: formRows,
          columns: formCols,
          rowLabelScheme: formRowLabels,
          columnLabelScheme: formColLabels,
          originPosition: formOrigin,
          rowDividersFixed: formRowDivFixed,
          columnDividersFixed: formColDivFixed,
          isParametric: activeVer?.isParametric ?? false,
        }),
      });
      if (!res.ok) throw new Error("Failed to publish version");

      const data = await res.json();
      setSelectedVersion(data.version.version);
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function setActiveVersion(version: number) {
    try {
      await fetch(`/api/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeVersion: version }),
      });
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  }

  async function saveName() {
    if (!template || editName.trim() === template.name) return;
    try {
      await fetch(`/api/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  }

  async function saveDesc() {
    if (!template || editDesc.trim() === (template.description || "")) return;
    try {
      await fetch(`/api/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: editDesc.trim() || null }),
      });
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        Loading...
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        Template not found.
      </div>
    );
  }

  const nextVersion = template.currentVersion + 1;

  return (
    <div className="flex-1 flex min-w-0 h-full overflow-hidden">
      {/* Left Panel — Version History */}
      <div className="w-72 border-r border-slate-700 flex flex-col overflow-y-auto shrink-0 bg-slate-800/30">
        <div className="p-4 border-b border-slate-700">
          {/* Editable name */}
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
            className="text-lg font-semibold text-slate-100 bg-transparent border-b border-transparent hover:border-slate-600 focus:border-accent focus:outline-none w-full"
          />
          {/* Editable description */}
          <input
            type="text"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            onBlur={saveDesc}
            onKeyDown={(e) => e.key === "Enter" && saveDesc()}
            placeholder="Add description..."
            className="text-sm text-slate-400 bg-transparent border-b border-transparent hover:border-slate-600 focus:border-accent focus:outline-none w-full mt-1 placeholder:text-slate-600"
          />
        </div>

        {/* Version list */}
        <div className="p-3">
          <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2">
            Versions
          </h3>
          <div className="flex flex-col gap-1">
            {versions.map((v) => {
              const isSelected = v.version === selectedVersion;
              const isActive = v.version === template.activeVersion;
              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedVersion(v.version)}
                  className={`flex items-center gap-2 px-3 py-2 rounded text-left text-sm transition-colors ${
                    isSelected
                      ? "bg-slate-700 text-slate-100"
                      : "text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
                  }`}
                >
                  <span className="font-medium">v{v.version}</span>
                  <span className="text-xs text-slate-500 flex-1">
                    {v.rows}×{v.columns}
                  </span>
                  {isActive && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent font-medium">
                      active
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Center Panel — Grid Preview */}
      <div className="flex-1 flex items-center justify-center overflow-auto p-6">
        <GridPreview
          rows={formRows}
          columns={formCols}
          rowLabelScheme={formRowLabels}
          columnLabelScheme={formColLabels}
          origin={formOrigin}
          rowDividersFixed={formRowDivFixed}
          columnDividersFixed={formColDivFixed}
        />
      </div>

      {/* Right Panel — Properties */}
      <div className="w-72 border-l border-slate-700 flex flex-col overflow-y-auto shrink-0 bg-slate-800/30">
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-xs text-slate-500 uppercase tracking-wider">
            Properties
            {selectedVersion && (
              <span className="text-slate-600 ml-1">— v{selectedVersion}</span>
            )}
          </h3>
        </div>

        <div className="p-4 flex flex-col gap-4">
          {/* Dimensions */}
          <div className="flex gap-3">
            <label className="flex flex-col gap-1 flex-1">
              <span className="text-xs text-slate-500">Rows</span>
              <input
                type="number"
                min={1}
                max={26}
                value={formRows}
                onChange={(e) => setFormRows(Number(e.target.value) || 1)}
                className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm focus:border-accent focus:outline-none tabular-nums"
              />
            </label>
            <label className="flex flex-col gap-1 flex-1">
              <span className="text-xs text-slate-500">Columns</span>
              <input
                type="number"
                min={1}
                max={26}
                value={formCols}
                onChange={(e) => setFormCols(Number(e.target.value) || 1)}
                className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm focus:border-accent focus:outline-none tabular-nums"
              />
            </label>
          </div>

          {/* Row labels */}
          <fieldset className="flex flex-col gap-1">
            <legend className="text-xs text-slate-500 mb-1">Row Labels</legend>
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="rowLabels"
                  checked={formRowLabels === "alpha"}
                  onChange={() => setFormRowLabels("alpha")}
                  className="accent-accent"
                />
                <span className="text-sm text-slate-200">Alpha</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="rowLabels"
                  checked={formRowLabels === "numeric"}
                  onChange={() => setFormRowLabels("numeric")}
                  className="accent-accent"
                />
                <span className="text-sm text-slate-200">Numeric</span>
              </label>
            </div>
          </fieldset>

          {/* Column labels */}
          <fieldset className="flex flex-col gap-1">
            <legend className="text-xs text-slate-500 mb-1">
              Column Labels
            </legend>
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="colLabels"
                  checked={formColLabels === "numeric"}
                  onChange={() => setFormColLabels("numeric")}
                  className="accent-accent"
                />
                <span className="text-sm text-slate-200">Numeric</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="colLabels"
                  checked={formColLabels === "alpha"}
                  onChange={() => setFormColLabels("alpha")}
                  className="accent-accent"
                />
                <span className="text-sm text-slate-200">Alpha</span>
              </label>
            </div>
            {labelError && (
              <p className="text-red-400 text-xs mt-1">{labelError}</p>
            )}
          </fieldset>

          {/* Origin */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Origin</span>
            <select
              value={formOrigin}
              onChange={(e) => setFormOrigin(e.target.value as Origin)}
              className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm focus:border-accent focus:outline-none"
            >
              <option value="top-left">Top-left</option>
              <option value="top-right">Top-right</option>
              <option value="bottom-left">Bottom-left</option>
              <option value="bottom-right">Bottom-right</option>
            </select>
          </label>

          {/* Dividers */}
          <div className="flex flex-col gap-2">
            <span className="text-xs text-slate-500">Dividers</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formRowDivFixed}
                onChange={(e) => setFormRowDivFixed(e.target.checked)}
                className="accent-accent"
              />
              <span className="text-sm text-slate-200">
                Row dividers fixed
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formColDivFixed}
                onChange={(e) => setFormColDivFixed(e.target.checked)}
                className="accent-accent"
              />
              <span className="text-sm text-slate-200">
                Column dividers fixed
              </span>
            </label>
          </div>

          {/* Unit system */}
          <fieldset className="flex flex-col gap-1">
            <legend className="text-xs text-slate-500 mb-1">
              Unit System
            </legend>
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="units"
                  checked={formUnitSystem === "metric"}
                  onChange={() => setFormUnitSystem("metric")}
                  className="accent-accent"
                />
                <span className="text-sm text-slate-200">Metric</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="units"
                  checked={formUnitSystem === "imperial"}
                  onChange={() => setFormUnitSystem("imperial")}
                  className="accent-accent"
                />
                <span className="text-sm text-slate-200">Imperial</span>
              </label>
            </div>
          </fieldset>

          {/* Set as Active */}
          {selectedVersion !== null &&
            selectedVersion !== template.activeVersion && (
              <button
                onClick={() => setActiveVersion(selectedVersion)}
                className="px-3 py-1.5 bg-slate-700 text-slate-200 rounded text-sm hover:bg-slate-600 transition-colors"
              >
                Set v{selectedVersion} as Active
              </button>
            )}

          {/* Dirty state: Publish / Revert */}
          {isDirty && (
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-700">
              <button
                onClick={publishVersion}
                disabled={saving || !!labelError}
                className="px-3 py-2 bg-accent text-white rounded text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Publishing..." : `Publish as v${nextVersion}`}
              </button>
              <button
                onClick={revert}
                className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded text-sm hover:bg-slate-600 transition-colors"
              >
                Revert
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
