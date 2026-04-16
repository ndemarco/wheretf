import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  CellGrid,
  type CellRow,
  type CellAssignment,
  type ItemRef,
} from "@/app/_components/CellGrid";

function makeCell(overrides: Partial<CellRow> = {}): CellRow {
  return {
    id: "c",
    label: "A1",
    path: "A1",
    parentId: null,
    locationType: "cell",
    gridRow: 0,
    gridColumn: 0,
    isDisabled: false,
    disableReason: null,
    maxWidthMm: null,
    maxHeightMm: null,
    maxDepthMm: null,
    restrictReason: null,
    mergedIntoId: null,
    subdivisionSource: null,
    ...overrides,
  };
}

function gridOf(n: number): CellRow[] {
  const cells: CellRow[] = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < n; c++) {
      cells.push(
        makeCell({
          id: `r${r}c${c}`,
          label: `${String.fromCharCode(65 + r)}${c + 1}`,
          path: `${String.fromCharCode(65 + r)}${c + 1}`,
          gridRow: r,
          gridColumn: c,
        })
      );
    }
  }
  return cells;
}

const emptyItems: Map<string, ItemRef> = new Map();

describe("CellGrid", () => {
  it("renders every cell label in a grid layout", () => {
    const cells = gridOf(3);
    render(
      <CellGrid
        cells={cells}
        assignments={[]}
        itemsById={emptyItems}
        selectedCellId={null}
        onCellClick={() => {}}
      />
    );
    for (const c of cells) {
      expect(screen.getByText(c.label)).toBeInTheDocument();
    }
  });

  it("dispatches onCellClick with the clicked cell id", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const cells = gridOf(2);
    render(
      <CellGrid
        cells={cells}
        assignments={[]}
        itemsById={emptyItems}
        selectedCellId={null}
        onCellClick={onClick}
      />
    );
    await user.click(screen.getByText("B2"));
    expect(onClick).toHaveBeenCalledWith("r1c1", false);
  });

  it("passes additive=true when ctrl/meta held", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const cells = gridOf(2);
    render(
      <CellGrid
        cells={cells}
        assignments={[]}
        itemsById={emptyItems}
        selectedCellId={null}
        onCellClick={onClick}
      />
    );
    await user.keyboard("{Control>}");
    await user.click(screen.getByText("A1"));
    await user.keyboard("{/Control}");
    expect(onClick).toHaveBeenCalledWith("r0c0", true);
  });

  it("suppresses the parent click when a divided child is clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const parent = makeCell({ id: "p", label: "A1", gridRow: 0, gridColumn: 0 });
    const left = makeCell({
      id: "l",
      label: "left",
      gridRow: null,
      gridColumn: null,
      parentId: "p",
    });
    const right = makeCell({
      id: "r",
      label: "right",
      gridRow: null,
      gridColumn: null,
      parentId: "p",
    });
    render(
      <CellGrid
        cells={[parent, left, right]}
        assignments={[]}
        itemsById={emptyItems}
        selectedCellId={null}
        onCellClick={onClick}
      />
    );
    await user.click(screen.getByText("left"));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith("l", false);
  });

  it("lays divided children vertically when labels are front/rear", () => {
    const parent = makeCell({ id: "p", label: "A1", gridRow: 0, gridColumn: 0 });
    const front = makeCell({
      id: "f",
      label: "front",
      gridRow: null,
      gridColumn: null,
      parentId: "p",
    });
    const rear = makeCell({
      id: "r",
      label: "rear",
      gridRow: null,
      gridColumn: null,
      parentId: "p",
    });
    const { container } = render(
      <CellGrid
        cells={[parent, front, rear]}
        assignments={[]}
        itemsById={emptyItems}
        selectedCellId={null}
        onCellClick={() => {}}
      />
    );
    const wrapper = container.querySelector(".flex.flex-col");
    expect(wrapper).toBeTruthy();
  });

  it("lays divided children horizontally when labels are left/right", () => {
    const parent = makeCell({ id: "p", label: "A1", gridRow: 0, gridColumn: 0 });
    const left = makeCell({
      id: "l",
      label: "left",
      gridRow: null,
      gridColumn: null,
      parentId: "p",
    });
    const right = makeCell({
      id: "r",
      label: "right",
      gridRow: null,
      gridColumn: null,
      parentId: "p",
    });
    const { container } = render(
      <CellGrid
        cells={[parent, left, right]}
        assignments={[]}
        itemsById={emptyItems}
        selectedCellId={null}
        onCellClick={() => {}}
      />
    );
    // Should have flex without flex-col on the divider wrapper
    const rowWrappers = container.querySelectorAll(
      ".absolute.inset-0.flex:not(.flex-col)"
    );
    expect(rowWrappers.length).toBeGreaterThan(0);
  });

  it("renders item name for assigned cells", () => {
    const cells = gridOf(1);
    const assignments: CellAssignment[] = [
      {
        id: "a",
        itemId: "item-1",
        locationId: "r0c0",
        assignmentType: "placed",
      },
    ];
    const items = new Map<string, ItemRef>([
      ["item-1", { id: "item-1", name: "M3 screw", description: null }],
    ]);
    render(
      <CellGrid
        cells={cells}
        assignments={assignments}
        itemsById={items}
        selectedCellId={null}
        onCellClick={() => {}}
      />
    );
    expect(screen.getByText("M3 screw")).toBeInTheDocument();
  });

});
