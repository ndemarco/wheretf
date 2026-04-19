import { NextRequest, NextResponse } from "next/server";
import { aspectRepository } from "@/repositories/aspectRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limitStr = searchParams.get("limit");
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    const items = await aspectRepository.listItemsUsing({
      orgId: ctx.activeOrgId,
      aspectId: id,
      limit: Number.isFinite(limit) && limit > 0 ? limit : 50,
    });
    return NextResponse.json({ items });
  } catch (err) {
    return errorResponse(err);
  }
}
