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
  currentVersionData: {
    id: string;
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
  } | null;
}

interface Version {
  id: string;
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

function MiniGrid({
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
  const cellSize = 52;
  const gap = 2;
  const labelPad = 24;

  const gridW = columns * cellSize + (columns - 1) * gap;
  const gridH = rows * cellSize + (rows - 1) * gap;
  const svgW = labelPad + gridW + 4;
  const svgH = labelPad + gridH + 4;

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
            fontSize={9}
          >
            {rl}{cl}
          </text>
        </g>
      );
    }
  }

  const rowLabels = [];
  for (let r = 0; r < rows; r++) {
    rowLabels.push(
      <text
        key={`rl-${r}`}
        x={labelPad - 6}
        y={labelPad + r * (cellSize + gap) + cellSize / 2}
        textAnchor="end"
        dominantBaseline="central"
        fill="#64748b"
        fontSize={11}
      >
        {getLabel(rowLabelScheme, r, rows, origin, "row")}
      </text>
    );
  }

  const colLabels = [];
  for (let c = 0; c < columns; c++) {
    colLabels.push(
      <text
        key={`cl-${c}`}
        x={labelPad + c * (cellSize + gap) + cellSize / 2}
        y={labelPad - 6}
        textAnchor="middle"
        dominantBaseline="alphabetic"
        fill="#64748b"
        fontSize={11}
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
        <line key={`rd-${r}`} x1={labelPad} x2={labelPad + gridW} y1={y} y2={y} stroke="#94a3b8" strokeWidth={2} opacity={0.6} />
      );
    }
  }
  if (columnDividersFixed) {
    for (let c = 1; c < columns; c++) {
      const x = labelPad + c * (cellSize + gap) - gap / 2;
      dividers.push(
        <line key={`cd-${c}`} x1={x} x2={x} y1={labelPad} y2={labelPad + gridH} stroke="#94a3b8" strokeWidth={2} opacity={0.6} />
      );
    }
  }

  return (
    <svg width={svgW} height={svgH} className="max-w-full">
      {cells}
      {rowLabels}
      {colLabels}
      {dividers}
    </svg>
  );
}

