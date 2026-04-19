import { NextRequest, NextResponse } from "next/server";
import { standardRepository } from "@/repositories/standardRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const parameters = await standardRepository.getParameters({
      orgId: ctx.activeOrgId,
      standardId: id,
    });
    return NextResponse.json({ parameters });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const body = await request.json();
    const { parameterDefinitionId, role, sortOrder } = body;

    if (!parameterDefinitionId || !role) {
      return NextResponse.json(
        { error: "parameterDefinitionId and role are required" },
        { status: 400 }
      );
    }

    const parameter = await standardRepository.addParameter({
      orgId: ctx.activeOrgId,
      standardId: id,
      parameterDefinitionId,
      role,
      sortOrder,
    });

    return NextResponse.json({ parameter }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const parameterDefinitionId = searchParams.get("parameterDefinitionId");

    if (!parameterDefinitionId) {
      return NextResponse.json(
        { error: "parameterDefinitionId query param is required" },
        { status: 400 }
      );
    }

    await standardRepository.removeParameter({
      orgId: ctx.activeOrgId,
      standardId: id,
      parameterDefinitionId,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
