"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface Module {
  id: string;
  name: string;
  description: string | null;
  primaryDimensionLabel: string;
  primaryDimensionCount: number;
  updatedAt: string;
}

interface LevelRow {
  id: string;
  moduleId: string;
  label: string;
  locationType: string;
  interfaceTypeAccepted: string | null;
  isDisabled: boolean;
  parentId: string | null;
  createdAt: string;
}

interface InsertRow {
  id: string;
  name: string | null;
  templateName: string | null;
  locationId: string | null;
  cellCount: number;
  assignedCount: number;
}

export default function ModulesPage() {
  const router = useRouter();
  const [modules, setModules] = useState<Module[]>([]);
  const [levelsByModule, setLevelsByModule] = useState<Map<string, LevelRow[]>>(
    new Map()
  );
  const [insertsByReceptacle, setInsertsByReceptacle] = useState<
    Map<string, InsertRow>
  >(new Map());
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const modRes = await fetch("/api/modules");
      const modData = await modRes.json();
      const mods: Module[] = modData.modules ?? [];
      setModules(mods);

      if (mods.length === 0) {
        setLevelsByModule(new Map());
        setInsertsByReceptacle(new Map());
        return;
      }

      // Fetch level lists + insert placements in parallel per module
      const [allLevels, allInserts] = await Promise.all([
        Promise.all(
          mods.map((m) =>
            fetch(`/api/locations?moduleId=${m.id}`).then((r) => r.json())
          )
        ),
        Promise.all(
          mods.map((m) =>
            fetch(`/api/inserts?moduleId=${m.id}&placement=placed`).then(
              (r) => r.json()
            )
          )
        ),
      ]);

      const levelMap = new Map<string, LevelRow[]>();
      mods.forEach((m, i) => {
        const locs: LevelRow[] = allLevels[i].locations ?? [];
        const topLevels = locs.filter((l) => l.parentId === null);
        const allNumeric = topLevels.every(
          (l) => l.label.trim() !== "" && !Number.isNaN(Number(l.label))
        );
        const levels = topLevels.sort((a, b) => {
          if (allNumeric) return Number(a.label) - Number(b.label);
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });
        levelMap.set(m.id, levels);
      });
      setLevelsByModule(levelMap);

      const insMap = new Map<string, InsertRow>();
      for (const d of allInserts) {
        for (const ins of (d.inserts ?? []) as InsertRow[]) {
          if (ins.locationId) insMap.set(ins.locationId, ins);
        }
      }
      setInsertsByReceptacle(insMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function openLevel(moduleId: string, levelId: string) {
    // Seed the last-selected-level so the module page opens on the clicked level
    try {
      localStorage.setItem(
        `wheretf.module.${moduleId}.selectedLevel`,
        levelId
      );
    } catch {}
    router.push(`/modules/${moduleId}`);
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <p className="text-slate-500">
          No modules yet. Create one to start organizing.
        </p>
        <Link
          href="/modules/new"
          className="px-4 py-2 bg-accent text-white rounded-md hover:brightness-110 transition-all"
        >
          New Module
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 p-6 overflow-y-auto">
      <h1 className="text-xl font-semibold text-slate-100 mb-6">Modules</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {modules.map((m) => {
          const levels = levelsByModule.get(m.id) ?? [];
          const filled = levels.filter(
            (l) => l.locationType === "receptacle" && insertsByReceptacle.has(l.id)
          ).length;
          const receptacles = levels.filter(
            (l) => l.locationType === "receptacle"
          ).length;
          return (
            <div
              key={m.id}
              className="bg-slate-800/40 border border-slate-700 rounded-lg flex flex-col overflow-hidden shadow-sm hover:border-slate-600 transition-colors"
            >
              <Link
                href={`/modules/${m.id}`}
                className="px-4 pt-3 pb-2 group hover:bg-slate-800/60 transition-colors flex items-baseline justify-between gap-2"
              >
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-100 group-hover:text-accent transition-colors truncate">
                    {m.name}
                  </h2>
                  {m.description && (
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                      {m.description}
                    </p>
                  )}
                </div>
                {receptacles > 0 && (
                  <span className="text-[10px] text-slate-500 tabular-nums shrink-0">
                    {filled}/{receptacles}
                  </span>
                )}
              </Link>
              {levels.length > 0 && (
                <div className="relative mx-3 mb-3 rounded-md border border-slate-600/70 bg-gradient-to-b from-slate-900/60 to-slate-950/60 overflow-hidden">
                  {/* cabinet side-rails (subtle inner shadow) */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-gradient-to-r from-slate-950/80 to-transparent"
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 right-0 w-0.5 bg-gradient-to-l from-slate-950/80 to-transparent"
                  />
                  <ul className="flex flex-col max-h-80 overflow-y-auto divide-y divide-slate-700/70">
                    {levels.map((l) => {
                      const ins = insertsByReceptacle.get(l.id);
                      const clickable = !l.isDisabled;
                      return (
                        <li
                          key={l.id}
                          onClick={
                            clickable ? () => openLevel(m.id, l.id) : undefined
                          }
                          className={`relative group/level px-2 py-1.5 text-xs flex items-center gap-2 transition-colors ${
                            clickable
                              ? "cursor-pointer hover:bg-slate-700/40"
                              : "opacity-50"
                          } ${l.isDisabled ? "bg-red-950/20" : ""}`}
                        >
                          <span className="text-slate-100 font-medium tabular-nums w-10 shrink-0 text-center">
                            {l.label}
                          </span>
                          {ins ? (
                            <span className="text-slate-200 truncate flex-1">
                              {ins.name ?? ins.templateName ?? "insert"}
                            </span>
                          ) : l.locationType === "receptacle" ? (
                            <span className="text-slate-500 italic truncate flex-1">
                              empty
                            </span>
                          ) : (
                            <span className="text-slate-600 truncate flex-1">
                              {l.locationType}
                            </span>
                          )}
                          {ins && ins.cellCount > 0 && (
                            <span
                              className={`shrink-0 tabular-nums text-[10px] px-1.5 py-0.5 rounded ${
                                ins.assignedCount === 0
                                  ? "bg-slate-700/60 text-slate-400"
                                  : ins.assignedCount >= ins.cellCount
                                    ? "bg-accent/20 text-accent"
                                    : "bg-blue-900/40 text-blue-300"
                              }`}
                              title={`${ins.assignedCount} of ${ins.cellCount} cells assigned`}
                            >
                              {ins.assignedCount}/{ins.cellCount}
                            </span>
                          )}
                          {l.isDisabled && (
                            <span className="text-red-400 shrink-0 text-[10px] uppercase tracking-wider">
                              off
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
