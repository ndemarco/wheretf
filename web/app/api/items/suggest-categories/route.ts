import { NextRequest, NextResponse } from "next/server";
import { itemRepository } from "@/repositories/itemRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireContext();
    const { searchParams } = new URL(request.url);
    const aspectIds = searchParams.getAll("aspectId");
    const standardIds = searchParams.getAll("standardId");
    const limitStr = searchParams.get("limit");
    const limit = limitStr ? parseInt(limitStr, 10) : 3;

    const suggestions = await itemRepository.suggestCategories({
      orgId: ctx.activeOrgId,
      aspectIds,
      standardIds,
      limit: Number.isFinite(limit) && limit > 0 ? limit : 3,
    });

    return NextResponse.json({ suggestions });
  } catch (err) {
    return errorResponse(err);
  }
}
