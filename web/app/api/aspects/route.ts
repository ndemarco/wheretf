import { NextRequest, NextResponse } from "next/server";
import { aspectRepository } from "@/repositories/aspectRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET() {
  try {
    const ctx = await requireContext();
    const aspects = await aspectRepository.listWithUsage({
      orgId: ctx.activeOrgId,
    });
    return NextResponse.json({ aspects });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireContext();
    const body = await request.json();
    const { asGlobal, ...rest } = body;
    const aspect = await aspectRepository.create({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      asGlobal: Boolean(asGlobal),
      ...rest,
    });
    return NextResponse.json({ aspect }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
