import { NextRequest, NextResponse } from "next/server";
import { moduleRepository } from "@/repositories/moduleRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const stats = await moduleRepository.getStats({
      orgId: ctx.activeOrgId,
      id,
    });
    return NextResponse.json({ stats });
  } catch (err) {
    return errorResponse(err);
  }
}
