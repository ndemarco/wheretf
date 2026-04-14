import { NextRequest, NextResponse } from "next/server";
import { insertRepository } from "@/repositories/insertRepository";
import { locationRepository } from "@/repositories/locationRepository";
import { db } from "@/db/connection";
import { locations } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Compound operation retained for API compatibility:
 * create insert + place it. Cell materialization now happens inside
 * insertRepository.create(); place() re-parents cells to the receptacle.
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

    const parent = await locationRepository.findById({ id: locationId });
    if (!parent) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    const insert = await insertRepository.create({
      name,
      templateId,
      templateVersionId,
      rows,
      columns,
    });

    await insertRepository.place({ id: insert.id, locationId });

    const cells = await db
      .select()
      .from(locations)
      .where(eq(locations.insertId, insert.id));

    return NextResponse.json(
      { insert, locations: cells },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
