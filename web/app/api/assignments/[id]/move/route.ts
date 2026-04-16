import { NextRequest, NextResponse } from "next/server";
import { assignmentRepository } from "@/repositories/assignmentRepository";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const assignment = await assignmentRepository.move({
      id,
      newLocationId: body.locationId,
    });
    return NextResponse.json({ assignment });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes("not co-storable")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
