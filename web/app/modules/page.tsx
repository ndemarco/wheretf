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
}

interface InsertRow {
  id: string;
  name: string | null;
  templateName: string | null;
  locationId: string | null;
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
        const levels = locs
          .filter((l) => l.parentId === null)
          .sort((a, b) => {
            const na = Number(a.label);
            const nb = Number(b.label);
            if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
            return a.label.localeCompare(b.label);
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-100">Modules</h1>
        <Link
          href="/modules/new"
          className="px-4 py-2 bg-accent text-white rounded-md hover:brightness-110 transition-all text-sm"
        >
          New Module
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {modules.map((m) => {
          const levels = levelsByModule.get(m.id) ?? [];
          return (
            <div
              key={m.id}
              className="bg-slate-800/50 border border-slate-700 rounded-lg flex flex-col overflow-hidden"
            >
              <Link
                href={`/modules/${m.id}`}
                className="p-4 group hover:bg-slate-800 transition-colors"
              >
                <h2 className="text-base font-semibold text-slate-100 group-hover:text-accent transition-colors">
                  {m.name}
                </h2>
                {m.description && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {m.description}
                  </p>
                )}
              </Link>
              {levels.length > 0 && (
                <ul className="border-t border-slate-700/60 max-h-80 overflow-y-auto">
                  {levels.map((l) => {
                    const ins = insertsByReceptacle.get(l.id);
                    return (
                      <li key={l.id}>
                        <button
                          onClick={() => openLevel(m.id, l.id)}
                          className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-slate-700/40 border-b border-slate-700/30 last:border-b-0 transition-colors"
                        >
                          <span className="text-slate-100 font-medium tabular-nums w-6 shrink-0">
                            {l.label}
                          </span>
                          {ins ? (
                            <span className="text-slate-300 truncate flex-1">
                              {ins.name ?? ins.templateName ?? "insert"}
                            </span>
                          ) : l.locationType === "receptacle" ? (
                            <span className="text-slate-500 italic truncate flex-1">
                              empty
                              {l.interfaceTypeAccepted && (
                                <>
                                  {" "}
                                  <span className="text-blue-300 not-italic">
                                    · {l.interfaceTypeAccepted}
                                  </span>
                                </>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-600 truncate flex-1">
                              {l.locationType}
                            </span>
                          )}
                          {l.isDisabled && (
                            <span className="text-red-400 shrink-0">
                              disabled
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
