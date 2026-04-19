import { NextRequest, NextResponse } from "next/server";
import { interfaceTypeRepository } from "@/repositories/interfaceTypeRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireContext();
    const status = request.nextUrl.searchParams.get("status");
    const validStatuses = new Set(["active", "archived", "all"]);
    const filterStatus = validStatuses.has(status ?? "")
      ? (status as "active" | "archived" | "all")
      : "all";
    const interfaceTypes = await interfaceTypeRepository.list({
      orgId: ctx.activeOrgId,
      status: filterStatus,
    });
    return NextResponse.json({ interfaceTypes });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireContext();
    const body = await request.json();
    const { asGlobal, ...rest } = body ?? {};
    const interfaceType = await interfaceTypeRepository.create({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      asGlobal: Boolean(asGlobal),
      ...rest,
    });
    return NextResponse.json({ interfaceType }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
