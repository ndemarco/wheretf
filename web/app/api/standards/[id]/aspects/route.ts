import { NextRequest, NextResponse } from "next/server";
import { standardRepository } from "@/repositories/standardRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireContext();
    const { id: standardId } = await params;
    const body = await request.json();
    const { aspectId } = body;

    if (!aspectId) {
      return NextResponse.json(
        { error: "aspectId is required" },
        { status: 400 }
      );
    }

    const link = await standardRepository.addAspect({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      standardId,
      aspectId,
    });
    return NextResponse.json({ link }, { status: 201 });
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
    const { id: standardId } = await params;
    const { searchParams } = new URL(request.url);
    const aspectId = searchParams.get("aspectId");

    if (!aspectId) {
      return NextResponse.json(
        { error: "aspectId query parameter is required" },
        { status: 400 }
      );
    }

    await standardRepository.removeAspect({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      standardId,
      aspectId,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
