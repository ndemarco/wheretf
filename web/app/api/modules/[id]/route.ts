import { NextRequest, NextResponse } from "next/server";
import { moduleRepository } from "@/repositories/moduleRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const mod = await moduleRepository.findById({ orgId: ctx.activeOrgId, id });
    if (!mod) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }
    return NextResponse.json({ module: mod });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const body = await request.json();
    const { name, description, primaryDimensionLabel, primaryDimensionCount, metadata } = body;

    const mod = await moduleRepository.update({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      id,
      name,
      description,
      primaryDimensionLabel,
      primaryDimensionCount,
      metadata,
    });

    return NextResponse.json({ module: mod });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const cascade = request.nextUrl.searchParams.get("cascade") === "true";
    if (cascade) {
      const stats = await moduleRepository.removeWithCascade({
        userId: ctx.userId,
        orgId: ctx.activeOrgId,
        id,
      });
      return NextResponse.json({ success: true, stats });
    }
    await moduleRepository.remove({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      id,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
