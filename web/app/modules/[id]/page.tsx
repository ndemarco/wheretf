"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Module {
  id: string;
  name: string;
  description: string | null;
  primaryDimensionLabel: string;
  primaryDimensionCount: number;
}

interface Location {
  id: string;
  moduleId: string;
  parentId: string | null;
  label: string;
  path: string;
  locationType: string;
  isDisabled: boolean;
  disableReason: string | null;
  templateVersionId: string | null;
  gridRow: number | null;
  gridColumn: number | null;
  metadata: Record<string, unknown> | null;
}

interface Insert {
  id: string;
  name: string;
  templateId: string;
  templateVersionId: string;
  locationId: string;
}

export default function ModuleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [module_, setModule] = useState<Module | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);

  // Inline editing
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [modRes, locRes] = await Promise.all([
        fetch(`/api/modules/${id}`),
        fetch(`/api/locations?moduleId=${id}`),
      ]);

      if (!modRes.ok) {
        router.push("/modules");
        return;
      }

      const modData = await modRes.json();
      const locData = await locRes.json();

      setModule(modData.module);
      setLocations(locData.locations || []);
      setEditName(modData.module.name);
      setEditDesc(modData.module.description || "");
    } catch (err) {
      console.error("Failed to fetch module:", err);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Top-level locations (levels) — those with no parent
  const levels = locations.filter((l) => l.parentId === null);
  const selectedLevel = levels.find((l) => l.id === selectedLevelId) || null;

  // Child locations of selected level
  const childLocations = selectedLevel
    ? locations.filter((l) => l.parentId === selectedLevel.id)
    : [];

  async function saveName() {
    if (!module_ || editName.trim() === module_.name) return;
    try {
      await fetch(`/api/modules/${id}`, {
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
    if (!module_ || editDesc.trim() === (module_.description || "")) return;
    try {
      await fetch(`/api/modules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: editDesc.trim() || null }),
      });
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteModule() {
    try {
      await fetch(`/api/modules/${id}`, { method: "DELETE" });
      router.push("/modules");
    } catch (err) {
      console.error(err);
    }
  }

  async function toggleDisable(locationId: string, isDisabled: boolean) {
    try {
      await fetch(`/api/locations/${locationId}/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDisabled: !isDisabled }),
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

  if (!module_) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        Module not found.
      </div>
    );
  }

  return (
    <div className="flex-1 flex min-w-0 h-full overflow-hidden">
      {/* Left Panel — Module Info + Level Table */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto border-r border-slate-700">
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
          <div className="flex items-center gap-4 mt-2">
            <span className="text-xs text-slate-500">
              {levels.length}{" "}
              {levels.length === 1
                ? module_.primaryDimensionLabel
                : module_.primaryDimensionLabel + "s"}
            </span>
            <button
              onClick={deleteModule}
              className="text-xs text-red-400 hover:text-red-300 transition-colors ml-auto"
            >
              Delete Module
            </button>
          </div>
        </div>

        {/* Level table */}
        <div className="flex-1 overflow-y-auto">
          {levels.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">
              No levels found.
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/30 sticky top-0">
                  <th className="px-4 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Label
                  </th>
                  <th className="px-4 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Insert
                  </th>
                  <th className="px-4 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {levels.map((level) => {
                  const isSelected = level.id === selectedLevelId;
                  const hasChildren = locations.some(
                    (l) => l.parentId === level.id
                  );
                  const notes =
                    level.metadata &&
                    typeof level.metadata === "object" &&
                    "notes" in level.metadata
                      ? (level.metadata as { notes: string }).notes
                      : null;

                  return (
                    <tr
                      key={level.id}
                      onClick={() => setSelectedLevelId(level.id)}
                      className={`border-b border-slate-700/50 cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-slate-700/50"
                          : "hover:bg-slate-800/30"
                      }`}
                    >
                      <td className="px-4 py-2.5 text-slate-100">
                        {level.label}
                        {notes && (
                          <span className="block text-xs text-slate-500 mt-0.5">
                            {notes}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            level.locationType === "receptacle"
                              ? "bg-blue-900/40 text-blue-300"
                              : "bg-slate-700 text-slate-300"
                          }`}
                        >
                          {level.locationType}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-sm">
                        {hasChildren ? "Configured" : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {level.isDisabled ? (
                          <span className="text-xs text-red-400">
                            Disabled
                            {level.disableReason && `: ${level.disableReason}`}
                          </span>
                        ) : (
                          <span className="text-xs text-green-400">Active</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Right Panel — Level Preview */}
      <div className="w-96 flex flex-col shrink-0 bg-slate-800/20">
        {!selectedLevel ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm px-6 text-center">
            Select a {module_.primaryDimensionLabel} to view its layout.
          </div>
        ) : childLocations.length > 0 ? (
          <div className="flex-1 flex flex-col overflow-y-auto">
            <div className="p-4 border-b border-slate-700">
              <h3 className="text-sm font-medium text-slate-200">
                {module_.primaryDimensionLabel.charAt(0).toUpperCase() +
                  module_.primaryDimensionLabel.slice(1)}{" "}
                {selectedLevel.label}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {childLocations.length} positions
              </p>
            </div>

            {/* Grid preview of child locations */}
            <div className="flex-1 flex items-center justify-center p-6">
              <GridPreview locations={childLocations} />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
            {selectedLevel.locationType === "receptacle" ? (
              <>
                <p className="text-slate-500 text-sm">
                  No insert placed. Place an insert to define this{" "}
                  {module_.primaryDimensionLabel}&apos;s internal structure.
                </p>
                <Link
                  href={`/modules/${id}/levels/${selectedLevel.id}/place-insert`}
                  className="px-4 py-2 bg-accent text-white rounded-md hover:brightness-110 transition-all text-sm"
                >
                  Place Insert
                </Link>
              </>
            ) : (
              <>
                <p className="text-slate-500 text-sm">
                  No structure defined. Apply a template to define this{" "}
                  {module_.primaryDimensionLabel}&apos;s layout.
                </p>
                <Link
                  href={`/modules/${id}/levels/${selectedLevel.id}/apply-template`}
                  className="px-4 py-2 bg-accent text-white rounded-md hover:brightness-110 transition-all text-sm"
                >
                  Apply Template
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GridPreview({ locations }: { locations: Location[] }) {
  // Determine grid bounds from locations that have grid positions
  const gridLocs = locations.filter(
    (l) => l.gridRow != null && l.gridColumn != null
  );

  if (gridLocs.length === 0) {
    // No grid positions — show as a simple list
    return (
      <div className="flex flex-col gap-1 w-full">
        {locations.map((l) => (
          <div
            key={l.id}
            className={`px-3 py-2 rounded border text-sm ${
              l.isDisabled
                ? "border-red-700/50 bg-red-900/20 text-red-300"
                : "border-slate-700 bg-slate-800/50 text-slate-200"
            }`}
          >
            {l.label}
          </div>
        ))}
      </div>
    );
  }

  const maxRow = Math.max(...gridLocs.map((l) => l.gridRow!));
  const maxCol = Math.max(...gridLocs.map((l) => l.gridColumn!));
  const cellSize = 52;
  const gap = 2;
  const labelPad = 24;

  const svgW = labelPad + (maxCol + 1) * (cellSize + gap) + 4;
  const svgH = labelPad + (maxRow + 1) * (cellSize + gap) + 4;

  // Build a lookup
  const grid = new Map<string, Location>();
  for (const l of gridLocs) {
    grid.set(`${l.gridRow},${l.gridColumn}`, l);
  }

  const cells = [];
  for (let r = 0; r <= maxRow; r++) {
    for (let c = 0; c <= maxCol; c++) {
      const loc = grid.get(`${r},${c}`);
      const x = labelPad + c * (cellSize + gap);
      const y = labelPad + r * (cellSize + gap);

      cells.push(
        <g key={`${r}-${c}`}>
          <rect
            x={x}
            y={y}
            width={cellSize}
            height={cellSize}
            fill={
              loc?.isDisabled ? "rgba(248,113,113,0.15)" : "transparent"
            }
            stroke={loc?.isDisabled ? "#7f1d1d" : "#475569"}
            strokeWidth={1}
            rx={2}
          />
          {loc && (
            <text
              x={x + cellSize / 2}
              y={y + cellSize / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill={loc.isDisabled ? "#f87171" : "#94a3b8"}
              fontSize={9}
            >
              {loc.label}
            </text>
          )}
        </g>
      );
    }
  }

  // Row labels
  const rowLabels = [];
  for (let r = 0; r <= maxRow; r++) {
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
        {String.fromCharCode(65 + r)}
      </text>
    );
  }

  // Column labels
  const colLabels = [];
  for (let c = 0; c <= maxCol; c++) {
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
        {c + 1}
      </text>
    );
  }

  return (
    <svg width={svgW} height={svgH} className="max-w-full">
      {cells}
      {rowLabels}
      {colLabels}
    </svg>
  );
}
