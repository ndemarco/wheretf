"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface CreateFromDesignationDialogProps {
  designationId: string;
  designation: string;
  standardId: string;
  standardName: string;
  onClose: () => void;
  onCreated?: (itemId: string) => void;
}

interface AspectLink {
  aspectId: string;
  aspectName: string;
}

interface CategorySuggestion {
  categoryId: string;
  name: string;
  icon: string | null;
  color: string | null;
  matched: number;
  total: number;
  score: number;
}

interface CategoryRow {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

export default function CreateFromDesignationDialog({
  designationId,
  designation,
  standardId,
  standardName,
  onClose,
  onCreated,
}: CreateFromDesignationDialogProps) {
  const router = useRouter();
  const [linkedAspects, setLinkedAspects] = useState<AspectLink[]>([]);
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [allCategories, setAllCategories] = useState<CategoryRow[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load everything the dialog needs.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [stdRes, catsRes] = await Promise.all([
          fetch(`/api/standards/${standardId}`),
          fetch("/api/categories"),
        ]);
        const std = await stdRes.json();
        const cats = await catsRes.json();
        if (cancelled) return;

        const aspects: AspectLink[] = (std.aspects ?? []).map(
          (a: { aspectId: string; aspectName: string }) => ({
            aspectId: a.aspectId,
            aspectName: a.aspectName,
          })
        );
        setLinkedAspects(aspects);
        setAllCategories(cats.categories ?? []);

        // Fetch suggestions based on the standard + its linked aspects.
        const params = new URLSearchParams();
        params.set("standardId", standardId);
        for (const a of aspects) params.append("aspectId", a.aspectId);
        const sugRes = await fetch(
          `/api/items/suggest-categories?${params.toString()}`
        );
        const sug = await sugRes.json();
        if (cancelled) return;
        setSuggestions(sug.suggestions ?? []);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [standardId]);

  // Auto-fill the name when category changes.
  // Universal rule for now: "{designation} {category.name}".
  // TODO: replace with AI-generated name once that layer exists.
  const defaultName = useCallback(() => {
    const cat =
      allCategories.find((c) => c.id === selectedCategoryId)?.name ??
      suggestions.find((s) => s.categoryId === selectedCategoryId)?.name ??
      "";
    return cat ? `${designation} ${cat}` : designation;
  }, [allCategories, suggestions, selectedCategoryId, designation]);

  useEffect(() => {
    setName(defaultName());
  }, [defaultName]);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      // 1. Create the item.
      const createRes = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const createData = await createRes.json();
      if (!createRes.ok)
        throw new Error(createData.error || "Failed to create item");
      const itemId = createData.item.id;

      // 2. Apply standard + designation (auto-fill fires server-side).
      await fetch(`/api/items/${itemId}/standards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ standardId, designationId }),
      });

      // 3. Apply each linked aspect.
      await Promise.all(
        linkedAspects.map((a) =>
          fetch(`/api/items/${itemId}/aspects`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ aspectId: a.aspectId }),
          })
        )
      );

      // 4. Apply category if chosen.
      if (selectedCategoryId) {
        await fetch(`/api/items/${itemId}/categories`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: selectedCategoryId,
            isPrimary: true,
          }),
        });
      }

      onCreated?.(itemId);
      onClose();
      router.push(`/items?selected=${itemId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  }

  const suggestedIds = new Set(suggestions.map((s) => s.categoryId));
  const remainingCategories = allCategories.filter(
    (c) => !suggestedIds.has(c.id)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl w-full max-w-xl mx-4">
        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">
            New item from designation
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-base font-semibold text-slate-100">
              {standardName}
            </span>
            <span className="text-slate-500">·</span>
            <span className="font-mono text-accent">{designation}</span>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-900/30 border border-red-700/50 rounded text-red-300 text-xs">
              {error}
            </div>
          )}

          {/* Aspects (informational) */}
          {linkedAspects.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">
                Aspects applied automatically
              </div>
              <div className="flex flex-wrap gap-1.5">
                {linkedAspects.map((a) => (
                  <span
                    key={a.aspectId}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded-full text-[11px] text-slate-300"
                  >
                    {a.aspectName}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Category suggestions */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">
              Category
            </div>
            {suggestions.length === 0 && !showAll && (
              <p className="text-xs text-slate-500 italic mb-2">
                No suggestions (empty or non-overlapping catalog). Pick one
                below.
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => {
                const isSel = selectedCategoryId === s.categoryId;
                return (
                  <button
                    key={s.categoryId}
                    onClick={() =>
                      setSelectedCategoryId(isSel ? null : s.categoryId)
                    }
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      isSel
                        ? "bg-accent/20 border-accent text-accent"
                        : "bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500"
                    }`}
                  >
                    {s.icon && <span>{s.icon}</span>}
                    <span>{s.name}</span>
                    <span className="text-[10px] text-slate-500 tabular-nums">
                      {Math.round(s.score * 100)}%
                    </span>
                  </button>
                );
              })}
              <button
                onClick={() => setShowAll((v) => !v)}
                className="text-[11px] text-slate-500 hover:text-slate-300 px-2"
              >
                {showAll ? "Hide all" : "Show all…"}
              </button>
            </div>
            {showAll && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {remainingCategories.map((c) => {
                  const isSel = selectedCategoryId === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() =>
                        setSelectedCategoryId(isSel ? null : c.id)
                      }
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        isSel
                          ? "bg-accent/20 border-accent text-accent"
                          : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      {c.icon && <span>{c.icon}</span>}
                      <span>{c.name}</span>
                    </button>
                  );
                })}
                {remainingCategories.length === 0 && (
                  <span className="text-xs text-slate-600 italic">
                    No other categories.
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Name */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">
              Name
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-slate-100 focus:border-accent focus:outline-none"
              placeholder={defaultName()}
            />
            <p className="mt-1 text-[11px] text-slate-600 leading-snug">
              Auto-filled from designation + category. Override freely.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={creating}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="px-4 py-1.5 bg-accent text-white rounded text-xs hover:brightness-110 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create item"}
          </button>
        </div>
      </div>
    </div>
  );
}
