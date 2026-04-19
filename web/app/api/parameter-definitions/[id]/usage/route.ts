import { NextRequest, NextResponse } from "next/server";
import { parameterDefinitionRepository } from "@/repositories/parameterDefinitionRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const usage = await parameterDefinitionRepository.getUsage({
      orgId: ctx.activeOrgId,
      parameterDefinitionId: id,
    });
    return NextResponse.json(usage);
  } catch (err) {
    return errorResponse(err);
  }
}
