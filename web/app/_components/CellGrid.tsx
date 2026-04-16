"use client";

import React from "react";

export interface CellRow {
  id: string;
  label: string;
  path: string;
  parentId: string | null;
  locationType: string;
  gridRow: number | null;
  gridColumn: number | null;
  isDisabled: boolean;
  disableReason: string | null;
  maxWidthMm: string | null;
  maxHeightMm: string | null;
  maxDepthMm: string | null;
  restrictReason: string | null;
  mergedIntoId: string | null;
  subdivisionSource: string | null;
}

export interface CellAssignment {
  id: string;
  itemId: string;
  locationId: string;
  assignmentType: "placed" | "provisional";
}

export interface ItemRef {
  id: string;
  name: string;
  description: string | null;
}

/**
 * Shared HTML+CSS Grid renderer for cell layouts.
 * Used by both the insert detail (interactive multi-select for merge) and
 * the module detail (single-select, no merge UI \u2014 caller passes an
 * empty multiSelect).
 *
 * Caller controls behavior; this component just renders + dispatches clicks.
 */
/**
 * Infer divide orientation from the children's labels.
 * Vertical split (front/rear, top/bottom) when any child label hints at
 * a near/far or up/down axis; horizontal (left/right, 1/2/3) otherwise.
 */
function inferDivideOrientation(children: CellRow[]): "horizontal" | "vertical" {
  const verticalWords = /^(front|rear|back|top|bottom|up|down|upper|lower|near|far)$/i;
  if (children.some((c) => verticalWords.test(c.label.trim()))) {
    return "vertical";
  }
  return "horizontal";
}

