import { NextRequest, NextResponse } from "next/server";
import { aspectRepository } from "@/repositories/aspectRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const aspect = await aspectRepository.findById({
      orgId: ctx.activeOrgId,
      id,
    });
    if (!aspect) {
      return NextResponse.json({ error: "Aspect not found" }, { status: 404 });
    }
    const [usage, parameters] = await Promise.all([
      aspectRepository.getUsage({ orgId: ctx.activeOrgId, aspectId: id }),
      aspectRepository.getParameters({ orgId: ctx.activeOrgId, aspectId: id }),
    ]);
    return NextResponse.json({
      aspect,
      parameters,
      itemCount: usage.itemCount,
      parameterCount: usage.parameterCount,
      standardCount: usage.standardCount,
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
    const aspect = await aspectRepository.update({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      id,
      ...body,
    });
    return NextResponse.json({ aspect });
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
    await aspectRepository.remove({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      id,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
