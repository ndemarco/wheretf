import { NextRequest, NextResponse } from "next/server";
import { moduleRepository } from "@/repositories/moduleRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET() {
  try {
    const ctx = await requireContext();
    const modules = await moduleRepository.list({ orgId: ctx.activeOrgId });
    return NextResponse.json({ modules });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireContext();
    const body = await request.json();
    const { name, description, primaryDimensionLabel, primaryDimensionCount, metadata } = body;

    if (!name || !primaryDimensionLabel || primaryDimensionCount == null) {
      return NextResponse.json(
        { error: "name, primaryDimensionLabel, and primaryDimensionCount are required" },
        { status: 400 }
      );
    }

    const mod = await moduleRepository.create({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      name,
      description,
      primaryDimensionLabel,
      primaryDimensionCount,
      metadata,
    });

    return NextResponse.json({ module: mod }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