export default function PlaceInsertPage() {
  const params = useParams();
  const router = useRouter();
  const moduleId = params.id as string;
  const levelId = params.levelId as string;

  const [step, setStep] = useState(1);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Parametric config
  const [configRows, setConfigRows] = useState(4);
  const [configCols, setConfigCols] = useState(4);

  // Name
  const [insertName, setInsertName] = useState("");

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // When template is selected, fetch versions and pick active
  useEffect(() => {
    if (!selectedTemplateId) return;
    fetch(`/api/templates/${selectedTemplateId}/versions`)
      .then((r) => r.json())
      .then((d) => {
        const versionList = (d.versions || []).sort(
          (a: Version, b: Version) => b.version - a.version
        );
        setVersions(versionList);
        // Pick active version
        const tpl = templates.find((t) => t.id === selectedTemplateId);
        const activeVer = versionList.find(
          (v: Version) => v.version === tpl?.activeVersion
        );
        if (activeVer) {
          setSelectedVersionId(activeVer.id);
          setConfigRows(activeVer.rows ?? 4);
          setConfigCols(activeVer.columns ?? 4);
        }
      })
      .catch(console.error);
  }, [selectedTemplateId, templates]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const selectedVersion = versions.find((v) => v.id === selectedVersionId);

  const filteredTemplates = useMemo(() => {
    if (!search) return templates;
    const q = search.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
    );
  }, [templates, search]);

  // Auto-generate insert name
  useEffect(() => {
    if (selectedTemplate && !insertName) {
      setInsertName(selectedTemplate.name + " #1");
    }
  }, [selectedTemplate, insertName]);

  function selectTemplate(tplId: string) {
    setSelectedTemplateId(tplId);
    setInsertName(""); // reset so auto-name triggers
  }

  function goToStep2() {
    if (!selectedVersion) return;
    if (selectedVersion.isParametric) {
      setStep(2);
    } else {
      setStep(3);
    }
  }

  async function handlePlace() {
    if (!selectedTemplate || !selectedVersion) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/inserts/place-with-children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          templateVersionId: selectedVersion.id,
          locationId: levelId,
          name: insertName.trim() || undefined,
          rows: selectedVersion.isParametric ? configRows : undefined,
          columns: selectedVersion.isParametric ? configCols : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to place insert");

      router.push(`/modules/${moduleId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        Loading...
      </div>
    );
  }

  const previewRows = selectedVersion?.isParametric
    ? configRows
    : (selectedVersion?.rows ?? 1);
  const previewCols = selectedVersion?.isParametric
    ? configCols
    : (selectedVersion?.columns ?? 1);

  return (
    <div className="flex-1 flex min-w-0 h-full overflow-hidden">
      {/* Left: Template selection / configuration */}
      <div className="flex-1 flex flex-col min-w-0 max-w-xl">
        <div className="flex-1 overflow-y-auto p-6">
        <button
          onClick={() => router.push(`/modules/${moduleId}`)}
          className="text-sm text-slate-400 hover:text-slate-200 transition-colors mb-4 self-start"
        >
          &larr; Back to module
        </button>

        {error && (
          <div className="px-3 py-2 bg-red-900/30 border border-red-700/50 rounded text-red-300 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Step 1: Choose Template */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <h1 className="text-xl font-semibold text-slate-100">
              Place Insert — Choose Template
            </h1>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 placeholder:text-slate-600 focus:border-accent focus:outline-none"
            />

            {filteredTemplates.length === 0 ? (
              <p className="text-slate-500 text-sm">
                No templates available. Create a template first.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {filteredTemplates.map((t) => {
                  const ver = t.currentVersionData;
                  const isSelected = t.id === selectedTemplateId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => selectTemplate(t.id)}
                      className={`flex items-center gap-3 px-4 py-3 rounded text-left transition-colors ${
                        isSelected
                          ? "bg-slate-700 border border-accent/50"
                          : "bg-slate-800/30 border border-slate-700/50 hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-100 font-medium">
                          {t.name}
                        </div>
                        {t.description && (
                          <div className="text-xs text-slate-500 truncate">
                            {t.description}
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          ver?.isParametric
                            ? "bg-purple-900/50 text-purple-300"
                            : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {ver?.isParametric ? "Parametric" : "Fixed"}
                      </span>
                      {ver?.rows != null && ver?.columns != null && (
                        <span className="text-xs text-slate-500 tabular-nums">
                          {ver.rows}×{ver.columns}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* Step 2: Configure (parametric only) */}
        {step === 2 && selectedVersion && (
          <div className="flex flex-col gap-4">
            <h1 className="text-xl font-semibold text-slate-100">
              Configure Dimensions
            </h1>
            <p className="text-sm text-slate-400">
              {selectedTemplate?.name} is parametric — set the grid size.
            </p>

            <div className="flex gap-4">
              <label className="flex flex-col gap-1 flex-1">
                <span className="text-xs text-slate-400 uppercase tracking-wider">
                  Rows
                  {selectedVersion.minRows != null && selectedVersion.maxRows != null && (
                    <span className="text-slate-600 normal-case ml-1">
                      ({selectedVersion.minRows}–{selectedVersion.maxRows})
                    </span>
                  )}
                </span>
                <input
                  type="number"
                  min={selectedVersion.minRows ?? 1}
                  max={selectedVersion.maxRows ?? 26}
                  value={configRows}
                  onChange={(e) => setConfigRows(Number(e.target.value) || 1)}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 focus:border-accent focus:outline-none tabular-nums"
                />
              </label>
              <label className="flex flex-col gap-1 flex-1">
                <span className="text-xs text-slate-400 uppercase tracking-wider">
                  Columns
                  {selectedVersion.minColumns != null && selectedVersion.maxColumns != null && (
                    <span className="text-slate-600 normal-case ml-1">
                      ({selectedVersion.minColumns}–{selectedVersion.maxColumns})
                    </span>
                  )}
                </span>
                <input
                  type="number"
                  min={selectedVersion.minColumns ?? 1}
                  max={selectedVersion.maxColumns ?? 26}
                  value={configCols}
                  onChange={(e) => setConfigCols(Number(e.target.value) || 1)}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 focus:border-accent focus:outline-none tabular-nums"
                />
              </label>
            </div>

          </div>
        )}

        {/* Step 3: Name & Confirm */}
        {step === 3 && selectedVersion && (
          <div className="flex flex-col gap-4">
            <h1 className="text-xl font-semibold text-slate-100">
              Name & Place
            </h1>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400 uppercase tracking-wider">
                Insert Name
              </span>
              <input
                type="text"
                value={insertName}
                onChange={(e) => setInsertName(e.target.value)}
                placeholder="e.g., Plano 3600 #4"
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 placeholder:text-slate-600 focus:border-accent focus:outline-none"
              />
            </label>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-sm">
              <p className="text-slate-400">
                Template: <span className="text-slate-200">{selectedTemplate?.name}</span>
              </p>
              <p className="text-slate-400">
                Version: <span className="text-slate-200">v{selectedVersion.version}</span>
              </p>
              <p className="text-slate-400">
                Grid: <span className="text-slate-200 tabular-nums">{previewRows} × {previewCols}</span>
              </p>
            </div>

          </div>
        )}
        </div>

        {/* Sticky footer: primary action for the current step (PI-1) */}
        <div className="border-t border-slate-700 bg-slate-900/80 backdrop-blur px-6 py-3 flex items-center gap-3 shrink-0">
          {step === 1 && (
            <button
              onClick={goToStep2}
              disabled={!selectedVersion}
              className="px-5 py-2 bg-accent text-white rounded-md hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
            >
              Next
            </button>
          )}
          {step === 2 && selectedVersion && (
            <>
              <button
                onClick={() => setStep(1)}
                className="px-5 py-2 bg-slate-700 text-slate-300 rounded-md hover:bg-slate-600 transition-all"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="px-5 py-2 bg-accent text-white rounded-md hover:brightness-110 transition-all ml-auto"
              >
                Next
              </button>
            </>
          )}
          {step === 3 && selectedVersion && (
            <>
              <button
                onClick={() =>
                  setStep(selectedVersion.isParametric ? 2 : 1)
                }
                className="px-5 py-2 bg-slate-700 text-slate-300 rounded-md hover:bg-slate-600 transition-all"
              >
                Back
              </button>
              <button
                onClick={handlePlace}
                disabled={saving}
                className="px-5 py-2 bg-accent text-white rounded-md hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
              >
                {saving ? "Placing..." : "Place Insert"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Right: Grid preview */}
      <div className="w-96 shrink-0 border-l border-slate-700 flex items-center justify-center bg-slate-800/20">
        {selectedVersion ? (
          <MiniGrid
            rows={previewRows}
            columns={previewCols}
            rowLabelScheme={selectedVersion.rowLabelScheme}
            columnLabelScheme={selectedVersion.columnLabelScheme}
            origin={selectedVersion.originPosition as Origin}
            rowDividersFixed={selectedVersion.rowDividersFixed}
            columnDividersFixed={selectedVersion.columnDividersFixed}
          />
        ) : (
          <p className="text-slate-500 text-sm px-6 text-center">
            Select a template to preview its grid layout.
          </p>
        )}
      </div>
    </div>
  );
}
