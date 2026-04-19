import { NextRequest, NextResponse } from "next/server";
import { assignmentRepository } from "@/repositories/assignmentRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const body = await request.json();
    const assignment = await assignmentRepository.convertToPlaced({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      id,
      locationId: body.locationId,
    });
    return NextResponse.json({ assignment });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    if (message.includes("not co-storable")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return errorResponse(err);
  }
}
