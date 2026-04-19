import { NextRequest, NextResponse } from "next/server";
import { insertRepository } from "@/repositories/insertRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const receptacles = await insertRepository.listCompatibleReceptacles({
      orgId: ctx.activeOrgId,
      id,
    });
    return NextResponse.json({ receptacles });
  } catch (err) {
    return errorResponse(err);
  }
}
