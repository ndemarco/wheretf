import { NextRequest, NextResponse } from "next/server";
import { interfaceTypeRepository } from "@/repositories/interfaceTypeRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const interfaceType = await interfaceTypeRepository.unarchive({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      id,
    });
    return NextResponse.json({ interfaceType });
  } catch (err) {
    return errorResponse(err);
  }
}
