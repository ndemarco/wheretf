"use client";

import { useEffect, useRef, useState } from "react";

interface CategoryOption {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

export default function CreateItemModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (itemId: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(
    new Set()
  );
  const [primaryCategoryId, setPrimaryCategoryId] = useState<string | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Fetch categories when modal opens
  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setSelectedCategoryIds(new Set());
    setPrimaryCategoryId(null);
    setSubmitting(false);

    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => setCategories(data.categories || []))
      .catch(console.error);

    // Focus name input after render
    requestAnimationFrame(() => nameRef.current?.focus());
  }, [open]);

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (primaryCategoryId === id) setPrimaryCategoryId(null);
      } else {
        next.add(id);
        // Auto-set primary if it's the first selection
        if (next.size === 1) setPrimaryCategoryId(id);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);

    try {
      // Create item
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { item } = await res.json();

      // Apply categories
      for (const categoryId of selectedCategoryIds) {
        await fetch(`/api/items/${item.id}/categories`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId,
            isPrimary: categoryId === primaryCategoryId,
          }),
        });
      }

      onCreated(item.id);
    } catch (err) {
      console.error("Failed to create item:", err);
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
          <h2 className="text-sm font-semibold text-slate-100">New Item</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Name
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) handleSubmit();
                if (e.key === "Escape") onClose();
              }}
              placeholder="e.g. M3x10 Socket Head Cap Screw"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-slate-100 outline-none focus:border-accent placeholder:text-slate-600 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) handleSubmit();
                if (e.key === "Escape") onClose();
              }}
              placeholder="Optional — brief description"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-slate-100 outline-none focus:border-accent placeholder:text-slate-600 transition-colors"
            />
          </div>

          {/* Categories */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Categories
            </label>
            {categories.length === 0 ? (
              <p className="text-xs text-slate-600 italic">
                No categories defined
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => {
                  const selected = selectedCategoryIds.has(cat.id);
                  const isPrimary = primaryCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      onDoubleClick={() => {
                        if (selectedCategoryIds.has(cat.id)) {
                          setPrimaryCategoryId(cat.id);
                        }
                      }}
                      title={
                        selected
                          ? isPrimary
                            ? `${cat.name} (primary)`
                            : `${cat.name} — double-click to set primary`
                          : cat.name
                      }
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        selected
                          ? isPrimary
                            ? "bg-accent/20 border-accent text-accent"
                            : "bg-slate-700 border-slate-500 text-slate-200"
                          : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      {cat.icon && <span>{cat.icon}</span>}
                      <span>{cat.name}</span>
                      {isPrimary && <span className="text-[10px]">★</span>}
                    </button>
                  );
                })}
              </div>
            )}
            {selectedCategoryIds.size > 1 && (
              <p className="text-[10px] text-slate-600 mt-1">
                Double-click a selected category to set it as primary
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || submitting}
            className="px-4 py-1.5 bg-accent hover:bg-accent/80 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-colors"
          >
            {submitting ? "Creating..." : "Create Item"}
          </button>
        </div>
      </div>
    </div>
  );
}
