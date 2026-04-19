import { NextRequest, NextResponse } from "next/server";
import { insertRepository } from "@/repositories/insertRepository";
import { locationRepository } from "@/repositories/locationRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";
import { db } from "@/db/connection";
import { locations } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { isolatedOrgFilter } from "@/lib/auth/scope";

/**
 * Compound operation retained for API compatibility:
 * create insert + place it. Cell materialization now happens inside
 * insertRepository.create(); place() re-parents cells to the receptacle.
 * Body: { templateId, templateVersionId, locationId, name?, rows?, columns? }
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireContext();
    const body = await request.json();
    const { templateId, templateVersionId, locationId, name, rows, columns } =
      body;

    if (!templateId || !templateVersionId || !locationId) {
      return NextResponse.json(
        { error: "templateId, templateVersionId, and locationId are required" },
        { status: 400 }
      );
    }

    const parent = await locationRepository.findById({
      orgId: ctx.activeOrgId,
      id: locationId,
    });
    if (!parent) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    const insert = await insertRepository.create({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      name,
      templateId,
      templateVersionId,
      rows,
      columns,
    });

    await insertRepository.place({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      id: insert.id,
      locationId,
    });

    const cells = await db
      .select()
      .from(locations)
      .where(
        and(
          isolatedOrgFilter(locations.ownerOrgId, ctx.activeOrgId),
          eq(locations.insertId, insert.id),
        ),
      );

    return NextResponse.json(
      { insert, locations: cells },
      { status: 201 }
    );
  } catch (err) {
    return errorResponse(err);
  }
}
