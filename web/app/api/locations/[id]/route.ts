import { NextRequest, NextResponse } from "next/server";
import { locationRepository } from "@/repositories/locationRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const location = await locationRepository.findById({
      orgId: ctx.activeOrgId,
      id,
    });
    if (!location) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 },
      );
    }
    const interfacesAccepted = await locationRepository.getAcceptedInterfaces({
      orgId: ctx.activeOrgId,
      locationId: id,
    });
    return NextResponse.json({
      location: { ...location, interfacesAccepted },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const body = await request.json();
    const { interfacesAcceptedIds, ...rest } = body ?? {};
    const hasCoreUpdates = Object.keys(rest).length > 0;
    const location = hasCoreUpdates
      ? await locationRepository.update({
          userId: ctx.userId,
          orgId: ctx.activeOrgId,
          id,
          ...rest,
        })
      : await locationRepository.findById({ orgId: ctx.activeOrgId, id });
    if (!location) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 },
      );
    }
    if (Array.isArray(interfacesAcceptedIds)) {
      await locationRepository.setAcceptedInterfaces({
        userId: ctx.userId,
        orgId: ctx.activeOrgId,
        locationId: id,
        interfaceTypeIds: interfacesAcceptedIds,
      });
    }
    const interfacesAccepted = await locationRepository.getAcceptedInterfaces({
      orgId: ctx.activeOrgId,
      locationId: id,
    });
    return NextResponse.json({
      location: { ...location, interfacesAccepted },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    await locationRepository.remove({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      id,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
