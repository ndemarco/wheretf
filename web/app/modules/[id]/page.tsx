"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useState, useMemo } from "react";
import Spinner from "../../components/Spinner";
import { CellGrid } from "@/app/_components/CellGrid";

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
  interfacesAccepted: Array<{ id: string; identifier: string }>;
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
  // Override + subdivision tracking (used by CellGrid renderer)
  mergedIntoId: string | null;
  subdivisionSource: string | null;
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
  interfaceTypes?: Array<{ id: string; identifier: string }>;
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
    /** interface_types.id (UUID); empty string = none. Single-select for now. */
    interfaceTypeId: string;
  }>({ label: "", description: "", interfaceTypeId: "" });

  // Available interface types (for the receptacle dropdown in level edit)
  const [interfaceOptions, setInterfaceOptions] = useState<
    Array<{ id: string; identifier: string; description: string | null }>
  >([]);

  // Inline rename for the selected level's label (pencil on center header)
  const [renamingLevel, setRenamingLevel] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");

  // Inserts in this module (key: receptacle location id → insert)
  const [insertsByReceptacle, setInsertsByReceptacle] = useState<
    Map<string, Insert>
  >(new Map());

  // Compatible inserts for the selected (empty) level
  const [candidateInserts, setCandidateInserts] = useState<
    Array<{
      id: string;
      name: string | null;
      templateId: string | null;
      templateName: string | null;
      interfaceTypes: Array<{ id: string; identifier: string }>;
      rows: number | null;
      columns: number | null;
    }>
  >([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesShowAll, setCandidatesShowAll] = useState(false);
  const [placingInsert, setPlacingInsert] = useState(false);

  // Compatible templates (for the Create-new-insert sub-flow)
  const [candidateTemplates, setCandidateTemplates] = useState<
    Array<{
      id: string;
      name: string;
      currentVersionData: {
        id: string;
        isParametric: boolean;
        rows: number | null;
        columns: number | null;
        minRows: number | null;
        maxRows: number | null;
        minColumns: number | null;
        maxColumns: number | null;
        interfacesProvided: Array<{ id: string; identifier: string }>;
      } | null;
    }>
  >([]);

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

  // Load interface types once for the level edit dropdown
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/interface-types?status=active");
        const data = await res.json();
        setInterfaceOptions(data.interfaceTypes ?? []);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  // Candidate inserts/templates for the currently-selected empty level.
  // Refetched whenever selection, placement status, or the show-all toggle
  // changes.
  useEffect(() => {
    const level = locations.find((l) => l.id === selectedLevelId) ?? null;
    if (!level || level.locationType !== "receptacle") {
      setCandidateInserts([]);
      setCandidateTemplates([]);
      return;
    }
    // Don't bother loading when the level already has an insert.
    const alreadyHolds = insertsByReceptacle.has(level.id);
    if (alreadyHolds) {
      setCandidateInserts([]);
      setCandidateTemplates([]);
      return;
    }
    // Level can accept multiple interfaces; use the first as the filter
    // for candidate inserts/templates (single-select UI today).
    const iface = level.interfacesAccepted[0]?.id ?? null;
    setCandidatesLoading(true);
    (async () => {
      try {
        const qs = new URLSearchParams({
          placement: candidatesShowAll ? "all" : "unplaced",
        });
        if (iface) qs.set("interfaceTypeId", iface);
        const [insRes, tplRes] = await Promise.all([
          fetch(`/api/inserts?${qs}`),
          fetch("/api/templates"),
        ]);
        const insData = await insRes.json();
        const tplData = await tplRes.json();
        setCandidateInserts(
          (insData.inserts ?? []).filter(
            (i: { locationId?: string | null }) => i.locationId !== level.id
          )
        );
        const allT = tplData.templates ?? [];
        setCandidateTemplates(
          iface
            ? allT.filter(
                (t: {
                  currentVersionData?: {
                    interfacesProvided?: Array<{ id: string }>;
                  } | null;
                }) =>
                  (t.currentVersionData?.interfacesProvided ?? []).some(
                    (p) => p.id === iface,
                  )
              )
            : allT
        );
      } catch (err) {
        console.error(err);
      } finally {
        setCandidatesLoading(false);
      }
    })();
  }, [
    selectedLevelId,
    locations,
    insertsByReceptacle,
    candidatesShowAll,
  ]);

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
    const newIface = levelDraft.interfaceTypeId.trim() || null;
    const currentIface = selectedLevel.interfacesAccepted[0]?.id ?? null;
    const labelChanged = label !== selectedLevel.label;
    const descChanged = newDesc !== existingNotes;
    const ifaceChanged = newIface !== currentIface;
    if (!labelChanged && !descChanged && !ifaceChanged) {
      setEditingLevel(false);
      return;
    }
    try {
      const body: Record<string, unknown> = {};
      if (labelChanged) body.label = label;
      if (ifaceChanged) {
        body.interfacesAcceptedIds = newIface ? [newIface] : [];
      }
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
    setLevelDraft({
      label: selectedLevel.label,
      description: notes,
      interfaceTypeId: selectedLevel.interfacesAccepted[0]?.id ?? "",
    });
    setEditingLevel(false);
  }

  function selectLevel(level: Location | null) {
    setSelectedLevelId(level?.id ?? null);
    setSelectedCellId(null);
    setShowItemPicker(false);
    setEditingLevel(false);
    setRenamingLevel(false);
    if (level) {
      const notes =
        level.metadata &&
        typeof level.metadata === "object" &&
        "notes" in level.metadata
          ? (level.metadata as { notes?: string }).notes ?? ""
          : "";
      setLevelDraft({
        label: level.label,
        description: notes,
        interfaceTypeId: level.interfacesAccepted[0]?.id ?? "",
      });
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

  function startRenameLevel() {
    if (!selectedLevel) return;
    setRenameDraft(selectedLevel.label);
    setRenamingLevel(true);
  }

  async function saveRenameLevel() {
    if (!selectedLevel) return;
    const next = renameDraft.trim();
    if (!next || next === selectedLevel.label) {
      setRenamingLevel(false);
      return;
    }
    try {
      const r = await fetch(`/api/locations/${selectedLevel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: next }),
      });
      if (!r.ok) {
        const d = await r.json();
        alert(d.error || "Rename failed");
        return;
      }
      setRenamingLevel(false);
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  }

  async function disableLevel() {
    if (!selectedLevel) return;
    const reason =
      window.prompt(
        "Disable this level. Reason (optional):",
        selectedLevel.disableReason ?? ""
      );
    if (reason === null) return;
    try {
      const r = await fetch(
        `/api/locations/${selectedLevel.id}/disable`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() || undefined }),
        }
      );
      if (!r.ok) {
        const d = await r.json();
        alert(d.error || "Failed to disable level");
        return;
      }
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  }

  async function enableLevel() {
    if (!selectedLevel) return;
    try {
      await fetch(`/api/locations/${selectedLevel.id}/disable`, {
        method: "DELETE",
      });
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  }

  async function placeInsertAtLevel(insertId: string) {
    if (!selectedLevel) return;
    setPlacingInsert(true);
    try {
      const r = await fetch(`/api/inserts/${insertId}/place`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: selectedLevel.id }),
      });
      if (!r.ok) {
        const d = await r.json();
        alert(d.error || "Place failed");
        return;
      }
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setPlacingInsert(false);
    }
  }

  async function createAndPlaceAtLevel(args: {
    templateId: string;
    templateVersionId: string;
    name?: string;
    rows?: number;
    columns?: number;
  }) {
    if (!selectedLevel) return;
    setPlacingInsert(true);
    try {
      const cRes = await fetch("/api/inserts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      if (!cRes.ok) {
        const d = await cRes.json();
        alert(d.error || "Create failed");
        return;
      }
      const cData = await cRes.json();
      const pRes = await fetch(`/api/inserts/${cData.insert.id}/place`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: selectedLevel.id }),
      });
      if (!pRes.ok) {
        const d = await pRes.json();
        alert(d.error || "Place failed after create");
        return;
      }
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setPlacingInsert(false);
    }
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
      <div className="flex-1 flex items-center justify-center text-accent">
        <Spinner size={32} />
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
      <div className="w-72 flex flex-col min-w-0 overflow-hidden border-r border-slate-700 shrink-0">
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
                    {(() => {
                      const ins = insertsByReceptacle.get(level.id);
                      // Badge: insert name when filled; interface type when
                      // empty receptacle; locationType for non-receptacles.
                      let badgeText: string;
                      let badgeClass: string;
                      if (ins) {
                        badgeText = ins.name ?? ins.templateName ?? "insert";
                        badgeClass = "bg-slate-700 text-slate-100";
                      } else if (level.locationType === "receptacle") {
                        badgeText =
                          level.interfacesAccepted
                            .map((i) => i.identifier)
                            .join(", ") || "empty";
                        badgeClass = "bg-blue-900/40 text-blue-300";
                      } else {
                        badgeText = level.locationType;
                        badgeClass = "bg-slate-700 text-slate-300";
                      }
                      return (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-100 font-medium text-sm">
                            {level.label}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded truncate max-w-[140px] ${badgeClass}`}
                          >
                            {badgeText}
                          </span>
                          {level.isDisabled && (
                            <span className="text-[10px] text-red-400">
                              disabled
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    {notes && (
                      <span className="block text-xs text-slate-500 mt-0.5">
                        {notes}
                      </span>
                    )}
                    {hasChildren && occ && occ.total > 0 && (
                      <div className="mt-1 text-right">
                        <span className="text-[10px] text-slate-500 tabular-nums">
                          {Math.round((occ.occupied / occ.total) * 100)}%{" "}
                          <span className="text-slate-600">
                            ({occ.occupied}/{occ.total})
                          </span>
                        </span>
                      </div>
                    )}
                    {!hasChildren && (
                      <span className="text-[10px] text-slate-600 mt-0.5 block">
                        {level.locationType === "receptacle"
                          ? "empty"
                          : "no subdivisions"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {/* Module-wide utilization footer (Google-Drive style) */}
        {(() => {
          let total = 0;
          let occupied = 0;
          for (const [, occ] of levelOccupancy) {
            total += occ.total;
            occupied += occ.occupied;
          }
          if (total === 0) return null;
          const pct = Math.round((occupied / total) * 100);
          return (
            <div className="shrink-0 border-t border-slate-700 px-4 py-2 text-[11px] text-slate-400 flex items-center justify-between">
              <span className="text-slate-500">Module utilization</span>
              <span className="tabular-nums">
                {pct}%{" "}
                <span className="text-slate-600">
                  ({occupied}/{total})
                </span>
              </span>
            </div>
          );
        })()}
      </div>

      {/* Center — Level header + Grid */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selectedLevel ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm px-6 text-center">
            Select a {module_.primaryDimensionLabel} to view its layout.
          </div>
        ) : (
          <>
            {/* Prominent level header (matches insert detail header style) */}
            <div className="px-6 py-4 border-b border-slate-700 shrink-0 space-y-2">
              {renamingLevel ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRenameLevel();
                      if (e.key === "Escape") setRenamingLevel(false);
                    }}
                    autoFocus
                    className="flex-1 text-lg font-semibold text-slate-100 bg-slate-800 border border-slate-600 rounded px-2 py-1 focus:border-accent focus:outline-none"
                  />
                  <button
                    onClick={saveRenameLevel}
                    className="px-3 py-1 bg-accent text-white rounded text-xs hover:brightness-110"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setRenamingLevel(false)}
                    className="px-3 py-1 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                (() => {
                  const ins = insertsByReceptacle.get(selectedLevel.id);
                  const insertName =
                    ins?.name ?? ins?.templateName ?? null;
                  return (
                    <div className="flex items-center gap-2 group/title">
                      <h2 className="text-lg font-semibold text-slate-100 truncate flex-1">
                        {selectedLevel.label}
                        {insertName && (
                          <>
                            <span className="text-slate-500 mx-2">/</span>
                            {ins ? (
                              <Link
                                href={`/inserts?selected=${ins.id}`}
                                className="text-slate-100 hover:text-accent transition-colors"
                              >
                                {insertName}
                              </Link>
                            ) : (
                              insertName
                            )}
                          </>
                        )}
                      </h2>
                      <button
                        onClick={startRenameLevel}
                        title="Rename level"
                        aria-label="Rename level"
                        className="opacity-0 group-hover/title:opacity-100 focus:opacity-100 text-slate-400 hover:text-accent transition-opacity"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          className="w-4 h-4"
                        >
                          <path d="M12 20h9" strokeLinecap="round" />
                          <path
                            d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </div>
                  );
                })()
              )}
              {/* Sub-header: only status signals that matter (disabled,
                  empty receptacle interface). Type and position count
                  live in the right panel + left level list. */}
              {(() => {
                const ins = insertsByReceptacle.get(selectedLevel.id);
                const bits: React.ReactNode[] = [];
                if (selectedLevel.isDisabled) {
                  bits.push(
                    <span key="dis" className="text-red-400">
                      disabled
                      {selectedLevel.disableReason &&
                        `: ${selectedLevel.disableReason}`}
                    </span>
                  );
                }
                if (
                  !ins &&
                  selectedLevel.locationType === "receptacle" &&
                  selectedLevel.interfacesAccepted.length > 0
                ) {
                  bits.push(
                    <span key="iface" className="text-blue-300">
                      empty / accepts{" "}
                      {selectedLevel.interfacesAccepted
                        .map((i) => i.identifier)
                        .join(", ")}
                    </span>
                  );
                }
                if (bits.length === 0) return null;
                return (
                  <div className="flex items-center gap-3 text-xs">
                    {bits}
                  </div>
                );
              })()}
            </div>
            {childLocations.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
                {selectedLevel.locationType === "receptacle" ? (
                  <p className="text-slate-500 text-sm">
                    No insert placed.
                  </p>
                ) : (
                  <p className="text-slate-500 text-sm">
                    No structure defined for this{" "}
                    {module_.primaryDimensionLabel}.
                  </p>
                )}
              </div>
            ) : (
              <>

                {/* Grid */}
                <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
                  <CellGrid
                    cells={childLocations}
                    assignments={assignments.filter((a) =>
                      childLocations.some((c) => c.id === a.locationId)
                    )}
                    itemsById={items}
                    selectedCellId={selectedCellId}
                    onCellClick={(cellId) => {
                      setSelectedCellId(
                        cellId === selectedCellId ? null : cellId
                      );
                      setShowItemPicker(false);
                    }}
                  />
                </div>
              </>
            )}
          </>
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
          interfaceOptions={interfaceOptions}
          insert={insertsByReceptacle.get(selectedLevel.id) ?? null}
          candidateInserts={candidateInserts}
          candidateTemplates={candidateTemplates}
          candidatesLoading={candidatesLoading}
          candidatesShowAll={candidatesShowAll}
          setCandidatesShowAll={setCandidatesShowAll}
          placingInsert={placingInsert}
          onEdit={() => setEditingLevel(true)}
          onSave={saveLevel}
          onCancel={cancelLevelEdit}
          onRemoveInsert={removeInsertFromLevel}
          onPlaceInsertHere={placeInsertAtLevel}
          onCreateAndPlace={createAndPlaceAtLevel}
          onDisableLevel={disableLevel}
          onEnableLevel={enableLevel}
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

interface CandidateInsert {
  id: string;
  name: string | null;
  templateId: string | null;
  templateName: string | null;
  interfaceTypes: Array<{ id: string; identifier: string }>;
  rows: number | null;
  columns: number | null;
}

interface CandidateTemplate {
  id: string;
  name: string;
  currentVersionData: {
    id: string;
    isParametric: boolean;
    rows: number | null;
    columns: number | null;
    minRows: number | null;
    maxRows: number | null;
    minColumns: number | null;
    maxColumns: number | null;
    interfacesProvided: Array<{ id: string; identifier: string }>;
  } | null;
}

function PlaceInsertInline({
  level,
  inserts,
  templates,
  loading,
  showAll,
  setShowAll,
  placing,
  onPlace,
  onCreateAndPlace,
}: {
  level: Location;
  inserts: CandidateInsert[];
  templates: CandidateTemplate[];
  loading: boolean;
  showAll: boolean;
  setShowAll: (v: boolean) => void;
  placing: boolean;
  onPlace: (insertId: string) => void;
  onCreateAndPlace: (args: {
    templateId: string;
    templateVersionId: string;
    name?: string;
    rows?: number;
    columns?: number;
  }) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [newTemplateId, setNewTemplateId] = useState("");
  const [newName, setNewName] = useState("");
  const [newRows, setNewRows] = useState<number | "">("");
  const [newCols, setNewCols] = useState<number | "">("");
  const [pendingInsertId, setPendingInsertId] = useState<string | null>(null);

  // Reset pending selection when the level or its insert list changes
  useEffect(() => {
    setPendingInsertId(null);
  }, [level.id, inserts.length]);
  const selectedTpl = templates.find((t) => t.id === newTemplateId);
  const ver = selectedTpl?.currentVersionData ?? null;
  useEffect(() => {
    if (!ver) {
      setNewRows("");
      setNewCols("");
      return;
    }
    if (ver.isParametric) {
      setNewRows(ver.minRows ?? 1);
      setNewCols(ver.minColumns ?? 1);
    } else {
      setNewRows(ver.rows ?? 1);
      setNewCols(ver.columns ?? 1);
    }
  }, [newTemplateId, ver]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">No insert placed.</div>
        <label className="flex items-center gap-1 text-[11px] text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="accent-accent"
          />
          Show placed
        </label>
      </div>

      {loading ? (
        <div className="text-xs text-slate-500">Loading…</div>
      ) : inserts.length === 0 ? (
        <div className="text-xs text-slate-500">
          No compatible {showAll ? "" : "unplaced "}inserts
          {level.interfacesAccepted.length > 0
            ? ` for ${level.interfacesAccepted.map((i) => i.identifier).join(", ")}.`
            : "."}
        </div>
      ) : (
        <ul className="flex flex-col gap-1 max-h-60 overflow-y-auto">
          {inserts.map((ins) => {
            const dims =
              ins.rows != null && ins.columns != null
                ? `${ins.rows}×${ins.columns}`
                : null;
            const isPending = pendingInsertId === ins.id;
            return (
              <li key={ins.id}>
                <button
                  onClick={() =>
                    setPendingInsertId(isPending ? null : ins.id)
                  }
                  disabled={placing}
                  className={`w-full text-left px-2 py-1.5 rounded border transition-colors ${
                    isPending
                      ? "border-accent bg-accent/10"
                      : "border-slate-700 hover:border-accent/60 hover:bg-slate-800/50"
                  } disabled:opacity-50`}
                >
                  <div className="text-sm text-slate-100 truncate">
                    {ins.name ?? ins.templateName ?? "Insert"}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {ins.templateName && <>{ins.templateName}</>}
                    {dims && (
                      <>
                        {ins.templateName ? " · " : ""}
                        <span className="tabular-nums">{dims}</span>
                      </>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {pendingInsertId && (
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => {
              onPlace(pendingInsertId);
              setPendingInsertId(null);
            }}
            disabled={placing}
            className="px-3 py-1.5 bg-accent text-white rounded text-xs hover:brightness-110 disabled:opacity-50"
          >
            Place here
          </button>
          <button
            onClick={() => setPendingInsertId(null)}
            disabled={placing}
            className="px-3 py-1.5 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Create-new expander — same form as /inserts/new, filtered by compat */}
      <div className="pt-2 border-t border-slate-700">
        {!createOpen ? (
          <button
            onClick={() => setCreateOpen(true)}
            className="text-xs text-slate-300 hover:text-accent"
          >
            + Create a new insert from a template
          </button>
        ) : (
          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              New insert
            </div>
            {templates.length === 0 ? (
              <p className="text-xs text-slate-500">
                No templates match this receptacle&apos;s interface.
              </p>
            ) : (
              <>
                <label className="block">
                  <span className="text-[11px] text-slate-500 block mb-0.5">
                    Template
                  </span>
                  <select
                    value={newTemplateId}
                    onChange={(e) => setNewTemplateId(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 focus:border-accent focus:outline-none"
                  >
                    <option value="">Select a template…</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] text-slate-500 block mb-0.5">
                    Name (optional)
                  </span>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={
                      selectedTpl
                        ? `e.g., ${selectedTpl.name} #1`
                        : "Name this insert"
                    }
                    className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 focus:border-accent focus:outline-none"
                  />
                </label>
                {ver?.isParametric && (
                  <div className="flex gap-2">
                    <label className="flex flex-col gap-0.5 flex-1">
                      <span className="text-[10px] text-slate-500">Rows</span>
                      <input
                        type="number"
                        min={ver.minRows ?? 1}
                        max={ver.maxRows ?? 26}
                        value={newRows}
                        onChange={(e) =>
                          setNewRows(
                            e.target.value === "" ? "" : Number(e.target.value)
                          )
                        }
                        className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 focus:border-accent focus:outline-none tabular-nums"
                      />
                    </label>
                    <label className="flex flex-col gap-0.5 flex-1">
                      <span className="text-[10px] text-slate-500">Cols</span>
                      <input
                        type="number"
                        min={ver.minColumns ?? 1}
                        max={ver.maxColumns ?? 26}
                        value={newCols}
                        onChange={(e) =>
                          setNewCols(
                            e.target.value === "" ? "" : Number(e.target.value)
                          )
                        }
                        className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 focus:border-accent focus:outline-none tabular-nums"
                      />
                    </label>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (!selectedTpl || !ver) return;
                      onCreateAndPlace({
                        templateId: selectedTpl.id,
                        templateVersionId: ver.id,
                        name: newName.trim() || undefined,
                        rows: ver.isParametric
                          ? Number(newRows) || 1
                          : undefined,
                        columns: ver.isParametric
                          ? Number(newCols) || 1
                          : undefined,
                      });
                      setCreateOpen(false);
                      setNewTemplateId("");
                      setNewName("");
                    }}
                    disabled={placing || !newTemplateId}
                    className="px-2.5 py-1 bg-accent text-white rounded text-xs hover:brightness-110 disabled:opacity-50"
                  >
                    Create + place
                  </button>
                  <button
                    onClick={() => {
                      setCreateOpen(false);
                      setNewTemplateId("");
                      setNewName("");
                    }}
                    className="px-2.5 py-1 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LevelPanel({
  level,
  editing,
  draft,
  setDraft,
  interfaceOptions,
  insert,
  candidateInserts,
  candidateTemplates,
  candidatesLoading,
  candidatesShowAll,
  setCandidatesShowAll,
  placingInsert,
  onEdit,
  onSave,
  onCancel,
  onRemoveInsert,
  onPlaceInsertHere,
  onCreateAndPlace,
  onDisableLevel,
  onEnableLevel,
}: {
  level: Location;
  editing: boolean;
  draft: {
    label: string;
    description: string;
    interfaceTypeId: string;
  };
  setDraft: (v: {
    label: string;
    description: string;
    interfaceTypeId: string;
  }) => void;
  interfaceOptions: Array<{
    id: string;
    identifier: string;
    description: string | null;
  }>;
  insert: Insert | null;
  candidateInserts: CandidateInsert[];
  candidateTemplates: CandidateTemplate[];
  candidatesLoading: boolean;
  candidatesShowAll: boolean;
  setCandidatesShowAll: (v: boolean) => void;
  placingInsert: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onRemoveInsert: (insertId: string) => void;
  onPlaceInsertHere: (insertId: string) => void;
  onCreateAndPlace: (args: {
    templateId: string;
    templateVersionId: string;
    name?: string;
    rows?: number;
    columns?: number;
  }) => void;
  onDisableLevel: () => void;
  onEnableLevel: () => void;
}) {
  // panelMode mirrors the inserts-page right-pane tabs.
  // 'place' = read-only info + Insert placement actions.
  // 'edit'  = level form (label / interface / notes / disable).
  // Parent owns the `editing` flag; tab buttons here toggle it.
  const panelMode: "place" | "edit" = editing ? "edit" : "place";
  return (
    <>
      {/* Tabs */}
      <div className="flex border-b border-slate-700 shrink-0">
        <button
          onClick={() => {
            if (panelMode !== "place") onCancel();
          }}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            panelMode === "place"
              ? "text-accent border-b-2 border-accent -mb-px"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Place
        </button>
        <button
          onClick={() => {
            if (panelMode !== "edit") onEdit();
          }}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            panelMode === "edit"
              ? "text-accent border-b-2 border-accent -mb-px"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Edit
        </button>
      </div>

      <div className="p-4 space-y-4">
        {panelMode === "edit" ? (
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
            {level.locationType === "receptacle" && (
              <div>
                <label className="text-xs text-slate-500 block mb-1">
                  Interface accepted
                </label>
                <select
                  value={draft.interfaceTypeId}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      interfaceTypeId: e.target.value,
                    })
                  }
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:border-accent focus:outline-none"
                >
                  <option value="">— none —</option>
                  {interfaceOptions.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.identifier}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Inserts that fit this interface will appear when placing.
                </p>
              </div>
            )}
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

            {/* Disable / Enable at the level scope */}
            <div className="pt-3 border-t border-slate-700 space-y-2">
              {level.isDisabled ? (
                <>
                  <div className="text-xs text-red-400">
                    Disabled
                    {level.disableReason && `: ${level.disableReason}`}
                  </div>
                  <button
                    onClick={onEnableLevel}
                    className="px-3 py-1.5 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50"
                  >
                    Enable
                  </button>
                </>
              ) : (
                <button
                  onClick={onDisableLevel}
                  disabled={!!insert}
                  title={
                    insert
                      ? "Remove the insert before disabling this level"
                      : undefined
                  }
                  className="px-3 py-1.5 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Disable…
                </button>
              )}
            </div>
          </>
        ) : (
          /* Place tab: insert placement only. Notes (if any) sit here
              as read-only context; the rest (label, type, interface) is
              redundant with the Edit tab and the center-pane title. */
          <>
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

            {level.locationType === "receptacle" &&
              (insert ? (
                <div className="space-y-2">
                  <div className="text-sm text-slate-200 truncate">
                    {insert.name ?? insert.templateName ?? "insert"}
                  </div>
                  {insert.templateName && insert.name && (
                    <div className="text-[11px] text-slate-500">
                      {insert.templateName}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => onRemoveInsert(insert.id)}
                      className="px-3 py-1.5 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50"
                    >
                      Remove
                    </button>
                    <Link
                      href={`/inserts?selected=${insert.id}`}
                      className="text-xs text-slate-400 hover:text-accent"
                    >
                      Open in Inserts →
                    </Link>
                  </div>
                </div>
              ) : (
                <PlaceInsertInline
                  level={level}
                  inserts={candidateInserts}
                  templates={candidateTemplates}
                  loading={candidatesLoading}
                  showAll={candidatesShowAll}
                  setShowAll={setCandidatesShowAll}
                  placing={placingInsert}
                  onPlace={onPlaceInsertHere}
                  onCreateAndPlace={onCreateAndPlace}
                />
              ))}
          </>
        )}
      </div>
    </>
  );
}

