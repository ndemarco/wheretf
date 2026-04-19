import { NextRequest, NextResponse } from "next/server";
import { parameterDefinitionRepository } from "@/repositories/parameterDefinitionRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const parameterDefinition = await parameterDefinitionRepository.findById({
      orgId: ctx.activeOrgId,
      id,
    });
    if (!parameterDefinition) {
      return NextResponse.json(
        { error: "Parameter definition not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ parameterDefinition });
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
    const parameterDefinition = await parameterDefinitionRepository.update({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      id,
      ...body,
    });
    return NextResponse.json({ parameterDefinition });
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
    await parameterDefinitionRepository.remove({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      id,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
