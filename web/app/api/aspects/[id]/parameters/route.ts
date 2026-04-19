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
    const parameters = await aspectRepository.getParameters({
      orgId: ctx.activeOrgId,
      aspectId: id,
    });
    return NextResponse.json({ parameters });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const body = await request.json();
    const parameter = await aspectRepository.addParameter({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      aspectId: id,
      ...body,
    });
    return NextResponse.json({ parameter }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const { parameterDefinitionId } = await request.json();
    await aspectRepository.removeParameter({
      orgId: ctx.activeOrgId,
      aspectId: id,
      parameterDefinitionId,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
