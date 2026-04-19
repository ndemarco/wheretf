import { NextRequest, NextResponse } from "next/server";
import { assignmentRepository } from "@/repositories/assignmentRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireContext();
    const itemId = request.nextUrl.searchParams.get("itemId");
    const locationId = request.nextUrl.searchParams.get("locationId");
    const provisional = request.nextUrl.searchParams.get("provisional");

    if (itemId) {
      const assignments = await assignmentRepository.findByItemId({
        orgId: ctx.activeOrgId,
        itemId,
      });
      return NextResponse.json({ assignments });
    }
    if (locationId) {
      const assignments = await assignmentRepository.findByLocationId({
        orgId: ctx.activeOrgId,
        locationId,
      });
      return NextResponse.json({ assignments });
    }
    if (provisional === "true") {
      const assignments = await assignmentRepository.listProvisional({
        orgId: ctx.activeOrgId,
      });
      return NextResponse.json({ assignments });
    }

    return NextResponse.json(
      {
        error:
          "A filter is required: itemId, locationId, or provisional=true",
      },
      { status: 400 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireContext();
    const body = await request.json();
    const assignment = await assignmentRepository.create({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      itemId: body.itemId,
      locationId: body.locationId,
      assignmentType: body.assignmentType,
      metadata: body.metadata,
    });
    return NextResponse.json({ assignment }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    if (message.includes("not co-storable")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return errorResponse(err);
  }
}
