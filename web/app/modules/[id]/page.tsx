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
  interfaceTypeAccepted: string | null;
  isDisabled: boolean;
  disableReason: string | null;
  templateVersionId: string | null;
  insertId: string | null;
  gridRow: number | null;
  gridColumn: number | null;
  // Capacity clamps (Restrict override)
  maxWidthMm: string | null; // postgres numeric comes back as string
  maxHeightMm: string | null;
  maxDepthMm: string | null;
  restrictReason: string | null;
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
  templateName?: string | null;
  interfaceType?: string | null;
  locationId: string | null;
  locationPath?: string | null;
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

  // Right-panel edit mode (gates module + level editing)
  const [editingModule, setEditingModule] = useState(false);
  const [editingLevel, setEditingLevel] = useState(false);

  // Restrict-override draft (per selected cell)
  const [editingRestrict, setEditingRestrict] = useState(false);
  const [restrictDraft, setRestrictDraft] = useState<{
    maxWidthMm: string;
    maxHeightMm: string;
    maxDepthMm: string;
    reason: string;
  }>({ maxWidthMm: "", maxHeightMm: "", maxDepthMm: "", reason: "" });

  // Deletion dialog state (ML-2)
  const [deletingOpen, setDeletingOpen] = useState(false);
  const [deleteStats, setDeleteStats] = useState<{
    locationCount: number;
    levelCount: number;
    assignmentCount: number;
    insertCount: number;
  } | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [orphanAcknowledged, setOrphanAcknowledged] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Draft state for edits
  const [moduleDraft, setModuleDraft] = useState<{
    name: string;
    description: string;
  }>({ name: "", description: "" });
  const [levelDraft, setLevelDraft] = useState<{
    label: string;
    description: string;
  }>({ label: "", description: "" });

  // Inserts in this module (key: receptacle location id → insert)
  const [insertsByReceptacle, setInsertsByReceptacle] = useState<
    Map<string, Insert>
  >(new Map());

  // Item picker
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [itemSearchResults, setItemSearchResults] = useState<Item[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [modRes, locRes, insRes] = await Promise.all([
        fetch(`/api/modules/${id}`),
        fetch(`/api/locations?moduleId=${id}`),
        fetch(`/api/inserts?moduleId=${id}&placement=placed`),
      ]);

      if (!modRes.ok) {
        router.push("/modules");
        return;
      }

      const modData = await modRes.json();
      const locData = await locRes.json();
      const insData = await insRes.json();
      const locs: Location[] = locData.locations || [];
      const insertList: Insert[] = insData.inserts || [];
      const insMap = new Map<string, Insert>();
      for (const ins of insertList) {
        if (ins.locationId) insMap.set(ins.locationId, ins);
      }
      setInsertsByReceptacle(insMap);

      setModule(modData.module);
      setLocations(locs);
      setModuleDraft({
        name: modData.module.name,
        description: modData.module.description ?? "",
      });

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

  // MD-4: auto-select a level once data loads.
  // Prefer the last-selected level for this module from localStorage,
  // falling back to the first level.
  useEffect(() => {
    if (loading || levels.length === 0 || selectedLevelId) return;
    const stored = localStorage.getItem(`wheretf.module.${id}.selectedLevel`);
    const remembered = stored && levels.find((l) => l.id === stored);
    const target = remembered ?? levels[0];
    if (target) {
      selectLevel(target);
    }
    // selectLevel is stable-enough within a render; intentionally omitted
    // to avoid loops from its transitive dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, levels, selectedLevelId, id]);

  // Persist selected level per module
  useEffect(() => {
    if (!selectedLevelId) return;
    localStorage.setItem(
      `wheretf.module.${id}.selectedLevel`,
      selectedLevelId
    );
  }, [selectedLevelId, id]);

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

  async function saveModule() {
    if (!module_) return;
    const name = moduleDraft.name.trim();
    const description = moduleDraft.description.trim() || null;
    if (!name) return;
    const nameChanged = name !== module_.name;
    const descChanged = description !== (module_.description ?? null);
    if (!nameChanged && !descChanged) {
      setEditingModule(false);
      return;
    }
    try {
      await fetch(`/api/modules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      setEditingModule(false);
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  }

  function cancelModuleEdit() {
    if (!module_) return;
    setModuleDraft({
      name: module_.name,
      description: module_.description ?? "",
    });
    setEditingModule(false);
  }

  async function openDeleteDialog() {
    setDeletingOpen(true);
    setConfirmName("");
    setOrphanAcknowledged(false);
    setDeleteStats(null);
    try {
      const res = await fetch(`/api/modules/${id}/stats`);
      const data = await res.json();
      setDeleteStats(data.stats);
    } catch (err) {
      console.error(err);
    }
  }

  function closeDeleteDialog() {
    if (deleting) return;
    setDeletingOpen(false);
  }

  async function confirmDelete() {
    if (!module_) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/modules/${id}?cascade=true`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete module");
        setDeleting(false);
        return;
      }
      localStorage.removeItem(`wheretf.module.${id}.selectedLevel`);
      router.push("/modules");
    } catch (err) {
      console.error(err);
      setDeleting(false);
    }
  }

  async function saveLevel() {
    if (!selectedLevel) return;
    const label = levelDraft.label.trim();
    if (!label) return;
    const existingNotes =
      selectedLevel.metadata &&
      typeof selectedLevel.metadata === "object" &&
      "notes" in selectedLevel.metadata
        ? (selectedLevel.metadata as { notes?: string }).notes ?? ""
        : "";
    const newDesc = levelDraft.description.trim();
    const labelChanged = label !== selectedLevel.label;
    const descChanged = newDesc !== existingNotes;
    if (!labelChanged && !descChanged) {
      setEditingLevel(false);
      return;
    }
    try {
      const body: Record<string, unknown> = {};
      if (labelChanged) body.label = label;
      if (descChanged) {
        const nextMetadata = {
          ...(selectedLevel.metadata ?? {}),
          notes: newDesc || undefined,
        };
        if (!newDesc) delete (nextMetadata as { notes?: string }).notes;
        body.metadata = nextMetadata;
      }
      await fetch(`/api/locations/${selectedLevel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setEditingLevel(false);
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  }

  function cancelLevelEdit() {
    if (!selectedLevel) return;
    const notes =
      selectedLevel.metadata &&
      typeof selectedLevel.metadata === "object" &&
      "notes" in selectedLevel.metadata
        ? (selectedLevel.metadata as { notes?: string }).notes ?? ""
        : "";
    setLevelDraft({ label: selectedLevel.label, description: notes });
    setEditingLevel(false);
  }

  function selectLevel(level: Location | null) {
    setSelectedLevelId(level?.id ?? null);
    setSelectedCellId(null);
    setShowItemPicker(false);
    setEditingLevel(false);
    if (level) {
      const notes =
        level.metadata &&
        typeof level.metadata === "object" &&
        "notes" in level.metadata
          ? (level.metadata as { notes?: string }).notes ?? ""
          : "";
      setLevelDraft({ label: level.label, description: notes });
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

  async function disableCell() {
    if (!selectedCell) return;
    const reason =
      window.prompt(
        "Disable this location. Reason (optional):",
        selectedCell.disableReason ?? ""
      );
    if (reason === null) return; // cancelled
    try {
      const res = await fetch(
        `/api/locations/${selectedCell.id}/disable`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() || undefined }),
        }
      );
      if (res.status === 404) return handleStaleLocation();
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to disable location");
        return;
      }
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  }

  function openRestrict() {
    if (!selectedCell) return;
    setRestrictDraft({
      maxWidthMm: selectedCell.maxWidthMm ?? "",
      maxHeightMm: selectedCell.maxHeightMm ?? "",
      maxDepthMm: selectedCell.maxDepthMm ?? "",
      reason: selectedCell.restrictReason ?? "",
    });
    setEditingRestrict(true);
  }

  async function removeInsertFromLevel(insertId: string) {
    if (
      !confirm(
        "Remove this insert from the level? The insert and its contents stay together — it moves to the unplaced pool."
      )
    )
      return;
    try {
      const res = await fetch(`/api/inserts/${insertId}/place`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to remove insert");
        return;
      }
      setSelectedCellId(null);
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleStaleLocation() {
    alert(
      "This cell no longer exists on the server. Reloading the module."
    );
    setSelectedCellId(null);
    setEditingRestrict(false);
    await fetchData();
  }

  async function saveRestrict() {
    if (!selectedCell) return;
    const body = {
      maxWidthMm: restrictDraft.maxWidthMm.trim() || null,
      maxHeightMm: restrictDraft.maxHeightMm.trim() || null,
      maxDepthMm: restrictDraft.maxDepthMm.trim() || null,
      reason: restrictDraft.reason.trim() || null,
    };
    try {
      const res = await fetch(
        `/api/locations/${selectedCell.id}/restrict`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (res.status === 404) return handleStaleLocation();
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to save restriction");
        return;
      }
      setEditingRestrict(false);
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  }

  async function clearRestrict() {
    if (!selectedCell) return;
    try {
      const res = await fetch(
        `/api/locations/${selectedCell.id}/restrict`,
        { method: "DELETE" }
      );
      if (res.status === 404) return handleStaleLocation();
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to clear restriction");
        return;
      }
      setEditingRestrict(false);
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  }

  async function enableCell() {
    if (!selectedCell) return;
    try {
      const res = await fetch(
        `/api/locations/${selectedCell.id}/disable`,
        { method: "DELETE" }
      );
      if (res.status === 404) return handleStaleLocation();
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to enable location");
        return;
      }
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

  // Breadcrumb segments in brief display form (storage-model.md §Display Formats)
  // e.g. Modules › MUSE 3 / A1
  const breadcrumbTail = [
    module_.name + (selectedLevel ? ` ${selectedLevel.label}` : ""),
    selectedCell?.label,
  ].filter(Boolean) as string[];

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
      {/* Breadcrumb (GN-2) */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-slate-700 bg-slate-800/30 text-xs text-slate-400 shrink-0">
        <Link
          href="/modules"
          className="hover:text-accent transition-colors"
        >
          Modules
        </Link>
        {breadcrumbTail.length > 0 && (
          <>
            <span className="text-slate-600">›</span>
            <span className="text-slate-200">
              {breadcrumbTail.join(" / ")}
            </span>
          </>
        )}
      </div>

      <div className="flex-1 flex min-w-0 overflow-hidden">
      {/* Left Panel — Module Header (read-only) + Level Table */}
      <div className="w-72 flex flex-col min-w-0 overflow-y-auto border-r border-slate-700 shrink-0">
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-slate-100 truncate">
            {module_.name}
          </h2>
          {module_.description && (
            <p className="text-sm text-slate-400 mt-1 truncate">
              {module_.description}
            </p>
          )}
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
                    onClick={() => selectLevel(level)}
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
            {/* Grid toolbar — IN-3: show insert as first-class */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-700 bg-slate-800/30">
              <h3 className="text-sm font-medium text-slate-200">
                {module_.primaryDimensionLabel.charAt(0).toUpperCase() +
                  module_.primaryDimensionLabel.slice(1)}{" "}
                {selectedLevel.label}
              </h3>
              {(() => {
                const ins = insertsByReceptacle.get(selectedLevel.id);
                return (
                  <>
                    {ins ? (
                      <>
                        <span className="text-slate-600 text-xs">·</span>
                        <Link
                          href={`/inserts?selected=${ins.id}`}
                          className="text-sm text-slate-100 hover:text-accent transition-colors truncate"
                        >
                          {ins.name ?? "(unnamed insert)"}
                        </Link>
                        {ins.templateName && (
                          <span className="text-xs text-slate-500 truncate">
                            ({ins.templateName})
                          </span>
                        )}
                      </>
                    ) : null}
                    <span className="text-xs text-slate-500">
                      · {childLocations.length} positions
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      {ins ? (
                        <button
                          onClick={() => removeInsertFromLevel(ins.id)}
                          className="text-xs px-2.5 py-1 rounded border border-slate-600 text-slate-300 hover:bg-slate-700/50 transition-colors"
                        >
                          Remove insert
                        </button>
                      ) : (
                        <Link
                          href={`/modules/${id}/levels/${selectedLevel.id}/place-insert`}
                          className="text-xs px-2.5 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
                        >
                          Place Insert
                        </Link>
                      )}
                    </div>
                  </>
                );
              })()}
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

      {/* Right Panel — Cell / Level / Module detail */}
      <div className="w-80 flex flex-col shrink-0 border-l border-slate-700 bg-slate-800/20 overflow-y-auto">
      {selectedCell ? (
        <>
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

            {/* Overrides */}
            <div className="mt-4 pt-4 border-t border-slate-700 space-y-3">
              <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Overrides
              </h4>

              {selectedCell.insertId ? (
                <>
                  {/* Read-only summary when the cell belongs to an insert.
                      Structural overrides (disable / restrict / merge /
                      divide) live on the insert page. */}
                  {selectedCell.isDisabled && (
                    <div className="text-xs text-red-400">
                      Disabled
                      {selectedCell.disableReason &&
                        `: ${selectedCell.disableReason}`}
                    </div>
                  )}
                  {(selectedCell.maxWidthMm ||
                    selectedCell.maxHeightMm ||
                    selectedCell.maxDepthMm) && (
                    <div className="text-xs text-amber-300">
                      Restricted:{" "}
                      {[
                        selectedCell.maxWidthMm &&
                          `W≤${selectedCell.maxWidthMm}mm`,
                        selectedCell.maxHeightMm &&
                          `H≤${selectedCell.maxHeightMm}mm`,
                        selectedCell.maxDepthMm &&
                          `D≤${selectedCell.maxDepthMm}mm`,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  )}
                  <Link
                    href={`/inserts?selected=${selectedCell.insertId}`}
                    className="block text-center w-full px-3 py-1.5 border border-accent/60 text-accent rounded text-xs hover:bg-accent/10 transition-colors"
                  >
                    Edit layout on insert →
                  </Link>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    This cell is part of an insert. Structure changes
                    (merge, divide, disable, restrict) travel with the
                    insert and are edited on its page.
                  </p>
                </>
              ) : (
                /* Module-owned cell: full structural editing stays */
                <>
                  {selectedCell.isDisabled ? (
                    <div className="space-y-2">
                      <div className="text-xs text-red-400">
                        Disabled
                        {selectedCell.disableReason &&
                          `: ${selectedCell.disableReason}`}
                      </div>
                      <button
                        onClick={enableCell}
                        className="w-full px-3 py-1.5 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50 transition-colors"
                      >
                        Enable
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={disableCell}
                      disabled={selectedCellAssignments.length > 0}
                      title={
                        selectedCellAssignments.length > 0
                          ? "Unassign items before disabling this location"
                          : undefined
                      }
                      className="w-full px-3 py-1.5 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Disable…
                    </button>
                  )}

              {/* Restrict */}
              {editingRestrict ? (
                <div className="space-y-2 p-2 rounded bg-slate-800/60 border border-slate-700">
                  <div className="text-xs text-slate-400">
                    Clamp usable capacity (mm). Leave blank for no clamp.
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <label className="text-[10px] text-slate-500 flex flex-col gap-0.5">
                      Max W
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={restrictDraft.maxWidthMm}
                        onChange={(e) =>
                          setRestrictDraft({
                            ...restrictDraft,
                            maxWidthMm: e.target.value,
                          })
                        }
                        className="px-1.5 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 focus:border-accent focus:outline-none tabular-nums"
                      />
                    </label>
                    <label className="text-[10px] text-slate-500 flex flex-col gap-0.5">
                      Max H
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={restrictDraft.maxHeightMm}
                        onChange={(e) =>
                          setRestrictDraft({
                            ...restrictDraft,
                            maxHeightMm: e.target.value,
                          })
                        }
                        className="px-1.5 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 focus:border-accent focus:outline-none tabular-nums"
                      />
                    </label>
                    <label className="text-[10px] text-slate-500 flex flex-col gap-0.5">
                      Max D
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={restrictDraft.maxDepthMm}
                        onChange={(e) =>
                          setRestrictDraft({
                            ...restrictDraft,
                            maxDepthMm: e.target.value,
                          })
                        }
                        className="px-1.5 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 focus:border-accent focus:outline-none tabular-nums"
                      />
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="Reason (optional)"
                    value={restrictDraft.reason}
                    onChange={(e) =>
                      setRestrictDraft({
                        ...restrictDraft,
                        reason: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 focus:border-accent focus:outline-none placeholder:text-slate-600"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveRestrict}
                      className="px-2.5 py-1 bg-accent text-white rounded text-xs hover:brightness-110 transition-all"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingRestrict(false)}
                      className="px-2.5 py-1 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50 transition-colors"
                    >
                      Cancel
                    </button>
                    {(selectedCell.maxWidthMm ||
                      selectedCell.maxHeightMm ||
                      selectedCell.maxDepthMm) && (
                      <button
                        onClick={clearRestrict}
                        className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              ) : selectedCell.maxWidthMm ||
                selectedCell.maxHeightMm ||
                selectedCell.maxDepthMm ? (
                <div className="space-y-1">
                  <div className="text-xs text-amber-300">
                    Restricted:{" "}
                    {[
                      selectedCell.maxWidthMm &&
                        `W≤${selectedCell.maxWidthMm}mm`,
                      selectedCell.maxHeightMm &&
                        `H≤${selectedCell.maxHeightMm}mm`,
                      selectedCell.maxDepthMm &&
                        `D≤${selectedCell.maxDepthMm}mm`,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                  {selectedCell.restrictReason && (
                    <div className="text-[11px] text-slate-500">
                      {selectedCell.restrictReason}
                    </div>
                  )}
                  <button
                    onClick={openRestrict}
                    className="w-full px-3 py-1.5 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50 transition-colors"
                  >
                    Edit restriction
                  </button>
                </div>
              ) : (
                <button
                  onClick={openRestrict}
                  className="w-full px-3 py-1.5 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50 transition-colors"
                >
                  Restrict dimensions…
                </button>
              )}
                </>
              )}
            </div>

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
        </>
      ) : selectedLevel ? (
        <LevelPanel
          level={selectedLevel}
          editing={editingLevel}
          draft={levelDraft}
          setDraft={setLevelDraft}
          onEdit={() => setEditingLevel(true)}
          onSave={saveLevel}
          onCancel={cancelLevelEdit}
          onClose={() => selectLevel(null)}
        />
      ) : (
        <ModulePanel
          module_={module_}
          levelCount={levels.length}
          editing={editingModule}
          draft={moduleDraft}
          setDraft={setModuleDraft}
          onEdit={() => setEditingModule(true)}
          onSave={saveModule}
          onCancel={cancelModuleEdit}
          onDelete={openDeleteDialog}
        />
      )}
      </div>
      </div>

      {deletingOpen && (
        <DeleteModuleDialog
          moduleName={module_.name}
          stats={deleteStats}
          confirmName={confirmName}
          setConfirmName={setConfirmName}
          orphanAcknowledged={orphanAcknowledged}
          setOrphanAcknowledged={setOrphanAcknowledged}
          onClose={closeDeleteDialog}
          onConfirm={confirmDelete}
          deleting={deleting}
        />
      )}
    </div>
  );
}

// --- Delete Module Dialog (GitHub-repo pattern) ---

function DeleteModuleDialog({
  moduleName,
  stats,
  confirmName,
  setConfirmName,
  orphanAcknowledged,
  setOrphanAcknowledged,
  onClose,
  onConfirm,
  deleting,
}: {
  moduleName: string;
  stats: {
    locationCount: number;
    levelCount: number;
    assignmentCount: number;
    insertCount: number;
  } | null;
  confirmName: string;
  setConfirmName: (v: string) => void;
  orphanAcknowledged: boolean;
  setOrphanAcknowledged: (v: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  const hasContents =
    !!stats &&
    (stats.assignmentCount > 0 ||
      stats.insertCount > 0 ||
      stats.locationCount > 0);
  const orphanRequired =
    !!stats && (stats.assignmentCount > 0 || stats.insertCount > 0);
  const nameMatches = confirmName === moduleName;
  const canDelete =
    !!stats &&
    nameMatches &&
    (!orphanRequired || orphanAcknowledged) &&
    !deleting;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-md flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-base font-semibold text-red-300">
            Delete module
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            This action cannot be undone from the UI.
          </p>
        </div>

        <div className="p-4 space-y-4">
          {!stats ? (
            <p className="text-sm text-slate-400">Loading contents…</p>
          ) : (
            <>
              {hasContents ? (
                <div className="space-y-2">
                  <p className="text-sm text-slate-300">
                    <span className="font-semibold text-slate-100">
                      {moduleName}
                    </span>{" "}
                    contains:
                  </p>
                  <ul className="text-sm text-slate-400 space-y-0.5 pl-4 list-disc">
                    {stats.levelCount > 0 && (
                      <li>
                        {stats.levelCount}{" "}
                        {stats.levelCount === 1 ? "level" : "levels"}
                      </li>
                    )}
                    {stats.locationCount > 0 && (
                      <li>
                        {stats.locationCount} total{" "}
                        {stats.locationCount === 1
                          ? "location"
                          : "locations"}
                      </li>
                    )}
                    {stats.insertCount > 0 && (
                      <li>
                        {stats.insertCount}{" "}
                        {stats.insertCount === 1
                          ? "insert placed"
                          : "inserts placed"}{" "}
                        (will be unplaced)
                      </li>
                    )}
                    {stats.assignmentCount > 0 && (
                      <li>
                        {stats.assignmentCount}{" "}
                        {stats.assignmentCount === 1
                          ? "assignment"
                          : "assignments"}{" "}
                        (items will become unassigned)
                      </li>
                    )}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  This module is empty.
                </p>
              )}

              {orphanRequired && (
                <label className="flex items-start gap-2 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={orphanAcknowledged}
                    onChange={(e) =>
                      setOrphanAcknowledged(e.target.checked)
                    }
                    className="mt-0.5 accent-red-500"
                  />
                  <span>
                    I understand that items and inserts in this module will
                    be orphaned. Assignments will be removed; inserts will
                    be unplaced.
                  </span>
                </label>
              )}

              <div>
                <label className="text-xs text-slate-500 block mb-1">
                  Type{" "}
                  <span className="font-mono text-slate-300">
                    {moduleName}
                  </span>{" "}
                  to confirm
                </label>
                <input
                  type="text"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  autoFocus
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:border-red-500 focus:outline-none font-mono"
                />
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t border-slate-700 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={deleting}
            className="px-3 py-1.5 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canDelete}
            className="px-3 py-1.5 bg-red-600 text-white rounded text-xs hover:bg-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {deleting ? "Deleting…" : "Delete module"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Module Panel (right) ---

function ModulePanel({
  module_,
  levelCount,
  editing,
  draft,
  setDraft,
  onEdit,
  onSave,
  onCancel,
  onDelete,
}: {
  module_: Module;
  levelCount: number;
  editing: boolean;
  draft: { name: string; description: string };
  setDraft: (v: { name: string; description: string }) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-200">Module</h3>
          {!editing && (
            <button
              onClick={onEdit}
              className="text-xs text-slate-400 hover:text-accent transition-colors"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {editing ? (
          <>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Name</label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) =>
                  setDraft({ ...draft, name: e.target.value })
                }
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">
                Description
              </label>
              <textarea
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
                rows={3}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:border-accent focus:outline-none resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onSave}
                className="px-3 py-1.5 bg-accent text-white rounded text-xs hover:brightness-110 transition-all"
              >
                Save
              </button>
              <button
                onClick={onCancel}
                className="px-3 py-1.5 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onDelete}
                className="ml-auto px-3 py-1.5 border border-red-900/60 text-red-400 rounded text-xs hover:bg-red-900/20 transition-colors"
              >
                Delete…
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <div className="text-xs text-slate-500">Name</div>
              <div className="text-sm text-slate-100">{module_.name}</div>
            </div>
            {module_.description && (
              <div>
                <div className="text-xs text-slate-500">Description</div>
                <div className="text-sm text-slate-300 whitespace-pre-wrap">
                  {module_.description}
                </div>
              </div>
            )}
            <div>
              <div className="text-xs text-slate-500">Primary dimension</div>
              <div className="text-sm text-slate-300">
                {module_.primaryDimensionLabel} ({levelCount})
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// --- Level Panel (right) ---

function LevelPanel({
  level,
  editing,
  draft,
  setDraft,
  onEdit,
  onSave,
  onCancel,
  onClose,
}: {
  level: Location;
  editing: boolean;
  draft: { label: string; description: string };
  setDraft: (v: { label: string; description: string }) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-200">
            Level {level.label}
          </h3>
          <div className="flex items-center gap-3">
            {!editing && (
              <button
                onClick={onEdit}
                className="text-xs text-slate-400 hover:text-accent transition-colors"
              >
                Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-300 text-xs"
            >
              Close
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-1">{level.path}</p>
      </div>

      <div className="p-4 space-y-4">
        {editing ? (
          <>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Label</label>
              <input
                type="text"
                value={draft.label}
                onChange={(e) =>
                  setDraft({ ...draft, label: e.target.value })
                }
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">
                Notes
              </label>
              <textarea
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
                rows={3}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:border-accent focus:outline-none resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={onSave}
                className="px-3 py-1.5 bg-accent text-white rounded text-xs hover:brightness-110 transition-all"
              >
                Save
              </button>
              <button
                onClick={onCancel}
                className="px-3 py-1.5 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <div className="text-xs text-slate-500">Label</div>
              <div className="text-sm text-slate-100">{level.label}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Type</div>
              <div className="text-sm text-slate-300">
                {level.locationType}
                {level.interfaceTypeAccepted &&
                  ` · accepts ${level.interfaceTypeAccepted}`}
              </div>
            </div>
            {level.metadata &&
              typeof level.metadata === "object" &&
              "notes" in level.metadata &&
              typeof (level.metadata as { notes?: string }).notes ===
                "string" && (
                <div>
                  <div className="text-xs text-slate-500">Notes</div>
                  <div className="text-sm text-slate-300 whitespace-pre-wrap">
                    {(level.metadata as { notes: string }).notes}
                  </div>
                </div>
              )}
          </>
        )}
      </div>
    </>
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
