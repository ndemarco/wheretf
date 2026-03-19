"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useState, useMemo } from "react";

// --- Types ---

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

interface Assignment {
  id: string;
  itemId: string;
  locationId: string;
  assignmentType: "placed" | "provisional";
  metadata: Record<string, unknown> | null;
}

interface Item {
  id: string;
  name: string;
  description: string | null;
}

interface Insert {
  id: string;
  uid: string | null;
  name: string | null;
  templateId: string | null;
  locationId: string | null;
}

// --- Main Page ---

export default function ModuleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [module_, setModule] = useState<Module | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [items, setItems] = useState<Map<string, Item>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);

  // Inline editing
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Item picker
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [itemSearchResults, setItemSearchResults] = useState<Item[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

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
      const locs: Location[] = locData.locations || [];

      setModule(modData.module);
      setLocations(locs);
      setEditName(modData.module.name);
      setEditDesc(modData.module.description || "");

      // Fetch assignments for all leaf locations
      const leafIds = locs
        .filter(
          (l) =>
            l.gridRow != null && l.gridColumn != null && !l.isDisabled
        )
        .map((l) => l.id);

      if (leafIds.length > 0) {
        // Fetch assignments in batches by parent location
        const parentIds = [
          ...new Set(locs.filter((l) => l.parentId !== null).map((l) => l.parentId!)),
        ];
        // Also include top-level receptacles
        const topLevelIds = locs
          .filter((l) => l.parentId === null && l.locationType === "receptacle")
          .map((l) => l.id);
        const allParentIds = [...new Set([...parentIds, ...topLevelIds])];

        const assignmentPromises = allParentIds.map((pid) =>
          fetch(`/api/assignments?locationId=${pid}`).then((r) => r.json())
        );
        // Also fetch for each leaf
        const leafAssignmentPromises = leafIds.map((lid) =>
          fetch(`/api/assignments?locationId=${lid}`).then((r) => r.json())
        );

        const [parentResults, leafResults] = await Promise.all([
          Promise.all(assignmentPromises),
          Promise.all(leafAssignmentPromises),
        ]);

        const allAssignments: Assignment[] = [];
        const seen = new Set<string>();
        for (const result of [...parentResults, ...leafResults]) {
          for (const a of result.assignments || []) {
            if (!seen.has(a.id)) {
              seen.add(a.id);
              allAssignments.push(a);
            }
          }
        }
        setAssignments(allAssignments);

        // Fetch item details for all assigned items
        const itemIds = [...new Set(allAssignments.map((a) => a.itemId))];
        if (itemIds.length > 0) {
          const itemResults = await Promise.all(
            itemIds.map((iid) =>
              fetch(`/api/items/${iid}`).then((r) => r.json())
            )
          );
          const itemMap = new Map<string, Item>();
          for (const result of itemResults) {
            if (result.item) {
              itemMap.set(result.item.id, result.item);
            }
          }
          setItems(itemMap);
        }
      } else {
        setAssignments([]);
      }
    } catch (err) {
      console.error("Failed to fetch module:", err);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Top-level locations (levels)
  const levels = locations.filter((l) => l.parentId === null);
  const selectedLevel = levels.find((l) => l.id === selectedLevelId) || null;

  // Child locations of selected level
  const childLocations = selectedLevel
    ? locations.filter((l) => l.parentId === selectedLevel.id)
    : [];

  // Build assignment lookup by locationId
  const assignmentsByLocation = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of assignments) {
      const list = map.get(a.locationId) ?? [];
      list.push(a);
      map.set(a.locationId, list);
    }
    return map;
  }, [assignments]);

  // Count occupied cells per level
  const levelOccupancy = useMemo(() => {
    const map = new Map<string, { total: number; occupied: number }>();
    for (const level of levels) {
      const children = locations.filter((l) => l.parentId === level.id);
      const total = children.length;
      const occupied = children.filter(
        (c) => (assignmentsByLocation.get(c.id) ?? []).length > 0
      ).length;
      map.set(level.id, { total, occupied });
    }
    return map;
  }, [levels, locations, assignmentsByLocation]);

  // Selected cell detail
  const selectedCell = childLocations.find((l) => l.id === selectedCellId) || null;
  const selectedCellAssignments = selectedCell
    ? assignmentsByLocation.get(selectedCell.id) ?? []
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
    if (!confirm("Delete this module and all its locations?")) return;
    try {
      await fetch(`/api/modules/${id}`, { method: "DELETE" });
      router.push("/modules");
    } catch (err) {
      console.error(err);
    }
  }

  async function searchItems(query: string) {
    setItemSearchQuery(query);
    if (query.trim().length < 2) {
      setItemSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/items?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      setItemSearchResults(data.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setSearchLoading(false);
    }
  }

  async function assignItem(itemId: string) {
    if (!selectedCellId) return;
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          locationId: selectedCellId,
          assignmentType: "placed",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to assign item");
        return;
      }
      setShowItemPicker(false);
      setItemSearchQuery("");
      setItemSearchResults([]);
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  }

  async function unassignItem(assignmentId: string) {
    try {
      await fetch(`/api/assignments/${assignmentId}`, { method: "DELETE" });
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
      <div className="w-72 flex flex-col min-w-0 overflow-y-auto border-r border-slate-700 shrink-0">
        <div className="p-4 border-b border-slate-700">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
            className="text-lg font-semibold text-slate-100 bg-transparent border-b border-transparent hover:border-slate-600 focus:border-accent focus:outline-none w-full"
          />
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
              Delete
            </button>
          </div>
        </div>

        {/* Level list */}
        <div className="flex-1 overflow-y-auto">
          {levels.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">
              No levels found.
            </div>
          ) : (
            <div className="flex flex-col">
              {levels.map((level) => {
                const isSelected = level.id === selectedLevelId;
                const hasChildren = locations.some(
                  (l) => l.parentId === level.id
                );
                const occ = levelOccupancy.get(level.id);
                const notes =
                  level.metadata &&
                  typeof level.metadata === "object" &&
                  "notes" in level.metadata
                    ? (level.metadata as { notes: string }).notes
                    : null;

                return (
                  <button
                    key={level.id}
                    onClick={() => {
                      setSelectedLevelId(level.id);
                      setSelectedCellId(null);
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-slate-700/50 transition-colors ${
                      isSelected
                        ? "bg-slate-700/50"
                        : "hover:bg-slate-800/30"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-slate-100 font-medium text-sm">
                        {level.label}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          level.locationType === "receptacle"
                            ? "bg-blue-900/40 text-blue-300"
                            : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {level.locationType}
                      </span>
                      {level.isDisabled && (
                        <span className="text-[10px] text-red-400">disabled</span>
                      )}
                    </div>
                    {notes && (
                      <span className="block text-xs text-slate-500 mt-0.5">
                        {notes}
                      </span>
                    )}
                    {hasChildren && occ && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent/70 rounded-full transition-all"
                            style={{
                              width: occ.total > 0
                                ? `${(occ.occupied / occ.total) * 100}%`
                                : "0%",
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 tabular-nums">
                          {occ.occupied}/{occ.total}
                        </span>
                      </div>
                    )}
                    {!hasChildren && (
                      <span className="text-[10px] text-slate-600 mt-0.5 block">
                        No structure
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Center — Grid */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selectedLevel ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm px-6 text-center">
            Select a {module_.primaryDimensionLabel} to view its layout.
          </div>
        ) : childLocations.length > 0 ? (
          <>
            {/* Grid toolbar */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-700 bg-slate-800/30">
              <h3 className="text-sm font-medium text-slate-200">
                {module_.primaryDimensionLabel.charAt(0).toUpperCase() +
                  module_.primaryDimensionLabel.slice(1)}{" "}
                {selectedLevel.label}
              </h3>
              <span className="text-xs text-slate-500">
                {childLocations.length} positions
              </span>
              <div className="ml-auto flex items-center gap-2">
                <Link
                  href={`/modules/${id}/levels/${selectedLevel.id}/place-insert`}
                  className="text-xs px-2.5 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
                >
                  Place Insert
                </Link>
              </div>
            </div>

            {/* Grid */}
            <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
              <NavigatorGrid
                locations={childLocations}
                assignmentsByLocation={assignmentsByLocation}
                items={items}
                selectedCellId={selectedCellId}
                onCellClick={(cellId) => {
                  setSelectedCellId(cellId === selectedCellId ? null : cellId);
                  setShowItemPicker(false);
                }}
              />
            </div>
          </>
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
                  No structure defined for this{" "}
                  {module_.primaryDimensionLabel}.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Right Panel — Cell Detail */}
      {selectedCell && (
        <div className="w-80 flex flex-col shrink-0 border-l border-slate-700 bg-slate-800/20 overflow-y-auto">
          <div className="p-4 border-b border-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-200">
                Position {selectedCell.label}
              </h3>
              <button
                onClick={() => {
                  setSelectedCellId(null);
                  setShowItemPicker(false);
                }}
                className="text-slate-500 hover:text-slate-300 text-xs"
              >
                Close
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">{selectedCell.path}</p>
            {selectedCell.isDisabled && (
              <p className="text-xs text-red-400 mt-1">
                Disabled{selectedCell.disableReason && `: ${selectedCell.disableReason}`}
              </p>
            )}
          </div>

          {/* Assignments at this cell */}
          <div className="p-4">
            {selectedCellAssignments.length === 0 ? (
              <div className="text-center">
                <p className="text-sm text-slate-500 mb-3">
                  No items assigned.
                </p>
                {!selectedCell.isDisabled && (
                  <button
                    onClick={() => setShowItemPicker(true)}
                    className="px-3 py-1.5 bg-accent text-white rounded text-sm hover:brightness-110 transition-all"
                  >
                    Assign Item
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Assigned Items
                </h4>
                {selectedCellAssignments.map((assignment) => {
                  const item = items.get(assignment.itemId);
                  return (
                    <div
                      key={assignment.id}
                      className="p-3 rounded-md bg-slate-800/60 border border-slate-700"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm text-slate-200 font-medium">
                            {item?.name ?? "Unknown item"}
                          </p>
                          {item?.description && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ml-2 ${
                            assignment.assignmentType === "placed"
                              ? "bg-green-900/40 text-green-300"
                              : "bg-amber-900/40 text-amber-300"
                          }`}
                        >
                          {assignment.assignmentType}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => unassignItem(assignment.id)}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          Unassign
                        </button>
                      </div>
                    </div>
                  );
                })}
                {!selectedCell.isDisabled && (
                  <button
                    onClick={() => setShowItemPicker(true)}
                    className="w-full px-3 py-1.5 border border-dashed border-slate-600 text-slate-400 rounded text-xs hover:border-slate-500 hover:text-slate-300 transition-colors"
                  >
                    + Assign another item
                  </button>
                )}
              </div>
            )}

            {/* Item Picker */}
            {showItemPicker && (
              <div className="mt-4 border-t border-slate-700 pt-4">
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                  Search Items
                </h4>
                <input
                  type="text"
                  value={itemSearchQuery}
                  onChange={(e) => searchItems(e.target.value)}
                  placeholder="Search by name..."
                  autoFocus
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder:text-slate-500 focus:border-accent focus:outline-none"
                />
                <div className="mt-2 max-h-48 overflow-y-auto">
                  {searchLoading ? (
                    <p className="text-xs text-slate-500 py-2 text-center">
                      Searching...
                    </p>
                  ) : itemSearchResults.length > 0 ? (
                    <div className="space-y-1">
                      {itemSearchResults.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => assignItem(item.id)}
                          className="w-full text-left px-3 py-2 rounded hover:bg-slate-700/50 transition-colors"
                        >
                          <p className="text-sm text-slate-200">
                            {item.name}
                          </p>
                          {item.description && (
                            <p className="text-xs text-slate-500 line-clamp-1">
                              {item.description}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : itemSearchQuery.trim().length >= 2 ? (
                    <p className="text-xs text-slate-500 py-2 text-center">
                      No items found.
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 py-2 text-center">
                      Type at least 2 characters to search.
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowItemPicker(false);
                    setItemSearchQuery("");
                    setItemSearchResults([]);
                  }}
                  className="mt-2 text-xs text-slate-500 hover:text-slate-400"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Navigator Grid ---

function NavigatorGrid({
  locations,
  assignmentsByLocation,
  items,
  selectedCellId,
  onCellClick,
}: {
  locations: Location[];
  assignmentsByLocation: Map<string, Assignment[]>;
  items: Map<string, Item>;
  selectedCellId: string | null;
  onCellClick: (cellId: string) => void;
}) {
  const [hoveredCellId, setHoveredCellId] = useState<string | null>(null);

  const gridLocs = locations.filter(
    (l) => l.gridRow != null && l.gridColumn != null
  );

  if (gridLocs.length === 0) {
    return (
      <div className="flex flex-col gap-1 w-full max-w-sm">
        {locations.map((l) => {
          const cellAssignments = assignmentsByLocation.get(l.id) ?? [];
          const isOccupied = cellAssignments.length > 0;
          return (
            <button
              key={l.id}
              onClick={() => onCellClick(l.id)}
              className={`px-3 py-2 rounded border text-sm text-left transition-colors ${
                l.id === selectedCellId
                  ? "border-accent bg-accent/10 text-slate-200"
                  : l.isDisabled
                    ? "border-red-700/50 bg-red-900/20 text-red-300"
                    : isOccupied
                      ? "border-blue-700/50 bg-blue-900/20 text-slate-200"
                      : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
              }`}
            >
              <span className="font-medium">{l.label}</span>
              {isOccupied && (
                <span className="ml-2 text-xs text-blue-300">
                  {items.get(cellAssignments[0].itemId)?.name ?? "Item"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  const maxRow = Math.max(...gridLocs.map((l) => l.gridRow!));
  const maxCol = Math.max(...gridLocs.map((l) => l.gridColumn!));
  const cellSize = 56;
  const gap = 3;
  const labelPad = 28;

  const svgW = labelPad + (maxCol + 1) * (cellSize + gap) + 4;
  const svgH = labelPad + (maxRow + 1) * (cellSize + gap) + 4;

  const grid = new Map<string, Location>();
  for (const l of gridLocs) {
    grid.set(`${l.gridRow},${l.gridColumn}`, l);
  }

  const cells = [];
  for (let r = 0; r <= maxRow; r++) {
    for (let c = 0; c <= maxCol; c++) {
      const loc = grid.get(`${r},${c}`);
      if (!loc) continue;

      const x = labelPad + c * (cellSize + gap);
      const y = labelPad + r * (cellSize + gap);
      const cellAssignments = assignmentsByLocation.get(loc.id) ?? [];
      const isOccupied = cellAssignments.length > 0;
      const isSelected = loc.id === selectedCellId;
      const isHovered = loc.id === hoveredCellId;
      const isProvisional =
        isOccupied && cellAssignments[0].assignmentType === "provisional";

      let fillColor = "transparent";
      let strokeColor = "#475569";
      let strokeWidth = 1;

      if (loc.isDisabled) {
        fillColor = "rgba(248,113,113,0.12)";
        strokeColor = "#7f1d1d";
      } else if (isSelected) {
        fillColor = "rgba(255,102,0,0.12)";
        strokeColor = "#ff6600";
        strokeWidth = 2;
      } else if (isOccupied) {
        fillColor = isProvisional
          ? "rgba(251,191,36,0.1)"
          : "rgba(96,165,250,0.12)";
        strokeColor = isProvisional ? "#92400e" : "#1e40af";
      }

      if (isHovered && !isSelected) {
        strokeColor = "#ff6600";
        strokeWidth = 1.5;
      }

      const itemName = isOccupied
        ? items.get(cellAssignments[0].itemId)?.name
        : null;

      cells.push(
        <g
          key={loc.id}
          onClick={() => onCellClick(loc.id)}
          onMouseEnter={() => setHoveredCellId(loc.id)}
          onMouseLeave={() => setHoveredCellId(null)}
          className="cursor-pointer"
        >
          <rect
            x={x}
            y={y}
            width={cellSize}
            height={cellSize}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            rx={3}
          />
          {/* Disabled diagonal stripes */}
          {loc.isDisabled && (
            <>
              <line
                x1={x + 4}
                y1={y + cellSize - 4}
                x2={x + cellSize - 4}
                y2={y + 4}
                stroke="#7f1d1d"
                strokeWidth={0.5}
                opacity={0.4}
              />
              <line
                x1={x + 12}
                y1={y + cellSize - 4}
                x2={x + cellSize - 4}
                y2={y + 12}
                stroke="#7f1d1d"
                strokeWidth={0.5}
                opacity={0.4}
              />
              <line
                x1={x + 4}
                y1={y + cellSize - 12}
                x2={x + cellSize - 12}
                y2={y + 4}
                stroke="#7f1d1d"
                strokeWidth={0.5}
                opacity={0.4}
              />
            </>
          )}
          {/* Cell label */}
          <text
            x={x + cellSize / 2}
            y={isOccupied ? y + 14 : y + cellSize / 2}
            textAnchor="middle"
            dominantBaseline={isOccupied ? "auto" : "central"}
            fill={loc.isDisabled ? "#f87171" : "#64748b"}
            fontSize={9}
            fontWeight={isSelected ? 600 : 400}
          >
            {loc.label}
          </text>
          {/* Item name (truncated) */}
          {itemName && (
            <text
              x={x + cellSize / 2}
              y={y + cellSize / 2 + 4}
              textAnchor="middle"
              dominantBaseline="central"
              fill={isProvisional ? "#fbbf24" : "#93c5fd"}
              fontSize={8}
              className="select-none"
            >
              {itemName.length > 8
                ? itemName.substring(0, 7) + "…"
                : itemName}
            </text>
          )}
          {/* Occupancy dot */}
          {isOccupied && (
            <circle
              cx={x + cellSize - 7}
              cy={y + 7}
              r={3}
              fill={isProvisional ? "#fbbf24" : "#60a5fa"}
            />
          )}
        </g>
      );
    }
  }

  // Row labels
  const rowLabels = [];
  for (let r = 0; r <= maxRow; r++) {
    const loc = grid.get(`${r},0`);
    const labelChar = loc
      ? loc.label.charAt(0)
      : String.fromCharCode(65 + r);
    rowLabels.push(
      <text
        key={`rl-${r}`}
        x={labelPad - 8}
        y={labelPad + r * (cellSize + gap) + cellSize / 2}
        textAnchor="end"
        dominantBaseline="central"
        fill="#64748b"
        fontSize={11}
      >
        {labelChar}
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
        y={labelPad - 8}
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
