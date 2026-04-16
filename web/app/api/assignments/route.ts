import { NextRequest, NextResponse } from "next/server";
import { assignmentRepository } from "@/repositories/assignmentRepository";

export async function GET(request: NextRequest) {
  try {
    const itemId = request.nextUrl.searchParams.get("itemId");
    const locationId = request.nextUrl.searchParams.get("locationId");
    const provisional = request.nextUrl.searchParams.get("provisional");

    if (itemId) {
      const assignments = await assignmentRepository.findByItemId({ itemId });
      return NextResponse.json({ assignments });
    }
    if (locationId) {
      const assignments = await assignmentRepository.findByLocationId({
        locationId,
      });
      return NextResponse.json({ assignments });
    }
    if (provisional === "true") {
      const assignments = await assignmentRepository.listProvisional();
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const assignment = await assignmentRepository.create(body);
    return NextResponse.json({ assignment }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    if (message.includes("not co-storable")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
