import { NextRequest, NextResponse } from "next/server";
import { interfaceTypeRepository } from "@/repositories/interfaceTypeRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const interfaceType = await interfaceTypeRepository.findById({
      orgId: ctx.activeOrgId,
      id,
    });
    if (!interfaceType) {
      return NextResponse.json(
        { error: "Interface type not found" },
        { status: 404 },
      );
    }
    const usage = await interfaceTypeRepository.usageCount({
      orgId: ctx.activeOrgId,
      id,
    });
    return NextResponse.json({ interfaceType, usage });
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
    const interfaceType = await interfaceTypeRepository.update({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      id,
      ...body,
    });
    return NextResponse.json({ interfaceType });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    if (message.includes("terminal") || message.includes("one-way")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
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
    await interfaceTypeRepository.remove({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      id,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    if (message.includes("not archived") || message.includes("in use")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return errorResponse(err);
  }
}
