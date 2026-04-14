"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

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
        <div className="p-4 border-b border-slate-700">
          <h1 className="text-base font-semibold text-slate-100">Inserts</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Physical instances of templates (Plano boxes, Gridfinity bins,
            drawer dividers, …)
          </p>
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
                  ins.name ||
                  (ins.uid ? `#${ins.uid}` : `${ins.templateName ?? "Insert"}`);
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
                        {ins.uid && (
                          <span className="text-[10px] font-mono text-slate-500 shrink-0">
                            {ins.uid}
                          </span>
                        )}
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

  useEffect(() => {
    setDraftName(insert.name ?? "");
    setEditing(false);
  }, [insert.id, insert.name]);

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
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <div className="p-6 border-b border-slate-700 space-y-2">
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
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-100 truncate flex-1">
              {insert.name ||
                insert.templateName ||
                (insert.uid ? `#${insert.uid}` : "Untitled insert")}
            </h2>
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-slate-400 hover:text-accent"
            >
              Edit
            </button>
          </div>
        )}
        {insert.uid && (
          <div className="text-xs font-mono text-slate-500">
            UID {insert.uid}
          </div>
        )}
      </div>

      <div className="p-6 grid grid-cols-2 gap-x-6 gap-y-4 max-w-2xl">
        <Field label="Template">
          {insert.templateId ? (
            <Link
              href={`/templates?selected=${insert.templateId}`}
              className="text-slate-200 hover:text-accent"
            >
              {insert.templateName ?? "(unknown)"}
            </Link>
          ) : (
            <span className="text-slate-500">—</span>
          )}
        </Field>
        <Field label="Interface">
          {insert.interfaceType ? (
            <span className="inline-block text-xs px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300">
              {insert.interfaceType}
            </span>
          ) : (
            <span className="text-slate-500">—</span>
          )}
        </Field>
        <Field label="Dimensions">
          {insert.rows != null && insert.columns != null
            ? `${insert.rows} × ${insert.columns}`
            : "—"}
        </Field>
        <Field label="Placement">
          {insert.locationPath ? (
            <span>
              {insert.moduleName && (
                <Link
                  href={`/modules/`}
                  className="text-slate-200 hover:text-accent"
                >
                  {insert.moduleName}
                </Link>
              )}{" "}
              <span className="text-slate-400">
                {insert.locationPath.replace(
                  insert.moduleName ? insert.moduleName + ":" : "",
                  ""
                )}
              </span>
            </span>
          ) : (
            <span className="text-amber-400">Unplaced</span>
          )}
        </Field>
      </div>

      <div className="p-6 pt-0 mt-auto flex items-center gap-2 border-t border-slate-700 pt-4">
        {insert.locationId && (
          <button
            onClick={unplace}
            className="px-3 py-1.5 border border-slate-600 text-slate-300 rounded text-xs hover:bg-slate-700/50"
          >
            Unplace
          </button>
        )}
        <button
          onClick={deleteInsert}
          className="ml-auto px-3 py-1.5 border border-red-900/60 text-red-400 rounded text-xs hover:bg-red-900/20"
        >
          Delete insert
        </button>
      </div>
    </div>
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
