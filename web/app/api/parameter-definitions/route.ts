import { NextRequest, NextResponse } from "next/server";
import { parameterDefinitionRepository } from "@/repositories/parameterDefinitionRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET() {
  try {
    const ctx = await requireContext();
    const parameterDefinitions =
      await parameterDefinitionRepository.listWithUsage({
        orgId: ctx.activeOrgId,
      });
    return NextResponse.json({ parameterDefinitions });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireContext();
    const body = await request.json();
    const { asGlobal, ...rest } = body;
    const parameterDefinition = await parameterDefinitionRepository.create({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      asGlobal: Boolean(asGlobal),
      ...rest,
    });
    return NextResponse.json({ parameterDefinition }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
