import { NextRequest, NextResponse } from "next/server";
import { assignmentRepository } from "@/repositories/assignmentRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const assignment = await assignmentRepository.findById({
      orgId: ctx.activeOrgId,
      id,
    });
    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ assignment });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    await assignmentRepository.remove({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      id,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
