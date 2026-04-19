import { NextRequest, NextResponse } from "next/server";
import { itemRepository } from "@/repositories/itemRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireContext();
    const { searchParams } = new URL(request.url);
    const standardId = searchParams.get("standardId");
    const designationId = searchParams.get("designationId");
    if (!standardId || !designationId) {
      return NextResponse.json(
        { error: "standardId and designationId are required" },
        { status: 400 },
      );
    }
    const candidates = await itemRepository.findSimilar({
      orgId: ctx.activeOrgId,
      standardId,
      designationId,
    });
    return NextResponse.json({ candidates });
  } catch (err) {
    return errorResponse(err);
  }
}
