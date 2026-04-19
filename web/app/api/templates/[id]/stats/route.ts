import { NextRequest, NextResponse } from "next/server";
import { templateRepository } from "@/repositories/templateRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const template = await templateRepository.findById({
      orgId: ctx.activeOrgId,
      id,
    });
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    const refs = await templateRepository.getReferenceCount({
      orgId: ctx.activeOrgId,
      id,
    });
    return NextResponse.json({
      stats: {
        ...refs,
        isHidden: template.isHidden,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
