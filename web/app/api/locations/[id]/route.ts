import { NextRequest, NextResponse } from "next/server";
import { locationRepository } from "@/repositories/locationRepository";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const location = await locationRepository.findById({ id });
    if (!location) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 },
      );
    }
    const interfacesAccepted = await locationRepository.getAcceptedInterfaces({
      locationId: id,
    });
    return NextResponse.json({
      location: { ...location, interfacesAccepted },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { interfacesAcceptedIds, ...rest } = body ?? {};
    const hasCoreUpdates = Object.keys(rest).length > 0;
    const location = hasCoreUpdates
      ? await locationRepository.update({ id, ...rest })
      : await locationRepository.findById({ id });
    if (!location) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 },
      );
    }
    if (Array.isArray(interfacesAcceptedIds)) {
      await locationRepository.setAcceptedInterfaces({
        locationId: id,
        interfaceTypeIds: interfacesAcceptedIds,
      });
    }
    const interfacesAccepted = await locationRepository.getAcceptedInterfaces({
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
    const { id } = await params;
    await locationRepository.remove({ id });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
