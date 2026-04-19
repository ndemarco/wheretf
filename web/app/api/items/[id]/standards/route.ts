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
    const standards = await standardRepository.getItemStandards({
      orgId: ctx.activeOrgId,
      itemId: id,
    });
    return NextResponse.json({ standards });
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
    const { standardId, designationId } = body;

    if (!standardId) {
      return NextResponse.json(
        { error: "standardId is required" },
        { status: 400 }
      );
    }

    const itemStandard = await standardRepository.applyToItem({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      itemId: id,
      standardId,
      designationId,
    });

    return NextResponse.json({ itemStandard }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const body = await request.json();
    const { standardId, designationId } = body;

    if (!standardId) {
      return NextResponse.json(
        { error: "standardId is required" },
        { status: 400 }
      );
    }

    const updated = await standardRepository.setDesignation({
      orgId: ctx.activeOrgId,
      itemId: id,
      standardId,
      designationId,
    });

    return NextResponse.json({ itemStandard: updated });
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
    const standardId = searchParams.get("standardId");

    if (!standardId) {
      return NextResponse.json(
        { error: "standardId query param is required" },
        { status: 400 }
      );
    }

    await standardRepository.removeFromItem({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      itemId: id,
      standardId,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