export function CellGrid({
  cells,
  assignments,
  itemsById,
  selectedCellId,
  multiSelect = new Set<string>(),
  onCellClick,
  rowDividersFixed = false,
  columnDividersFixed = false,
}: {
  cells: CellRow[];
  assignments: CellAssignment[];
  itemsById: Map<string, ItemRef>;
  selectedCellId: string | null;
  multiSelect?: Set<string>;
  onCellClick: (id: string, additive?: boolean) => void;
  rowDividersFixed?: boolean;
  columnDividersFixed?: boolean;
}): React.ReactElement {
  const assignByLoc = new Map<string, CellAssignment[]>();
  for (const a of assignments) {
    const list = assignByLoc.get(a.locationId) ?? [];
    list.push(a);
    assignByLoc.set(a.locationId, list);
  }

  const childrenByParent = new Map<string, CellRow[]>();
  for (const c of cells) {
    if (c.parentId) {
      const list = childrenByParent.get(c.parentId) ?? [];
      list.push(c);
      childrenByParent.set(c.parentId, list);
    }
  }

  const gridCells = cells.filter(
    (c) => c.gridRow != null && c.gridColumn != null
  );
  if (gridCells.length === 0) {
    return (
      <div className="flex flex-wrap gap-1 max-w-lg">
        {cells.map((c) => {
          const isSel = c.id === selectedCellId;
          return (
            <button
              key={c.id}
              onClick={() => onCellClick(c.id)}
              className={`px-3 py-2 rounded border text-sm transition-colors ${
                isSel
                  ? "border-accent bg-accent/10 text-slate-100"
                  : "border-slate-700 bg-slate-800/40 text-slate-300 hover:border-slate-600"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    );
  }

  const maxRow = Math.max(...gridCells.map((c) => c.gridRow!));
  const maxCol = Math.max(...gridCells.map((c) => c.gridColumn!));
  const rows = maxRow + 1;
  const cols = maxCol + 1;

  function rowLabelFor(r: number) {
    const any = gridCells.find((c) => c.gridRow === r);
    return any?.label.charAt(0) ?? String.fromCharCode(65 + r);
  }
  function colLabelFor(c: number) {
    const any = gridCells.find((c2) => c2.gridColumn === c);
    if (any) {
      const stripped = any.label.slice(1);
      if (stripped) return stripped;
    }
    return String(c + 1);
  }

  return (
    <div
      className="h-full max-h-full max-w-full grid gap-1"
      style={{
        gridTemplateColumns: `auto repeat(${cols}, 1fr)`,
        gridTemplateRows: `auto repeat(${rows}, 1fr)`,
        aspectRatio: `${cols + 0.6} / ${rows + 0.35}`,
      }}
    >
      <div style={{ gridRow: 1, gridColumn: 1 }} aria-hidden />
      {Array.from({ length: cols }, (_, c) => (
        <div
          key={`c-${c}`}
          style={{ gridRow: 1, gridColumn: c + 2 }}
          className="text-center text-[11px] text-slate-500 pb-1 self-end"
        >
          {colLabelFor(c)}
        </div>
      ))}
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={`r-${r}`}
          style={{ gridRow: r + 2, gridColumn: 1 }}
          className="text-right text-[11px] text-slate-500 pr-2 self-center"
        >
          {rowLabelFor(r)}
        </div>
      ))}

      {rowDividersFixed &&
        Array.from({ length: rows - 1 }, (_, r) => (
          <div
            key={`rdiv-${r}`}
            aria-hidden
            style={{
              gridRow: r + 2,
              gridColumn: `2 / span ${cols}`,
              alignSelf: "end",
              height: "3px",
              marginBottom: "-3.5px",
              zIndex: 2,
            }}
            className="bg-slate-400/80 pointer-events-none rounded-sm"
            title="Fixed row divider (template-defined)"
          />
        ))}
      {columnDividersFixed &&
        Array.from({ length: cols - 1 }, (_, c) => (
          <div
            key={`cdiv-${c}`}
            aria-hidden
            style={{
              gridRow: `2 / span ${rows}`,
              gridColumn: c + 2,
              justifySelf: "end",
              width: "3px",
              marginRight: "-3.5px",
              zIndex: 2,
            }}
            className="bg-slate-400/80 pointer-events-none rounded-sm"
            title="Fixed column divider (template-defined)"
          />
        ))}

      {gridCells.map((cell) => {
        if (cell.mergedIntoId) return null;

        const aliasChildren = gridCells.filter(
          (c) => c.mergedIntoId === cell.id
        );
        const mergedGroup = [cell, ...aliasChildren];
        const minR = Math.min(...mergedGroup.map((c) => c.gridRow!));
        const maxR = Math.max(...mergedGroup.map((c) => c.gridRow!));
        const minC = Math.min(...mergedGroup.map((c) => c.gridColumn!));
        const maxC = Math.max(...mergedGroup.map((c) => c.gridColumn!));
        const rowSpan = maxR - minR + 1;
        const colSpan = maxC - minC + 1;
        const isMerged = aliasChildren.length > 0;

        const cellAssignments = assignByLoc.get(cell.id) ?? [];
        const occupied = cellAssignments.length > 0;
        const isSelected = cell.id === selectedCellId;
        const isMulti = multiSelect.has(cell.id);
        const isProvisional =
          occupied && cellAssignments[0].assignmentType === "provisional";
        const isRestricted =
          cell.maxWidthMm || cell.maxHeightMm || cell.maxDepthMm;

        const divChildren = childrenByParent.get(cell.id) ?? [];
        const isDivided = divChildren.length > 0;

        const itemName = occupied
          ? itemsById.get(cellAssignments[0].itemId)?.name
          : null;
        const displayLabel = isMerged
          ? cell.label + "+" + aliasChildren.map((a) => a.label).join("+")
          : cell.label;

        const borderClass = isSelected
          ? "border-accent border-2"
          : isMulti
            ? "border-accent border-2 border-dashed"
            : cell.isDisabled
              ? "border-red-900/60"
              : occupied
                ? isProvisional
                  ? "border-amber-800"
                  : "border-blue-800"
                : "border-slate-700 hover:border-slate-600";
        const bgClass = cell.isDisabled
          ? "bg-red-900/10"
          : isSelected
            ? "bg-accent/10"
            : isMulti
              ? "bg-accent/5"
              : occupied
                ? isProvisional
                  ? "bg-amber-900/15"
                  : "bg-blue-900/15"
                : isMerged
                  ? "bg-blue-950/20"
                  : "bg-slate-800/30";
        const cellClasses = [
          "relative rounded border overflow-hidden transition-colors",
          borderClass,
          bgClass,
          isDivided ? "" : "cursor-pointer",
        ]
          .filter(Boolean)
          .join(" ");

        const cellStyle: React.CSSProperties = {
          gridRow: `${minR + 2} / span ${rowSpan}`,
          gridColumn: `${minC + 2} / span ${colSpan}`,
          minWidth: 0,
          minHeight: 0,
        };

        return (
          <div
            key={cell.id}
            style={cellStyle}
            className={cellClasses}
            onClick={
              isDivided
                ? undefined
                : (e) => onCellClick(cell.id, e.ctrlKey || e.metaKey)
            }
          >
            {cell.isDisabled && !isDivided && (
              <>
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(45deg, transparent 0 7px, rgba(248,113,113,0.16) 7px 8px)",
                  }}
                />
                {cell.disableReason && (
                  <div
                    className="absolute inset-x-1 bottom-1 text-[9px] leading-tight text-red-200/90 italic text-center break-words pointer-events-none z-10"
                    title={cell.disableReason}
                  >
                    {cell.disableReason}
                  </div>
                )}
              </>
            )}

            {occupied && !isDivided && (
              <span
                className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${
                  isProvisional ? "bg-amber-400" : "bg-blue-400"
                }`}
              />
            )}
            {isRestricted && !cell.isDisabled && !isDivided && (
              <span className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
            )}

            {isDivided ? (
              <div
                className={`absolute inset-0 flex ${
                  inferDivideOrientation(divChildren) === "vertical"
                    ? "flex-col"
                    : ""
                }`}
              >
                {divChildren.map((child, i) => {
                  const orientation = inferDivideOrientation(divChildren);
                  const childAssigns = assignByLoc.get(child.id) ?? [];
                  const childOccupied = childAssigns.length > 0;
                  const childItem = childOccupied
                    ? itemsById.get(childAssigns[0].itemId)?.name
                    : null;
                  const childSelected = child.id === selectedCellId;
                  const childMulti = multiSelect.has(child.id);
                  const isLast = i === divChildren.length - 1;
                  const sepClass = isLast
                    ? ""
                    : orientation === "vertical"
                      ? "border-b border-slate-700"
                      : "border-r border-slate-700";
                  const subClasses = [
                    "flex-1 flex flex-col items-center justify-center gap-0.5 px-1 py-1 cursor-pointer transition-colors min-w-0 min-h-0",
                    sepClass,
                    child.isDisabled
                      ? "bg-red-900/15 text-red-300"
                      : childSelected
                        ? "bg-accent/20"
                        : childMulti
                          ? "bg-accent/10"
                          : childOccupied
                            ? "bg-blue-900/20"
                            : "hover:bg-slate-700/30",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <div
                      key={child.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCellClick(child.id, e.ctrlKey || e.metaKey);
                      }}
                      className={`${subClasses} relative`}
                    >
                      {child.isDisabled && (
                        <>
                          <div
                            aria-hidden
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              backgroundImage:
                                "repeating-linear-gradient(45deg, transparent 0 6px, rgba(248,113,113,0.16) 6px 7px)",
                            }}
                          />
                          {child.disableReason && (
                            <div
                              className="absolute inset-x-0.5 bottom-0.5 text-[8px] leading-tight text-red-200/90 italic text-center break-words pointer-events-none z-10"
                              title={child.disableReason}
                            >
                              {child.disableReason}
                            </div>
                          )}
                        </>
                      )}
                      <div
                        className={`relative z-0 text-[10px] font-medium leading-tight text-center break-words ${
                          childSelected
                            ? "text-accent"
                            : child.isDisabled
                              ? "text-red-300"
                              : "text-slate-300"
                        }`}
                      >
                        {child.label}
                      </div>
                      {childItem && (
                        <div className="relative z-0 text-[9px] text-blue-300 leading-tight text-center break-words overflow-hidden">
                          {childItem}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-1 py-1 min-w-0">
                <div
                  className={`text-[11px] font-medium leading-tight text-center break-words ${
                    cell.isDisabled
                      ? "text-red-300"
                      : isSelected
                        ? "text-slate-100"
                        : "text-slate-400"
                  }`}
                >
                  {displayLabel}
                </div>
                {itemName && (
                  <div
                    className={`text-[10px] leading-tight text-center break-words ${
                      isProvisional ? "text-amber-300" : "text-blue-300"
                    }`}
                  >
                    {itemName}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
