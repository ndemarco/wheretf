import { NextRequest, NextResponse } from "next/server";
import { interfaceTypeRepository } from "@/repositories/interfaceTypeRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireContext();
    const body = await request.json();
    const { sourceIds, targetId } = body ?? {};
    if (!Array.isArray(sourceIds) || typeof targetId !== "string") {
      return NextResponse.json(
        { error: "Body must be { sourceIds: string[], targetId: string }" },
        { status: 400 },
      );
    }
    const result = await interfaceTypeRepository.merge({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      sourceIds,
      targetId,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    if (/target.*source|at least one sourceId/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return errorResponse(err);
  }
}
