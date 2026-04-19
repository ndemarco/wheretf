import { NextRequest, NextResponse } from "next/server";
import { categoryRepository } from "@/repositories/categoryRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET() {
  try {
    const ctx = await requireContext();
    const categories = await categoryRepository.listWithUsage({
      orgId: ctx.activeOrgId,
    });
    return NextResponse.json({ categories });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireContext();
    const body = await request.json();
    const { asGlobal, ...rest } = body;
    const category = await categoryRepository.create({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      asGlobal: Boolean(asGlobal),
      ...rest,
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
