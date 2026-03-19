import { NextRequest, NextResponse } from "next/server";
import { insertRepository } from "@/repositories/insertRepository";
import { locationRepository } from "@/repositories/locationRepository";
import { templateRepository } from "@/repositories/templateRepository";

/**
 * Compound operation: create insert, place it at a location, and generate
 * child grid locations from the template version.
 *
 * Body: { templateId, templateVersionId, locationId, name?, rows?, columns? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, templateVersionId, locationId, name, rows, columns } =
      body;

    if (!templateId || !templateVersionId || !locationId) {
      return NextResponse.json(
        { error: "templateId, templateVersionId, and locationId are required" },
        { status: 400 }
      );
    }

    // Get template version for grid dimensions and labeling
    const version = await templateRepository.getVersion({
      templateId,
      version: 0, // we'll look up by ID instead
    });

    // Look up version by templateVersionId directly
    const allVersions = await templateRepository.listVersions({ templateId });
    const templateVersion = allVersions.find(
      (v) => v.id === templateVersionId
    );
    if (!templateVersion) {
      return NextResponse.json(
        { error: "Template version not found" },
        { status: 404 }
      );
    }

    // Get the parent location to build paths
    const parentLocation = await locationRepository.findById({
      id: locationId,
    });
    if (!parentLocation) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    // Use override dimensions for parametric templates
    const gridRows = rows ?? templateVersion.rows ?? 1;
    const gridCols = columns ?? templateVersion.columns ?? 1;

    // Create the insert
    const insert = await insertRepository.create({
      name,
      templateId,
      templateVersionId,
      rows: gridRows,
      columns: gridCols,
    });

    // Place it
    await insertRepository.place({ id: insert.id, locationId });

    // Generate child locations (grid cells)
    const parentSegments = parentLocation.pathSegments as string[];
    const origin = templateVersion.originPosition || "top-left";
    const rowScheme = templateVersion.rowLabelScheme || "alpha";
    const colScheme = templateVersion.columnLabelScheme || "numeric";

    const childLocations = [];
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const rowLabel = getLabel(rowScheme, r, gridRows, origin, "row");
        const colLabel = getLabel(colScheme, c, gridCols, origin, "col");
        const cellLabel = `${rowLabel}${colLabel}`;

        const location = await locationRepository.create({
          moduleId: parentLocation.moduleId,
          parentId: locationId,
          label: cellLabel,
          pathSegments: [...parentSegments, cellLabel],
          locationType: "leaf",
          templateVersionId,
          gridRow: r,
          gridColumn: c,
        });
        childLocations.push(location);
      }
    }

    return NextResponse.json(
      { insert, locations: childLocations },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function getLabel(
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
