/**
 * Compute the display label for a grid cell given the template's
 * labeling scheme and origin. Shared by the template editor, the
 * place-insert flow, the insert repository (for cell materialization),
 * and anywhere else a grid is rendered.
 *
 * scheme: "alpha" | "numeric"
 * origin: "top-left" | "top-right" | "bottom-left" | "bottom-right"
 * axis:   "row" | "col" — the axis being labeled
 */
export function getGridLabel(
  scheme: string,
  index: number,
  count: number,
  origin: string,
  axis: "row" | "col"
): string {
  const reversed =
    (axis === "row" && origin.startsWith("bottom")) ||
    (axis === "col" && origin.endsWith("right"));
  const i = reversed ? count - 1 - index : index;
  return scheme === "alpha" ? String.fromCharCode(65 + i) : String(i + 1);
}
