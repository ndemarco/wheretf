"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Spinner from "@/app/components/Spinner";

// ───────────────────────── Types ─────────────────────────

type Maturity = "draft" | "stable";

interface UnitAxis {
  label: string;
  mm: number | null;
}
interface UnitSystem {
  width?: UnitAxis;
  depth?: UnitAxis;
  height?: UnitAxis;
}

interface InterfaceType {
  id: string;
  identifier: string;
  description: string | null;
  physicalContract: Record<string, unknown> | null;
  maturity: Maturity;
  archivedAt: string | null;
  unitSystem: UnitSystem | null;
  createdAt: string;
}

interface UsageCounts {
  providers: number;
  accepters: number;
  receptacles: number;
}

type Filter = "active" | "archived" | "all";

// ───────────────────────── Draft shape for edit form ─────────────────────────

interface FormDraft {
  identifier: string;
  description: string;
  physicalContractNotes: string;
  hasUnitSystem: boolean;
  unitSystem: {
    width: { label: string; mm: string };
    depth: { label: string; mm: string };
    height: { label: string; mm: string };
  };
}

function emptyUnitRow() {
  return { label: "", mm: "" };
}

function blankDraft(): FormDraft {
  return {
    identifier: "",
    description: "",
    physicalContractNotes: "",
    hasUnitSystem: false,
    unitSystem: {
      width: emptyUnitRow(),
      depth: emptyUnitRow(),
      height: emptyUnitRow(),
    },
  };
}

function toDraft(it: InterfaceType): FormDraft {
  const pc = it.physicalContract;
  const notes =
    pc && typeof pc === "object" && "notes" in pc && typeof pc.notes === "string"
      ? pc.notes
      : "";
  const us = it.unitSystem;
  return {
    identifier: it.identifier,
    description: it.description ?? "",
    physicalContractNotes: notes,
    hasUnitSystem: !!us,
    unitSystem: {
      width: us?.width
        ? { label: us.width.label ?? "", mm: us.width.mm?.toString() ?? "" }
        : emptyUnitRow(),
      depth: us?.depth
        ? { label: us.depth.label ?? "", mm: us.depth.mm?.toString() ?? "" }
        : emptyUnitRow(),
      height: us?.height
        ? { label: us.height.label ?? "", mm: us.height.mm?.toString() ?? "" }
        : emptyUnitRow(),
    },
  };
}

function draftToPayload(
  d: FormDraft,
  maturity: Maturity,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    identifier: d.identifier.trim(),
    description: d.description.trim() || null,
    maturity,
  };

  const notes = d.physicalContractNotes.trim();
  payload.physicalContract = notes ? { notes } : null;

  if (d.hasUnitSystem) {
    const axes: Record<string, UnitAxis> = {};
    (["width", "depth", "height"] as const).forEach((k) => {
      const row = d.unitSystem[k];
      const mmNum = row.mm.trim() === "" ? null : Number(row.mm);
      if (row.label.trim() || mmNum != null) {
        axes[k] = { label: row.label.trim(), mm: mmNum };
      }
    });
    payload.unitSystem = Object.keys(axes).length > 0 ? axes : null;
  } else {
    payload.unitSystem = null;
  }

  return payload;
}

// ───────────────────────── Page ─────────────────────────

