"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CellGrid, type CellRow } from "@/app/_components/CellGrid";

interface Insert {
  id: string;
  uid: string | null;
  name: string | null;
  templateId: string | null;
  templateVersionId: string | null;
  locationId: string | null;
  rows: number | null;
  columns: number | null;
  templateName: string | null;
  interfaceType: string | null;
  rowDividersFixed?: boolean;
  columnDividersFixed?: boolean;
  locationPath: string | null;
  moduleName: string | null;
}


interface TemplateOption {
  id: string;
  name: string;
}

export default function InsertsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const templateId = searchParams.get("templateId") ?? "";
  const interfaceType = searchParams.get("interfaceType") ?? "";
  const placement = (searchParams.get("placement") ?? "all") as
    | "all"
    | "placed"
    | "unplaced";
  const selectedId = searchParams.get("selected") ?? null;

  const [inserts, setInserts] = useState<Insert[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInserts = useCallback(async () => {
    const qs = new URLSearchParams();
    if (templateId) qs.set("templateId", templateId);
    if (interfaceType) qs.set("interfaceType", interfaceType);
    qs.set("placement", placement);
    try {
      const res = await fetch(`/api/inserts?${qs.toString()}`);
      const data = await res.json();
      setInserts(data.inserts ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [templateId, interfaceType, placement]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      setTemplates(
        (data.templates ?? []).map((t: { id: string; name: string }) => ({
          id: t.id,
          name: t.name,
        }))
      );
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchInserts();
  }, [fetchInserts]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  function setParam(key: string, value: string | null) {
    const p = new URLSearchParams(searchParams.toString());
    if (value == null || value === "") p.delete(key);
    else p.set(key, value);
    const qs = p.toString();
    router.replace(`/inserts${qs ? `?${qs}` : ""}`);
  }

  const interfaceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const ins of inserts) if (ins.interfaceType) set.add(ins.interfaceType);
    return [...set].sort();
  }, [inserts]);

  const selected = inserts.find((i) => i.id === selectedId) ?? null;

  return (
    <div className="flex-1 flex min-w-0 h-full overflow-hidden">
      {/* Left — filters + list */}
      <div className="w-96 border-r border-slate-700 flex flex-col shrink-0 overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-slate-100">Inserts</h1>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              Physical instances of templates
            </p>
          </div>
          <Link
            href="/inserts/new"
            className="px-3 py-1 bg-accent text-white rounded text-xs font-medium hover:brightness-110 transition-all shrink-0"
          >
            + New
          </Link>
        </div>

        <div className="p-3 border-b border-slate-700 space-y-2">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-20 shrink-0">Template</span>
            <select
              value={templateId}
              onChange={(e) => setParam("templateId", e.target.value || null)}
              className="flex-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 focus:border-accent focus:outline-none"
            >
              <option value="">All templates</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-20 shrink-0">Interface</span>
            <select
              value={interfaceType}
              onChange={(e) => setParam("interfaceType", e.target.value || null)}
              className="flex-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 focus:border-accent focus:outline-none"
            >
              <option value="">All interfaces</option>
              {interfaceOptions.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-1 text-xs">
            {(["all", "placed", "unplaced"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setParam("placement", v === "all" ? null : v)}
                className={`flex-1 px-2 py-1 rounded border transition-colors ${
                  placement === v
                    ? "bg-slate-700 border-slate-600 text-slate-100"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
                }`}
              >
                {v === "all" ? "All" : v === "placed" ? "Placed" : "Unplaced"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-slate-500 text-sm">
              Loading…
            </div>
          ) : inserts.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">
              No inserts match the current filters.
            </div>
          ) : (
            <ul className="flex flex-col">
              {inserts.map((ins) => {
                const isSelected = ins.id === selectedId;
                const displayName =
                  ins.name ?? ins.templateName ?? "Insert";
                return (
                  <li key={ins.id}>
                    <button
                      onClick={() => setParam("selected", ins.id)}
                      className={`w-full text-left px-4 py-3 border-b border-slate-700/50 transition-colors ${
                        isSelected
                          ? "bg-slate-700/50"
                          : "hover:bg-slate-800/30"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-100 truncate flex-1">
                          {displayName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {ins.templateName && (
                          <span className="text-[11px] text-slate-400 truncate">
                            {ins.templateName}
                          </span>
                        )}
                        {ins.interfaceType && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 shrink-0">
                            {ins.interfaceType}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {ins.locationPath ? (
                          <>at {ins.locationPath}</>
                        ) : (
                          <span className="text-amber-400/80">unplaced</span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Right — detail */}
      {selected ? (
        <InsertDetail
          key={selected.id}
          insert={selected}
          onChanged={fetchInserts}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm px-6 text-center">
          Select an insert to view its details.
        </div>
      )}
    </div>
  );
}

interface Receptacle {
  id: string;
  path: string;
  label: string;
  interfaceTypeAccepted: string | null;
  moduleId: string;
  moduleName: string | null;
}

function InsertDetail({
  insert,
  onChanged,
}: {
  insert: Insert;
  onChanged: () => void;
}) {
  const [draftName, setDraftName] = useState(insert.name ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Compatible receptacles (inline in Place section of View tab)
  const [receptacles, setReceptacles] = useState<Receptacle[]>([]);
  const [receptaclesLoading, setReceptaclesLoading] = useState(false);
  const [placing, setPlacing] = useState(false);

  // Cells (grid) — full type so we can show overrides
  const [cells, setCells] = useState<CellRow[]>([]);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  // Multi-select for merge (sticky mode for discoverability)
  const [multiSelect, setMultiSelect] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  // Right pane mode: View/Assign (item + receptacle focused) vs
  // Edit (definition focused — overrides, merge, divide).
  const [panelMode, setPanelMode] = useState<"view" | "edit">("view");

  // Assignments on this insert's cells
  const [assignments, setAssignments] = useState<
    Array<{
      id: string;
      itemId: string;
      locationId: string;
      assignmentType: "placed" | "provisional";
    }>
  >([]);
  const [itemsById, setItemsById] = useState<
    Map<string, { id: string; name: string; description: string | null }>
  >(new Map());

  // Item picker
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [itemSearchResults, setItemSearchResults] = useState<
    Array<{ id: string; name: string; description: string | null }>
  >([]);

  // Restrict override editor
  const [editingRestrict, setEditingRestrict] = useState(false);
  const [restrictDraft, setRestrictDraft] = useState({
    maxWidthMm: "",
    maxHeightMm: "",
    maxDepthMm: "",
    reason: "",
  });

  // Divide editor
  const [dividingOpen, setDividingOpen] = useState(false);
  const [divideLabels, setDivideLabels] = useState("");

  const loadAll = useCallback(async () => {
    try {
      const locRes = await fetch(`/api/locations?insertId=${insert.id}`);
      const locData = await locRes.json();
      const locs: CellRow[] = locData.locations ?? [];
      setCells(locs);

      const leafIds = locs.map((l) => l.id);
      if (leafIds.length > 0) {
        const asns: typeof assignments = [];
        await Promise.all(
          leafIds.map(async (lid) => {
            const r = await fetch(`/api/assignments?locationId=${lid}`);
            const d = await r.json();
            for (const a of d.assignments ?? []) asns.push(a);
          })
        );
        setAssignments(asns);

        const itemIds = [...new Set(asns.map((a) => a.itemId))];
        const itemMap = new Map<
          string,
          { id: string; name: string; description: string | null }
        >();
        await Promise.all(
          itemIds.map(async (iid) => {
            const r = await fetch(`/api/items/${iid}`);
            const d = await r.json();
            if (d.item) itemMap.set(d.item.id, d.item);
          })
        );
        setItemsById(itemMap);
      } else {
        setAssignments([]);
        setItemsById(new Map());
      }
    } catch (err) {
      console.error(err);
    }
  }, [insert.id]);

  useEffect(() => {
    setDraftName(insert.name ?? "");
    setEditing(false);
    setSelectedCellId(null);
    setMultiSelect(new Set());
    setSelectMode(false);
    setShowItemPicker(false);
    setEditingRestrict(false);
    setPanelMode("view");
    loadAll();
  }, [insert.id, insert.name, loadAll]);

  const loadReceptacles = useCallback(async () => {
    setReceptaclesLoading(true);
    try {
      const res = await fetch(
        `/api/inserts/${insert.id}/compatible-receptacles`
      );
      const data = await res.json();
      setReceptacles(data.receptacles ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setReceptaclesLoading(false);
    }
  }, [insert.id]);

  // Keep the candidate list fresh as the user moves the insert around.
  useEffect(() => {
    loadReceptacles();
  }, [loadReceptacles, insert.locationId]);

  async function placeAt(locationId: string) {
    setPlacing(true);
    try {
      const res = await fetch(`/api/inserts/${insert.id}/place`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to place");
        return;
      }
      onChanged();
      await loadReceptacles();
    } catch (err) {
      console.error(err);
    } finally {
      setPlacing(false);
    }
  }

  async function saveName() {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/inserts/${insert.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draftName.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to save");
        return;
      }
      setEditing(false);
      onChanged();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function unplace() {
    if (!confirm("Remove this insert from its location?")) return;
    try {
      const res = await fetch(`/api/inserts/${insert.id}/place`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to unplace");
        return;
      }
      onChanged();
    } catch (err) {
      console.error(err);
    }
  }

  const selectedCell = cells.find((c) => c.id === selectedCellId) ?? null;
  const selectedAssignments = useMemo(
    () => assignments.filter((a) => a.locationId === selectedCellId),
    [assignments, selectedCellId]
  );

  function selectCell(id: string | null, additive = false) {
    // Sticky select mode OR modifier-key additive click → multi-select
    if ((selectMode || additive) && id) {
      const next = new Set(multiSelect);
      if (next.size === 0 && selectedCellId) next.add(selectedCellId);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setMultiSelect(next);
      setSelectedCellId(null);
      setShowItemPicker(false);
      setEditingRestrict(false);
      return;
    }
    setMultiSelect(new Set());
    setSelectedCellId(id);
    setShowItemPicker(false);
    setEditingRestrict(false);
  }

  async function mergeSelected() {
    const ids = [...multiSelect];
    if (ids.length < 2) return;
    // Origin = top-left-most cell
    const picked = cells.filter((c) => ids.includes(c.id));
    picked.sort(
      (a, b) =>
        (a.gridRow ?? 0) - (b.gridRow ?? 0) ||
        (a.gridColumn ?? 0) - (b.gridColumn ?? 0)
    );
    const origin = picked[0];
    const aliases = picked.slice(1).map((c) => c.id);
    try {
      const r = await fetch(`/api/locations/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originId: origin.id, aliasIds: aliases }),
      });
      if (!r.ok) {
        const d = await r.json();
        alert(d.error || "Merge failed");
        return;
      }
      setMultiSelect(new Set());
      setSelectedCellId(origin.id);
      await loadAll();
    } catch (err) {
      console.error(err);
    }
  }

  async function submitDivide() {
    if (!selectedCell) return;
    const labels = divideLabels
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (labels.length < 2) {
      alert("Provide at least two comma-separated labels.");
      return;
    }
    try {
      const r = await fetch(
        `/api/locations/${selectedCell.id}/divide`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ labels, source: "ad_hoc" }),
        }
      );
      if (!r.ok) {
        const d = await r.json();
        alert(d.error || "Divide failed");
        return;
      }
      setDividingOpen(false);
      setDivideLabels("");
      await loadAll();
    } catch (err) {
      console.error(err);
    }
  }

  async function undivideAt(parentId: string) {
    if (
      !confirm(
        "Collapse this cell's subdivisions? Children will be removed."
      )
    )
      return;
    try {
      const r = await fetch(`/api/locations/${parentId}/divide`, {
        method: "DELETE",
      });
      if (!r.ok) {
        const d = await r.json();
        alert(d.error || "Undivide failed");
        return;
      }
      // If the currently selected cell was a child of this parent, it's
      // gone now — select the former parent instead.
      if (selectedCell && selectedCell.parentId === parentId) {
        setSelectedCellId(parentId);
      }
      await loadAll();
    } catch (err) {
      console.error(err);
    }
  }

  async function unmergeCell() {
    if (!selectedCell) return;
    try {
      const r = await fetch(
        `/api/locations/${selectedCell.id}/unmerge`,
        { method: "POST" }
      );
      if (!r.ok) {
        const d = await r.json();
        alert(d.error || "Unmerge failed");
        return;
      }
      await loadAll();
    } catch (err) {
      console.error(err);
    }
  }

  async function searchItems(q: string) {
    setItemSearchQuery(q);
    if (q.trim().length < 2) {
      setItemSearchResults([]);
      return;
    }
    try {
      const r = await fetch(`/api/items?q=${encodeURIComponent(q.trim())}`);
      const d = await r.json();
      setItemSearchResults(d.items ?? []);
    } catch (err) {
      console.error(err);
    }
  }

  async function assignItem(itemId: string) {
    if (!selectedCellId) return;
    try {
      const r = await fetch(`/api/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          locationId: selectedCellId,
          assignmentType: "placed",
        }),
      });
      if (!r.ok) {
        const d = await r.json();
        alert(d.error || "Failed to assign");
        return;
      }
      setShowItemPicker(false);
      setItemSearchQuery("");
      setItemSearchResults([]);
      await loadAll();
    } catch (err) {
      console.error(err);
    }
  }

  async function unassignItem(assignmentId: string) {
    try {
      await fetch(`/api/assignments/${assignmentId}`, { method: "DELETE" });
      await loadAll();
    } catch (err) {
      console.error(err);
    }
  }

  async function disableCell() {
    if (!selectedCell) return;
    const reason = window.prompt(
      "Disable this cell. Reason (optional):",
      selectedCell.disableReason ?? ""
    );
    if (reason === null) return;
    try {
      const r = await fetch(
        `/api/locations/${selectedCell.id}/disable`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() || undefined }),
        }
      );
      if (!r.ok) {
        const d = await r.json();
        alert(d.error || "Failed");
        return;
      }
      await loadAll();
    } catch (err) {
      console.error(err);
    }
  }

  async function enableCell() {
    if (!selectedCell) return;
    try {
      await fetch(`/api/locations/${selectedCell.id}/disable`, {
        method: "DELETE",
      });
      await loadAll();
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

  async function saveRestrict() {
    if (!selectedCell) return;
    try {
      const r = await fetch(
        `/api/locations/${selectedCell.id}/restrict`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            maxWidthMm: restrictDraft.maxWidthMm.trim() || null,
            maxHeightMm: restrictDraft.maxHeightMm.trim() || null,
            maxDepthMm: restrictDraft.maxDepthMm.trim() || null,
            reason: restrictDraft.reason.trim() || null,
          }),
        }
      );
      if (!r.ok) {
        const d = await r.json();
        alert(d.error || "Failed");
        return;
      }
      setEditingRestrict(false);
      await loadAll();
    } catch (err) {
      console.error(err);
    }
  }

  async function clearRestrict() {
    if (!selectedCell) return;
    try {
      await fetch(`/api/locations/${selectedCell.id}/restrict`, {
        method: "DELETE",
      });
      setEditingRestrict(false);
      await loadAll();
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteInsert() {
    if (!confirm("Delete this insert? This cannot be undone via the UI.")) return;
    try {
      const res = await fetch(`/api/inserts/${insert.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete");
        return;
      }
      onChanged();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
      <div className="p-6 border-b border-slate-700 space-y-2 shrink-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder={insert.templateName ?? "Insert name"}
              className="flex-1 text-lg font-semibold text-slate-100 bg-slate-800 border border-slate-600 rounded px-2 py-1 focus:border-accent focus:outline-none"
            />
            <button
              onClick={saveName}
              disabled={saving}
              className="px-3 py-1 bg-accent text-white rounded text-xs hover:brightness-110 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => {
                setDraftName(insert.name ?? "");
                setEditing(false);
              }}
              className="px-3 py-1 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group/title">
            <h2 className="text-lg font-semibold text-slate-100 truncate flex-1">
              {insert.name || insert.templateName || "Untitled insert"}
            </h2>
            <button
              onClick={() => setEditing(true)}
              title="Rename"
              aria-label="Rename insert"
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
        )}
      </div>

      {/* Layout area: grid + optional cell panel */}
      <div className="flex-1 flex min-w-0 min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden p-6 gap-3">
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-xs text-slate-500 uppercase tracking-wider">
              Layout
            </div>
          </div>
          {cells.length === 0 ? (
            <div className="text-sm text-slate-500">
              No cells. Template has no grid, or insert was created without
              one.
            </div>
          ) : (
            <>
              <div className="flex-1 min-h-0 flex items-center justify-center">
                <CellGrid
                  cells={cells}
                  assignments={assignments}
                  itemsById={itemsById}
                  selectedCellId={selectedCellId}
                  multiSelect={multiSelect}
                  onCellClick={selectCell}
                  rowDividersFixed={!!insert.rowDividersFixed}
                  columnDividersFixed={!!insert.columnDividersFixed}
                />
              </div>
            </>
          )}
        </div>

        {cells.length > 0 && (
          <div className="w-80 shrink-0 border-l border-slate-700 bg-slate-800/20 overflow-y-auto flex flex-col">
            {/* Tabs */}
            <div className="flex border-b border-slate-700 shrink-0">
              {(["view", "edit"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setPanelMode(m);
                    if (m === "view") {
                      // View mode is single-focus; clear merge state
                      setSelectMode(false);
                      setMultiSelect(new Set());
                      setEditingRestrict(false);
                      setDividingOpen(false);
                    }
                  }}
                  className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                    panelMode === m
                      ? "text-accent border-b-2 border-accent -mb-px"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {m === "view" ? "View / Assign" : "Edit"}
                </button>
              ))}
            </div>

            {/* Edit-mode select-for-merge toggle */}
            {panelMode === "edit" && (
              <div className="p-4 border-b border-slate-700 space-y-2">
                <button
                  onClick={() => {
                    if (selectMode) {
                      setSelectMode(false);
                      setMultiSelect(new Set());
                    } else {
                      setSelectMode(true);
                      setSelectedCellId(null);
                    }
                  }}
                  className={`w-full px-3 py-1.5 rounded text-xs transition-colors ${
                    selectMode
                      ? "bg-accent text-white"
                      : "border border-slate-600 text-slate-300 hover:bg-slate-700/50"
                  }`}
                >
                  {selectMode
                    ? "Selecting for merge — click cells in grid"
                    : "Select cells to merge"}
                </button>
                {selectMode && (
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Tip: hold Ctrl/Cmd and click to add or remove cells
                    without entering this mode.
                  </p>
                )}
              </div>
            )}

            {/* Body */}
            {panelMode === "edit" && multiSelect.size > 0 ? (
              /* Merge action panel — Edit mode only */
              <div className="p-4 space-y-3">
                {(() => {
                  const picked = cells.filter((c) =>
                    multiSelect.has(c.id)
                  );
                  const labels = picked.map((c) => c.label).join(", ");
                  const anyDisabled = picked.some((c) => c.isDisabled);
                  return (
                    <>
                      <div className="text-base font-medium text-slate-100 break-words">
                        {labels}
                      </div>
                      <div className="text-xs text-slate-500">
                        {multiSelect.size}{" "}
                        {multiSelect.size === 1 ? "cell" : "cells"}
                        {!anyDisabled && multiSelect.size >= 2
                          ? " — ready to merge"
                          : ""}
                      </div>
                      {anyDisabled && (
                        <div className="text-xs text-red-400">
                          Disabled cell in selection. Enable it first.
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={mergeSelected}
                          disabled={
                            multiSelect.size < 2 || anyDisabled
                          }
                          className="px-3 py-1.5 bg-accent text-white rounded text-xs hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Merge
                        </button>
                        <button
                          onClick={() => setMultiSelect(new Set())}
                          className="px-3 py-1.5 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50"
                        >
                          Clear
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : panelMode === "edit" && selectMode ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Click two or more cells to merge.
              </div>
            ) : panelMode === "view" && !selectedCell ? (
              /* View tab, nothing selected — placement still useful */
              <ViewTabBody
                placementOnly
                insert={insert}
                unplace={unplace}
                receptacles={receptacles}
                receptaclesLoading={receptaclesLoading}
                placing={placing}
                onPlace={placeAt}
              />
            ) : !selectedCell ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Pick a cell to rework it.
              </div>
            ) : (
              <>
            {panelMode === "view" && (
              <PlacementSection
                insert={insert}
                unplace={unplace}
                receptacles={receptacles}
                receptaclesLoading={receptaclesLoading}
                placing={placing}
                onPlace={placeAt}
              />
            )}
            <div className="p-4 border-b border-slate-700">
              <div className="text-base font-medium text-slate-100 truncate">
                {selectedCell.label}
              </div>
            </div>

            {/* Assignments — View tab only */}
            {panelMode === "view" && (
            <div className="p-4">
              {selectedAssignments.length === 0 ? (
                <div className="text-center">
                  <p className="text-sm text-slate-500 mb-3">
                    No items assigned.
                  </p>
                  {!selectedCell.isDisabled && (
                    <button
                      onClick={() => setShowItemPicker(true)}
                      className="px-3 py-1.5 bg-accent text-white rounded text-xs hover:brightness-110"
                    >
                      Assign Item
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Assigned Items
                  </h4>
                  {selectedAssignments.map((a) => {
                    const item = itemsById.get(a.itemId);
                    return (
                      <div
                        key={a.id}
                        className="p-2 rounded bg-slate-800/60 border border-slate-700"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm text-slate-200 font-medium truncate">
                              {item?.name ?? "Unknown item"}
                            </div>
                            {item?.description && (
                              <div className="text-xs text-slate-500 line-clamp-2">
                                {item.description}
                              </div>
                            )}
                          </div>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                              a.assignmentType === "placed"
                                ? "bg-green-900/40 text-green-300"
                                : "bg-amber-900/40 text-amber-300"
                            }`}
                          >
                            {a.assignmentType}
                          </span>
                        </div>
                        <button
                          onClick={() => unassignItem(a.id)}
                          className="mt-1 text-xs text-red-400 hover:text-red-300"
                        >
                          Unassign
                        </button>
                      </div>
                    );
                  })}
                  {!selectedCell.isDisabled && (
                    <button
                      onClick={() => setShowItemPicker(true)}
                      className="w-full px-3 py-1.5 border border-dashed border-slate-600 text-slate-400 rounded text-xs hover:border-slate-500 hover:text-slate-300"
                    >
                      + Assign another item
                    </button>
                  )}
                </div>
              )}

              {/* Item picker */}
              {showItemPicker && (
                <div className="mt-4 border-t border-slate-700 pt-3">
                  <input
                    type="text"
                    value={itemSearchQuery}
                    onChange={(e) => searchItems(e.target.value)}
                    placeholder="Search items…"
                    autoFocus
                    className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:border-accent focus:outline-none"
                  />
                  <div className="mt-2 max-h-48 overflow-y-auto">
                    {itemSearchResults.length > 0 ? (
                      itemSearchResults.map((it) => (
                        <button
                          key={it.id}
                          onClick={() => assignItem(it.id)}
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-700/50"
                        >
                          <div className="text-sm text-slate-200">{it.name}</div>
                          {it.description && (
                            <div className="text-xs text-slate-500 line-clamp-1">
                              {it.description}
                            </div>
                          )}
                        </button>
                      ))
                    ) : itemSearchQuery.trim().length >= 2 ? (
                      <p className="text-xs text-slate-500 py-2 text-center">
                        No items found.
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 py-2 text-center">
                        Type 2+ chars to search.
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
            )}

              {/* Overrides — view: read-only summary; edit: full controls */}
              {panelMode === "view" ? (
                (selectedCell.isDisabled ||
                  selectedCell.maxWidthMm ||
                  selectedCell.maxHeightMm ||
                  selectedCell.maxDepthMm ||
                  cells.some(
                    (c) => c.mergedIntoId === selectedCell.id
                  )) && (
                  <div className="mt-4 pt-4 border-t border-slate-700 space-y-1">
                    <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                      Status
                    </h4>
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
                        {selectedCell.restrictReason &&
                          ` — ${selectedCell.restrictReason}`}
                      </div>
                    )}
                    {cells.some(
                      (c) => c.mergedIntoId === selectedCell.id
                    ) && (
                      <div className="text-xs text-slate-300">
                        Merged with{" "}
                        {cells
                          .filter((c) => c.mergedIntoId === selectedCell.id)
                          .map((c) => c.label)
                          .join(", ")}
                      </div>
                    )}
                    <button
                      onClick={() => setPanelMode("edit")}
                      className="mt-2 text-[11px] text-slate-500 hover:text-accent"
                    >
                      Edit overrides →
                    </button>
                  </div>
                )
              ) : (
              <div className="mt-4 pt-4 border-t border-slate-700 space-y-3">
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Overrides
                </h4>

                {cells.some((c) => c.mergedIntoId === selectedCell.id) && (
                  <button
                    onClick={unmergeCell}
                    className="w-full px-3 py-1.5 border border-accent/60 text-accent rounded text-xs hover:bg-accent/10"
                  >
                    Unmerge
                  </button>
                )}

                {/* Divide / Undivide — undivide applies to the parent
                    whether the user selected the parent itself or any
                    of its children */}
                {cells.some((c) => c.parentId === selectedCell.id) ? (
                  <button
                    onClick={() => undivideAt(selectedCell.id)}
                    className="w-full px-3 py-1.5 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50"
                  >
                    Undivide
                  </button>
                ) : selectedCell.parentId &&
                  cells.some((c) => c.id === selectedCell.parentId) ? (
                  <button
                    onClick={() => undivideAt(selectedCell.parentId!)}
                    className="w-full px-3 py-1.5 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50"
                  >
                    Undivide parent ({
                      cells.find((c) => c.id === selectedCell.parentId)?.label
                    })
                  </button>
                ) : dividingOpen ? (
                  <div className="space-y-2 p-2 rounded bg-slate-800/60 border border-slate-700">
                    <div className="text-xs text-slate-400">
                      Child labels, comma-separated (e.g. <code className="text-slate-300">front, rear</code>)
                    </div>
                    <input
                      type="text"
                      value={divideLabels}
                      onChange={(e) => setDivideLabels(e.target.value)}
                      placeholder="front, rear"
                      autoFocus
                      className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 focus:border-accent focus:outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={submitDivide}
                        className="px-2.5 py-1 bg-accent text-white rounded text-xs hover:brightness-110"
                      >
                        Divide
                      </button>
                      <button
                        onClick={() => {
                          setDividingOpen(false);
                          setDivideLabels("");
                        }}
                        className="px-2.5 py-1 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setDividingOpen(true)}
                    disabled={
                      selectedCell.isDisabled ||
                      selectedAssignments.length > 0
                    }
                    title={
                      selectedAssignments.length > 0
                        ? "Unassign items before dividing this cell"
                        : undefined
                    }
                    className="w-full px-3 py-1.5 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Divide…
                  </button>
                )}

                {selectedCell.isDisabled ? (
                  <button
                    onClick={enableCell}
                    className="w-full px-3 py-1.5 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50"
                  >
                    Enable
                  </button>
                ) : (
                  <button
                    onClick={disableCell}
                    disabled={selectedAssignments.length > 0}
                    title={
                      selectedAssignments.length > 0
                        ? "Unassign items before disabling this cell"
                        : undefined
                    }
                    className="w-full px-3 py-1.5 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Disable…
                  </button>
                )}

                {editingRestrict ? (
                  <div className="space-y-2 p-2 rounded bg-slate-800/60 border border-slate-700">
                    <div className="text-xs text-slate-400">
                      Clamp usable capacity (mm). Blank = no clamp.
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(["maxWidthMm", "maxHeightMm", "maxDepthMm"] as const).map(
                        (k) => (
                          <label
                            key={k}
                            className="text-[10px] text-slate-500 flex flex-col gap-0.5"
                          >
                            {k === "maxWidthMm"
                              ? "Max W"
                              : k === "maxHeightMm"
                                ? "Max H"
                                : "Max D"}
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={restrictDraft[k]}
                              onChange={(e) =>
                                setRestrictDraft({
                                  ...restrictDraft,
                                  [k]: e.target.value,
                                })
                              }
                              className="px-1.5 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 focus:border-accent focus:outline-none tabular-nums"
                            />
                          </label>
                        )
                      )}
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
                        className="px-2.5 py-1 bg-accent text-white rounded text-xs hover:brightness-110"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingRestrict(false)}
                        className="px-2.5 py-1 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50"
                      >
                        Cancel
                      </button>
                      {(selectedCell.maxWidthMm ||
                        selectedCell.maxHeightMm ||
                        selectedCell.maxDepthMm) && (
                        <button
                          onClick={clearRestrict}
                          className="ml-auto text-xs text-slate-500 hover:text-slate-300"
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
                      className="w-full px-3 py-1.5 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50"
                    >
                      Edit restriction
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={openRestrict}
                    className="w-full px-3 py-1.5 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50"
                  >
                    Restrict dimensions…
                  </button>
                )}
              </div>
              )}
              </>
            )}

            {/* Edit-tab footer: destructive Delete insert.
                Always visible at the bottom of Edit tab regardless of
                cell selection. GitHub-style red. */}
            {panelMode === "edit" && (
              <div className="mt-auto p-4 border-t border-slate-700">
                <button
                  onClick={deleteInsert}
                  className="w-full px-3 py-1.5 border border-red-700 text-red-400 rounded text-xs hover:bg-red-900/30 hover:text-red-300 transition-colors"
                >
                  Delete this insert
                </button>
                <p className="mt-1.5 text-[10px] text-slate-600 leading-tight">
                  Removes the insert and all its cells. Items become
                  unassigned.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom action bar removed — Place/Move/Unplace live in View tab,
          Delete insert lives at the bottom of Edit tab. Compat-receptacle
          picker is now inline in the View tab — no modal. */}
    </div>
  );
}

function PlacementSection({
  insert,
  unplace,
  receptacles,
  receptaclesLoading,
  placing,
  onPlace,
}: {
  insert: Insert;
  unplace: () => void;
  receptacles: Receptacle[];
  receptaclesLoading: boolean;
  placing: boolean;
  onPlace: (locationId: string) => void;
}) {
  // Two-step confirm: click a candidate to select it, then press
  // Place/Move to commit. Avoids accidental single-click moves.
  const [pendingId, setPendingId] = useState<string | null>(null);
  useEffect(() => {
    setPendingId(null);
  }, [insert.id, insert.locationId]);

  const verb = insert.locationPath ? "Move" : "Place";

  return (
    <div className="p-4 border-b border-slate-700 space-y-3">
      <div>
        <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
          Placement
        </div>
        {insert.locationPath ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-200 truncate flex-1">
              {insert.locationPath}
            </span>
            <button
              onClick={unplace}
              className="px-2.5 py-1 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50"
            >
              Unplace
            </button>
          </div>
        ) : (
          <div className="text-sm text-amber-400">Unplaced</div>
        )}
      </div>

      {/* Inline candidate list — compatible empty receptacles. */}
      <div>
        <div className="text-[11px] text-slate-500 mb-1.5">
          {verb} to…
          {insert.interfaceType && (
            <>
              {" "}
              <span className="text-slate-600">(accepts</span>{" "}
              <span className="font-mono text-slate-400">
                {insert.interfaceType}
              </span>
              <span className="text-slate-600">)</span>
            </>
          )}
        </div>
        {receptaclesLoading ? (
          <div className="text-xs text-slate-500">Loading…</div>
        ) : receptacles.length === 0 ? (
          <div className="text-xs text-slate-500">
            No compatible empty receptacles.
          </div>
        ) : (
          <ul className="flex flex-col gap-1 max-h-60 overflow-y-auto">
            {receptacles.map((r) => {
              const isPending = pendingId === r.id;
              return (
                <li key={r.id}>
                  <button
                    onClick={() => setPendingId(isPending ? null : r.id)}
                    disabled={placing}
                    className={`w-full text-left px-2 py-1.5 rounded border transition-colors ${
                      isPending
                        ? "border-accent bg-accent/10"
                        : "border-slate-700 hover:border-accent/60 hover:bg-slate-800/50"
                    } disabled:opacity-50`}
                  >
                    <div className="text-sm text-slate-200 truncate">
                      {r.moduleName ? `${r.moduleName} ` : ""}
                      <span className="text-slate-400">
                        {r.path.replace(
                          r.moduleName ? r.moduleName + ":" : "",
                          ""
                        )}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {pendingId && (
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => {
                onPlace(pendingId);
                setPendingId(null);
              }}
              disabled={placing}
              className="px-3 py-1.5 bg-accent text-white rounded text-xs hover:brightness-110 disabled:opacity-50"
            >
              {verb}
            </button>
            <button
              onClick={() => setPendingId(null)}
              disabled={placing}
              className="px-3 py-1.5 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ViewTabBody({
  insert,
  unplace,
  receptacles,
  receptaclesLoading,
  placing,
  onPlace,
}: {
  placementOnly?: boolean;
  insert: Insert;
  unplace: () => void;
  receptacles: Receptacle[];
  receptaclesLoading: boolean;
  placing: boolean;
  onPlace: (locationId: string) => void;
}) {
  return (
    <>
      <PlacementSection
        insert={insert}
        unplace={unplace}
        receptacles={receptacles}
        receptaclesLoading={receptaclesLoading}
        placing={placing}
        onPlace={onPlace}
      />
      <div className="p-6 text-center text-xs text-slate-500">
        Pick a cell to peek inside.
      </div>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs text-slate-500 uppercase tracking-wider">
        {label}
      </div>
      <div className="text-sm text-slate-200 mt-1">{children}</div>
    </div>
  );
}

