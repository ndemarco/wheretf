import { NextRequest, NextResponse } from "next/server";
import { templateRepository } from "@/repositories/templateRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const template = await templateRepository.hide({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      id,
    });
    return NextResponse.json({ template });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const template = await templateRepository.unhide({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      id,
    });
    return NextResponse.json({ template });
  } catch (err) {
    return errorResponse(err);
  }
}