export default function InterfacesAdminPage() {
  const [items, setItems] = useState<InterfaceType[]>([]);
  const [usageById, setUsageById] = useState<Record<string, UsageCounts>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("active");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState<FormDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // ── Load ──
  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/interface-types?status=all");
      const data = await res.json();
      const rows: InterfaceType[] = data.interfaceTypes ?? [];
      setItems(rows);
      // Batch usage fetch for everything (simple; admin pages are low-traffic).
      const next: Record<string, UsageCounts> = {};
      await Promise.all(
        rows.map(async (r) => {
          const d = await fetch(`/api/interface-types/${r.id}`).then((x) =>
            x.json(),
          );
          if (d.usage) next[r.id] = d.usage;
        }),
      );
      setUsageById(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // ── Derived ──
  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filter === "active") return !i.archivedAt;
      if (filter === "archived") return !!i.archivedAt;
      return true;
    });
  }, [items, filter]);

  const counts = useMemo(() => {
    const active = items.filter((i) => !i.archivedAt).length;
    const archived = items.filter((i) => !!i.archivedAt).length;
    return { active, archived, all: items.length };
  }, [items]);

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;
  const activeUsage = activeId ? usageById[activeId] : undefined;

  const totalUsage = (u: UsageCounts | undefined) =>
    u ? u.providers + u.accepters + u.receptacles : 0;

  // ── Selection ──
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };
  const selectAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(filtered.map((i) => i.id)));
    else setSelectedIds(new Set());
  };

  // ── Detail/edit ──
  const openDetail = (it: InterfaceType) => {
    setActiveId(it.id);
    setIsCreating(false);
    setDraft(toDraft(it));
  };
  const openCreate = () => {
    setActiveId(null);
    setIsCreating(true);
    setDraft(blankDraft());
  };
  const closeDetail = () => {
    setActiveId(null);
    setIsCreating(false);
    setDraft(null);
  };

  // ── Save ──
  const doSave = async (targetMaturity: Maturity) => {
    if (!draft) return;
    setSaving(true);
    try {
      const payload = draftToPayload(draft, targetMaturity);
      if (isCreating) {
        const res = await fetch("/api/interface-types", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error ?? "Create failed");
          return;
        }
        showToast(
          targetMaturity === "stable"
            ? `Created: ${data.interfaceType.identifier}`
            : `Saved as draft: ${data.interfaceType.identifier}`,
        );
        await loadList();
        setActiveId(data.interfaceType.id);
        setIsCreating(false);
        setDraft(toDraft(data.interfaceType));
      } else if (activeId) {
        const wasDraft = activeItem?.maturity === "draft";
        const res = await fetch(`/api/interface-types/${activeId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error ?? "Save failed");
          return;
        }
        if (wasDraft && targetMaturity === "stable") {
          showToast(
            `Published ${data.interfaceType.identifier} (draft → stable)`,
          );
        } else {
          showToast(`Updated: ${data.interfaceType.identifier}`);
        }
        await loadList();
        setDraft(toDraft(data.interfaceType));
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Lifecycle ──
  const archive = async (id: string) => {
    const res = await fetch(`/api/interface-types/${id}/archive`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Archive failed");
      return;
    }
    showToast(`Archived: ${data.interfaceType.identifier}`);
    await loadList();
    if (activeId === id) setDraft(toDraft(data.interfaceType));
  };
  const unarchive = async (id: string) => {
    const res = await fetch(`/api/interface-types/${id}/unarchive`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Unarchive failed");
      return;
    }
    showToast(`Unarchived: ${data.interfaceType.identifier}`);
    await loadList();
    if (activeId === id) setDraft(toDraft(data.interfaceType));
  };
  const remove = async (id: string) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    if (
      !confirm(
        `Hard-delete "${it.identifier}"? This is irreversible.`,
      )
    )
      return;
    const res = await fetch(`/api/interface-types/${id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Delete failed");
      return;
    }
    showToast(`Deleted: ${it.identifier}`);
    if (activeId === id) closeDetail();
    await loadList();
  };

  const derive = () => {
    if (!activeItem) return;
    // Clone description + contract + unit system; require new identifier.
    const d = toDraft(activeItem);
    d.identifier = "";
    setActiveId(null);
    setIsCreating(true);
    setDraft(d);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 3500);
  };

  // ── Render ──
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((i) => selectedIds.has(i.id));
  const anyFilteredSelected = filtered.some((i) => selectedIds.has(i.id));

  return (
    <div className="flex-1 flex min-w-0 h-full overflow-hidden">
      {/* List pane */}
      <div className="flex-1 min-w-0 flex flex-col border-r border-slate-700">
        {/* Header */}
        <div className="h-12 flex items-center px-5 border-b border-slate-700 bg-slate-800 gap-3 shrink-0">
          <div className="text-sm text-slate-400">Admin ›</div>
          <div className="text-sm font-semibold text-slate-100">
            Interface Types
          </div>
          <div className="flex-1" />
          <button
            onClick={openCreate}
            className="px-3 py-1.5 bg-accent text-slate-900 text-sm font-semibold rounded hover:bg-accent/90 transition flex items-center gap-1.5"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              className="w-3.5 h-3.5"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Interface Type
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-0.5 px-5 pt-2 border-b border-slate-700 bg-slate-900 shrink-0">
          {(["active", "archived", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-2 text-xs -mb-px border-b-2 transition ${
                filter === f
                  ? "border-accent text-accent font-medium"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <span className="capitalize">{f}</span>
              <span
                className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                  filter === f
                    ? "bg-accent/15 text-accent"
                    : "bg-slate-700 text-slate-400"
                }`}
              >
                {counts[f]}
              </span>
            </button>
          ))}
        </div>

        {/* Bulk bar — merge disabled until slice 3 */}
        {selectedIds.size > 0 && (
          <div className="px-5 py-2 bg-slate-800 border-b border-slate-700 flex items-center gap-3 text-xs shrink-0">
            <span className="text-slate-400">
              <strong className="text-accent">{selectedIds.size}</strong>{" "}
              selected
            </span>
            <div className="flex-1" />
            <button
              disabled
              title="Merge lands in the final slice"
              className="px-2.5 py-1 border border-slate-700 rounded text-slate-500 cursor-not-allowed opacity-60"
            >
              Merge into… (coming soon)
            </button>
            <button
              onClick={async () => {
                for (const id of selectedIds) {
                  const row = items.find((i) => i.id === id);
                  if (row && !row.archivedAt) {
                    await archive(id);
                  }
                }
                setSelectedIds(new Set());
              }}
              className="px-2.5 py-1 border border-slate-700 rounded text-slate-200 hover:bg-slate-700"
            >
              Archive selected
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-2.5 py-1 text-slate-400 hover:text-slate-200"
            >
              Clear
            </button>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-10 flex justify-center">
              <Spinner />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState onCreate={openCreate} filter={filter} />
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-800 z-10">
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 font-semibold">
                  <th className="w-10 px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      ref={(el) => {
                        if (el)
                          el.indeterminate =
                            anyFilteredSelected && !allFilteredSelected;
                      }}
                      onChange={(e) => selectAll(e.target.checked)}
                      className="accent-accent cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-2.5">Identifier</th>
                  <th className="px-4 py-2.5">Maturity</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Description</th>
                  <th className="px-4 py-2.5">Usage</th>
                  <th className="px-4 py-2.5">Created</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => {
                  const u = usageById[it.id];
                  const archived = !!it.archivedAt;
                  const selected = selectedIds.has(it.id);
                  const active = activeId === it.id;
                  return (
                    <tr
                      key={it.id}
                      onClick={() => openDetail(it)}
                      className={`border-b border-slate-800 cursor-pointer transition ${
                        selected
                          ? "bg-accent/[0.06]"
                          : active
                          ? "bg-accent/[0.12]"
                          : "hover:bg-slate-800/60"
                      } ${archived ? "opacity-60" : ""}`}
                    >
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSelect(it.id)}
                          className="accent-accent cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[13px] text-slate-100">
                          {it.identifier}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <MaturityBadge maturity={it.maturity} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge archived={archived} />
                      </td>
                      <td
                        className="px-4 py-3 text-slate-300 truncate max-w-xs"
                        title={it.description ?? ""}
                      >
                        {it.description || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {u ? (
                          <>
                            <strong className="text-slate-200">
                              {u.providers}
                            </strong>{" "}
                            P ·{" "}
                            <strong className="text-slate-200">
                              {u.accepters}
                            </strong>{" "}
                            A ·{" "}
                            <strong className="text-slate-200">
                              {u.receptacles}
                            </strong>{" "}
                            R
                          </>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatRelative(it.createdAt)}
                      </td>
                      <td
                        className="px-2 py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <RowActions
                          archived={archived}
                          canDelete={archived && totalUsage(u) === 0}
                          onArchiveToggle={() =>
                            archived ? unarchive(it.id) : archive(it.id)
                          }
                          onDelete={() => remove(it.id)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail pane */}
      <div className="w-[440px] bg-slate-800 flex flex-col shrink-0">
        {!draft ? (
          <div className="flex-1 flex items-center justify-center text-center text-xs text-slate-500 p-10 leading-relaxed">
            Select an interface type to view + edit.
            <br />
            <br />
            <span className="text-slate-600">
              or click{" "}
              <strong className="text-accent">New Interface Type</strong> above.
            </span>
          </div>
        ) : (
          <DetailForm
            draft={draft}
            setDraft={setDraft}
            isCreating={isCreating}
            activeItem={activeItem}
            activeUsage={activeUsage}
            saving={saving}
            onClose={closeDetail}
            onSave={doSave}
            onDerive={derive}
            onArchiveToggle={() => {
              if (!activeItem) return;
              if (activeItem.archivedAt) unarchive(activeItem.id);
              else archive(activeItem.id);
            }}
            onDelete={() => {
              if (activeItem) remove(activeItem.id);
            }}
          />
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 rounded-md px-4 py-2.5 text-sm text-slate-100 shadow-lg flex items-center gap-2.5 z-50">
          <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
          {toast}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Subcomponents ─────────────────────────

function MaturityBadge({ maturity }: { maturity: Maturity }) {
  const color =
    maturity === "stable"
      ? "bg-emerald-500/15 text-emerald-400"
      : "bg-amber-500/15 text-amber-400";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${color}`}
    >
      {maturity}
    </span>
  );
}

function StatusBadge({ archived }: { archived: boolean }) {
  const color = archived
    ? "bg-slate-500/15 text-slate-400"
    : "bg-teal-400/10 text-teal-300";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${color}`}
    >
      {archived ? "archived" : "active"}
    </span>
  );
}

function RowActions({
  archived,
  canDelete,
  onArchiveToggle,
  onDelete,
}: {
  archived: boolean;
  canDelete: boolean;
  onArchiveToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex justify-end gap-1">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onArchiveToggle();
        }}
        title={archived ? "Unarchive" : "Archive"}
        className="w-7 h-7 rounded text-slate-500 hover:bg-slate-700 hover:text-slate-200 transition flex items-center justify-center"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="w-3.5 h-3.5"
        >
          {archived ? (
            <>
              <path d="M4 4h16v4H4zM5 8l1 11h12l1-11M9 14l3-3 3 3M12 11v6" />
            </>
          ) : (
            <>
              <path d="M4 4h16v4H4zM5 8l1 11h12l1-11M9 12l3 3 3-3M12 9v6" />
            </>
          )}
        </svg>
      </button>
      {canDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete (archived + 0 usage)"
          className="w-7 h-7 rounded text-slate-500 hover:bg-red-500/15 hover:text-red-400 transition flex items-center justify-center"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="w-3.5 h-3.5"
          >
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
          </svg>
        </button>
      )}
    </div>
  );
}

function EmptyState({
  onCreate,
  filter,
}: {
  onCreate: () => void;
  filter: Filter;
}) {
  if (filter === "archived") {
    return (
      <div className="p-12 text-center text-slate-500 text-sm">
        No archived interface types.
      </div>
    );
  }
  return (
    <div className="p-12 text-center">
      <div className="text-sm text-slate-400 mb-4">
        No interface types defined. Create one to declare compatibility between
        inserts and receptacles.
      </div>
      <button
        onClick={onCreate}
        className="px-4 py-2 bg-accent text-slate-900 text-sm font-semibold rounded hover:bg-accent/90 transition"
      >
        New Interface Type
      </button>
    </div>
  );
}

function DetailForm({
  draft,
  setDraft,
  isCreating,
  activeItem,
  activeUsage,
  saving,
  onClose,
  onSave,
  onDerive,
  onArchiveToggle,
  onDelete,
}: {
  draft: FormDraft;
  setDraft: (d: FormDraft | ((d: FormDraft) => FormDraft)) => void;
  isCreating: boolean;
  activeItem: InterfaceType | null | undefined;
  activeUsage: UsageCounts | undefined;
  saving: boolean;
  onClose: () => void;
  onSave: (m: Maturity) => void;
  onDerive: () => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const archived = !!activeItem?.archivedAt;
  const totalUsage = activeUsage
    ? activeUsage.providers + activeUsage.accepters + activeUsage.receptacles
    : 0;
  const canDelete = archived && totalUsage === 0;
  const isDraft = activeItem?.maturity === "draft";

  const update = <K extends keyof FormDraft>(k: K, v: FormDraft[K]) =>
    setDraft({ ...draft, [k]: v });
  const updateAxis = (
    axis: "width" | "depth" | "height",
    field: "label" | "mm",
    v: string,
  ) =>
    setDraft({
      ...draft,
      unitSystem: {
        ...draft.unitSystem,
        [axis]: { ...draft.unitSystem[axis], [field]: v },
      },
    });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="h-12 px-4 border-b border-slate-700 flex items-center gap-2 shrink-0">
        <div className="text-sm font-semibold text-slate-100 flex items-center gap-2 flex-1 min-w-0 truncate">
          {isCreating ? (
            "New interface type"
          ) : activeItem ? (
            <>
              <span className="font-mono text-accent">
                {activeItem.identifier}
              </span>
              {isDraft && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-500/15 text-amber-400 uppercase tracking-wide">
                  draft
                </span>
              )}
              {archived && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-slate-500/15 text-slate-400 uppercase tracking-wide">
                  archived
                </span>
              )}
            </>
          ) : null}
        </div>
        {!isCreating && activeItem && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="px-2.5 py-1 text-xs text-slate-400 border border-slate-700 rounded hover:bg-slate-900 hover:text-slate-100 flex items-center gap-1"
            >
              Lifecycle
              <svg
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="w-2 h-2"
              >
                <path d="M1 3l4 4 4-4" />
              </svg>
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 mt-1 w-52 bg-slate-900 border border-slate-700 rounded-md shadow-xl z-50 py-1">
                  <button
                    onClick={() => {
                      onArchiveToggle();
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                  >
                    {archived ? "Unarchive" : "Archive"}
                  </button>
                  <div className="h-px bg-slate-700 my-1"></div>
                  <button
                    onClick={() => {
                      if (canDelete) {
                        onDelete();
                        setMenuOpen(false);
                      }
                    }}
                    disabled={!canDelete}
                    title={
                      canDelete ? undefined : "Archive + 0 usage required"
                    }
                    className={`w-full text-left px-3 py-2 text-sm ${
                      canDelete
                        ? "text-red-400 hover:bg-red-500/10"
                        : "text-slate-600 cursor-not-allowed"
                    }`}
                  >
                    Delete
                  </button>
                  {!canDelete && (
                    <div className="px-3 pb-2 text-[10px] text-slate-500">
                      Delete requires archived + 0 usage.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        <button
          onClick={onClose}
          className="w-7 h-7 text-slate-500 hover:text-slate-200 rounded hover:bg-slate-900 flex items-center justify-center"
        >
          ✕
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-auto p-5 space-y-5">
        <FormField
          label="Identifier"
          hint="slug, mutable — FKs are UUID"
        >
          <input
            value={draft.identifier}
            onChange={(e) => update("identifier", e.target.value)}
            placeholder="e.g. gridfinity-42mm"
            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100 text-sm font-mono focus:outline-none focus:border-accent"
          />
        </FormField>

        <FormField
          label="Description"
          hint="shown as tooltip on every chip"
        >
          <textarea
            value={draft.description}
            onChange={(e) => update("description", e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100 text-sm focus:outline-none focus:border-accent min-h-[64px] resize-y"
          />
        </FormField>

        <FormField
          label="Unit System"
          hint="modular interfaces only — input convenience, storage is always mm"
        >
          <div className="flex items-center gap-2.5 mb-2">
            <Toggle
              on={draft.hasUnitSystem}
              onClick={() => update("hasUnitSystem", !draft.hasUnitSystem)}
            />
            <span className="text-xs text-slate-300">
              {draft.hasUnitSystem
                ? "This is a modular system"
                : "Not a modular system"}
            </span>
          </div>
          {draft.hasUnitSystem && (
            <div className="bg-slate-900 border border-slate-700 rounded p-2.5 space-y-1.5">
              {(["width", "depth", "height"] as const).map((axis) => (
                <div
                  key={axis}
                  className="grid grid-cols-[52px_1fr_1fr] gap-2 items-center"
                >
                  <div className="text-xs text-slate-400 capitalize">
                    {axis}
                  </div>
                  <input
                    value={draft.unitSystem[axis].label}
                    onChange={(e) => updateAxis(axis, "label", e.target.value)}
                    placeholder="label (e.g. u, h)"
                    className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-100 focus:outline-none focus:border-accent"
                  />
                  <div className="relative">
                    <input
                      type="number"
                      value={draft.unitSystem[axis].mm}
                      onChange={(e) => updateAxis(axis, "mm", e.target.value)}
                      placeholder="mm"
                      className="w-full px-2 py-1 pr-6 bg-slate-800 border border-slate-700 rounded text-xs text-slate-100 focus:outline-none focus:border-accent"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 pointer-events-none">
                      mm
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </FormField>

        <FormField
          label="Physical Contract"
          hint="free-form notes; structured fields later"
        >
          <textarea
            value={draft.physicalContractNotes}
            onChange={(e) => update("physicalContractNotes", e.target.value)}
            placeholder="Footprint, mounting, clearance notes. Structured fields coming later."
            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100 text-sm focus:outline-none focus:border-accent min-h-[64px] resize-y"
          />
        </FormField>

        {activeItem && !isCreating && activeUsage && (
          <FormField label="Usage">
            <div className="bg-slate-900 border border-slate-700 rounded p-3 text-xs space-y-1.5">
              <UsageLine
                label="Templates providing this"
                value={activeUsage.providers}
              />
              <UsageLine
                label="Templates accepting this"
                value={activeUsage.accepters}
              />
              <UsageLine
                label="Receptacles accepting this"
                value={activeUsage.receptacles}
              />
            </div>
          </FormField>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-700 px-4 py-3 flex gap-2 shrink-0">
        {!isCreating && activeItem && (
          <button
            onClick={onDerive}
            disabled={saving}
            className="px-3 py-1.5 bg-slate-900 text-slate-200 text-sm rounded border border-slate-700 hover:bg-slate-700 disabled:opacity-50 flex items-center gap-1.5"
            title="Create a new interface pre-filled from this one"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="w-3.5 h-3.5"
            >
              <path d="M12 5v14M8 9l4-4 4 4M20 20H4" />
            </svg>
            Derive new
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={onClose}
          disabled={saving}
          className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 rounded disabled:opacity-50"
        >
          Cancel
        </button>
        <SaveButtons
          isCreating={isCreating}
          isDraft={isDraft}
          saving={saving}
          onSave={onSave}
        />
      </div>
    </div>
  );
}

function SaveButtons({
  isCreating,
  isDraft,
  saving,
  onSave,
}: {
  isCreating: boolean;
  isDraft: boolean;
  saving: boolean;
  onSave: (m: Maturity) => void;
}) {
  // Create: "Save as draft" + "Create" (stable)
  if (isCreating) {
    return (
      <>
        <button
          onClick={() => onSave("draft")}
          disabled={saving}
          className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 rounded disabled:opacity-50"
        >
          Save as draft
        </button>
        <button
          onClick={() => onSave("stable")}
          disabled={saving}
          className="px-3 py-1.5 bg-accent text-slate-900 text-sm font-semibold rounded hover:bg-accent/90 disabled:opacity-50"
        >
          Create
        </button>
      </>
    );
  }
  // Edit draft: "Save as draft" + "Save" (promotes)
  if (isDraft) {
    return (
      <>
        <button
          onClick={() => onSave("draft")}
          disabled={saving}
          className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 rounded disabled:opacity-50"
        >
          Save as draft
        </button>
        <button
          onClick={() => onSave("stable")}
          disabled={saving}
          title="Publish — promote draft to stable"
          className="px-3 py-1.5 bg-accent text-slate-900 text-sm font-semibold rounded hover:bg-accent/90 disabled:opacity-50"
        >
          Save
        </button>
      </>
    );
  }
  // Edit stable: single "Save" (no demotion)
  return (
    <button
      onClick={() => onSave("stable")}
      disabled={saving}
      className="px-3 py-1.5 bg-accent text-slate-900 text-sm font-semibold rounded hover:bg-accent/90 disabled:opacity-50"
    >
      Save
    </button>
  );
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1.5">
        {label}
        {hint && (
          <span className="normal-case font-normal text-slate-500 ml-1.5">
            {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

function UsageLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <strong className="text-slate-100">{value}</strong>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-9 h-5 rounded-full relative transition cursor-pointer ${
        on ? "bg-accent" : "bg-slate-700"
      }`}
      aria-pressed={on}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 bg-slate-100 rounded-full transition ${
          on ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return "today";
  if (diff < 2 * day) return "yesterday";
  const days = Math.floor(diff / day);
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}
