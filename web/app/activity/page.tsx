"use client";

import { useCallback, useEffect, useState } from "react";
import Spinner from "../components/Spinner";

interface Transaction {
  id: string;
  parentId: string | null;
  actionType: string;
  entityType: string;
  entityId: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  isUndone: boolean;
  undoneByTransactionId: string | null;
  createdAt: string;
}

const ENTITY_COLORS: Record<string, string> = {
  assignment: "bg-blue-900/40 text-blue-300",
  insert: "bg-purple-900/40 text-purple-300",
  location: "bg-emerald-900/40 text-emerald-300",
  module: "bg-amber-900/40 text-amber-300",
  template: "bg-rose-900/40 text-rose-300",
  item: "bg-cyan-900/40 text-cyan-300",
};

function formatAction(actionType: string): string {
  // "assignment.create" → "Created assignment"
  const [entity, action] = actionType.split(".");
  const pastTense: Record<string, string> = {
    create: "Created",
    update: "Updated",
    delete: "Deleted",
    place: "Placed",
    move: "Moved",
    removeFromLocation: "Removed from location",
    convertToPlaced: "Converted to placed",
    merge: "Merged",
    divide: "Divided",
    disable: "Disabled",
    enable: "Enabled",
    publishVersion: "Published version",
    setActiveVersion: "Set active version",
  };
  return `${pastTense[action] || action} ${entity}`;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

function getEntityName(state: Record<string, unknown> | null): string | null {
  if (!state) return null;
  return (
    (state.name as string) ||
    (state.label as string) ||
    (state.path as string) ||
    null
  );
}

export default function ActivityPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [entityFilter, setEntityFilter] = useState<string>("");
  const [limit, setLimit] = useState(50);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/transactions?limit=${limit}`);
      const data = await res.json();
      setTransactions(data.transactions || []);
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const filtered = entityFilter
    ? transactions.filter((t) => t.entityType === entityFilter)
    : transactions;

  const entityTypes = [
    ...new Set(transactions.map((t) => t.entityType)),
  ].sort();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-700">
        <h1 className="text-lg font-semibold text-slate-100">Activity</h1>
        <span className="text-xs text-slate-500">
          {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
        </span>

        {/* Entity filter */}
        <div className="ml-auto flex items-center gap-2">
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-300 focus:border-accent focus:outline-none"
          >
            <option value="">All types</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {limit <= 50 && (
            <button
              onClick={() => setLimit(200)}
              className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
            >
              Show more
            </button>
          )}
        </div>
      </div>

      {/* Transaction list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-accent">
            <Spinner size={32} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
            No transactions recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {filtered.map((tx) => {
              const isExpanded = expandedId === tx.id;
              const entityName =
                getEntityName(tx.afterState) ||
                getEntityName(tx.beforeState);
              const colorClass =
                ENTITY_COLORS[tx.entityType] || "bg-slate-700 text-slate-300";

              return (
                <div key={tx.id}>
                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : tx.id)
                    }
                    className={`w-full text-left px-6 py-3 flex items-center gap-3 hover:bg-slate-800/30 transition-colors ${
                      tx.isUndone ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-200">
                          {formatAction(tx.actionType)}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${colorClass}`}
                        >
                          {tx.entityType}
                        </span>
                        {tx.isUndone && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/40 text-red-300">
                            undone
                          </span>
                        )}
                      </div>
                      {entityName && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {entityName}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 shrink-0 tabular-nums">
                      {formatTime(tx.createdAt)}
                    </span>
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="px-6 pb-4">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <h4 className="font-medium text-slate-400 mb-1">
                            Before
                          </h4>
                          <pre className="bg-slate-800/60 rounded p-2 text-slate-400 overflow-x-auto max-h-48 overflow-y-auto">
                            {tx.beforeState
                              ? JSON.stringify(tx.beforeState, null, 2)
                              : "null"}
                          </pre>
                        </div>
                        <div>
                          <h4 className="font-medium text-slate-400 mb-1">
                            After
                          </h4>
                          <pre className="bg-slate-800/60 rounded p-2 text-slate-400 overflow-x-auto max-h-48 overflow-y-auto">
                            {tx.afterState
                              ? JSON.stringify(tx.afterState, null, 2)
                              : "null"}
                          </pre>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-600 mt-2 font-mono">
                        {tx.id}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
