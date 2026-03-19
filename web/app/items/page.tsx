"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import FilterPanel from "./FilterPanel";
import ItemGrid from "./ItemGrid";
import ItemDetail from "./ItemDetail";
import CreateItemModal from "./CreateItemModal";

interface RichItem {
  id: string;
  name: string;
  description: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  categories: {
    categoryId: string;
    isPrimary: boolean;
    name: string;
    icon: string | null;
    color: string | null;
  }[];
  aspects: {
    itemAspectId: string;
    aspectId: string;
    name: string;
    description: string | null;
    parameters: {
      parameterDefinitionId: string;
      itemAspectId: string | null;
      value: unknown;
      parameterName: string;
      dataType: string;
      unit: string | null;
      constraints: unknown;
    }[];
  }[];
  standaloneParameters: {
    parameterDefinitionId: string;
    itemAspectId: null;
    value: unknown;
    parameterName: string;
    dataType: string;
    unit: string | null;
    constraints: unknown;
  }[];
  assignments: {
    assignmentType: string;
    locationId: string;
    locationPath: string;
  }[];
}

interface CategoryCount {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  count: number;
}

interface FilterPill {
  parameterDefinitionId: string;
  parameterName: string;
  value: unknown;
}

function ItemsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [items, setItems] = useState<RichItem[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<CategoryCount[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    searchParams.get("selected")
  );
  const [loading, setLoading] = useState(true);

  // Parse state from URL
  const query = searchParams.get("q") || "";
  const categoryId = searchParams.get("category") || "";
  const sortBy = searchParams.get("sort") || "name";
  const sortDirection = (searchParams.get("dir") || "asc") as "asc" | "desc";

  // Parse filter pills from URL: filter=paramDefId:value,paramDefId:value
  const filterParam = searchParams.get("filter") || "";
  const [filterPills, setFilterPills] = useState<FilterPill[]>([]);

  // Update URL params
  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      router.replace(`/items?${params.toString()}`, { scroll: false });
    },
    [searchParams, router]
  );

  // Fetch items
  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (filterParam) params.set("filter", filterParam);
    if (categoryId) params.set("category", categoryId);
    if (sortBy) params.set("sort", sortBy);
    if (sortDirection) params.set("dir", sortDirection);

    try {
      const [itemsRes, countsRes] = await Promise.all([
        fetch(`/api/items?${params.toString()}`),
        fetch(`/api/categories/counts?${params.toString()}`),
      ]);
      const itemsData = await itemsRes.json();
      const countsData = await countsRes.json();
      setItems(itemsData.items || []);
      setCategoryCounts(countsData.categories || []);
    } catch (err) {
      console.error("Failed to fetch items:", err);
    } finally {
      setLoading(false);
    }
  }, [query, filterParam, categoryId, sortBy, sortDirection]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Parse filter pills from URL on mount/change
  useEffect(() => {
    if (!filterParam) {
      setFilterPills([]);
      return;
    }
    // We need parameter names for display — extract from current items or fetch separately
    // For now, parse what we have
    const pills = filterParam.split(",").map((f) => {
      const colonIdx = f.indexOf(":");
      const parameterDefinitionId = f.slice(0, colonIdx);
      const rawValue = f.slice(colonIdx + 1);
      let value: unknown;
      try {
        value = JSON.parse(rawValue);
      } catch {
        value = rawValue;
      }
      return { parameterDefinitionId, parameterName: "", value };
    });
    setFilterPills(pills);
  }, [filterParam]);

  // Resolve pill parameter names from loaded items
  useEffect(() => {
    if (filterPills.length === 0 || items.length === 0) return;

    const needsNames = filterPills.some((p) => !p.parameterName);
    if (!needsNames) return;

    // Build a map of paramDefId -> name from any item's parameters
    const nameMap = new Map<string, string>();
    for (const item of items) {
      for (const aspect of item.aspects) {
        for (const param of aspect.parameters) {
          nameMap.set(param.parameterDefinitionId, param.parameterName);
        }
      }
      for (const param of item.standaloneParameters) {
        nameMap.set(param.parameterDefinitionId, param.parameterName);
      }
    }

    setFilterPills((prev) =>
      prev.map((p) => ({
        ...p,
        parameterName: p.parameterName || nameMap.get(p.parameterDefinitionId) || p.parameterDefinitionId,
      }))
    );
  }, [items, filterPills]);

  const addFilter = useCallback(
    (parameterDefinitionId: string, parameterName: string, value: unknown) => {
      const valueStr = typeof value === "string" ? value : JSON.stringify(value);
      const newEntry = `${parameterDefinitionId}:${valueStr}`;
      const current = filterParam ? filterParam.split(",") : [];
      // Don't add duplicate
      if (current.includes(newEntry)) return;
      const updated = [...current, newEntry].join(",");
      updateParams({ filter: updated });
      setFilterPills((prev) => [
        ...prev,
        { parameterDefinitionId, parameterName, value },
      ]);
    },
    [filterParam, updateParams]
  );

  const removeFilter = useCallback(
    (parameterDefinitionId: string) => {
      const current = filterParam ? filterParam.split(",") : [];
      const updated = current
        .filter((f) => !f.startsWith(parameterDefinitionId + ":"))
        .join(",");
      updateParams({ filter: updated || null });
    },
    [filterParam, updateParams]
  );

  const setQuery = useCallback(
    (q: string) => updateParams({ q: q || null }),
    [updateParams]
  );

  const setCategoryFilter = useCallback(
    (catId: string) => {
      updateParams({ category: catId === categoryId ? null : catId });
    },
    [categoryId, updateParams]
  );

  const setSort = useCallback(
    (column: string) => {
      if (column === sortBy) {
        updateParams({ dir: sortDirection === "asc" ? "desc" : "asc" });
      } else {
        updateParams({ sort: column, dir: "asc" });
      }
    },
    [sortBy, sortDirection, updateParams]
  );

  const [createModalOpen, setCreateModalOpen] = useState(false);

  const handleItemCreated = useCallback(
    (itemId: string) => {
      setCreateModalOpen(false);
      // Clear filters so the new item is visible regardless of category
      updateParams({ q: null, category: null, filter: null });
      setSelectedItemId(itemId);
    },
    [updateParams]
  );

  const selectedItem = items.find((i) => i.id === selectedItemId) || null;

  return (
    <div className="flex-1 flex min-w-0 h-full">
      <FilterPanel
        query={query}
        onQueryChange={setQuery}
        filterPills={filterPills}
        onRemoveFilter={removeFilter}
        categoryCounts={categoryCounts}
        activeCategoryId={categoryId}
        onCategoryClick={setCategoryFilter}
      />

      <ItemGrid
        items={items}
        loading={loading}
        selectedItemId={selectedItemId}
        onSelectItem={setSelectedItemId}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSort={setSort}
        onRefresh={fetchItems}
        onCreateItem={() => setCreateModalOpen(true)}
      />

      <ItemDetail
        item={selectedItem}
        onAddFilter={addFilter}
        onRefresh={fetchItems}
      />

      <CreateItemModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleItemCreated}
      />
    </div>
  );
}

export default function ItemsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center text-slate-500">
          Loading...
        </div>
      }
    >
      <ItemsPageInner />
    </Suspense>
  );
}
