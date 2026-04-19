import { NextRequest, NextResponse } from "next/server";
import { insertRepository } from "@/repositories/insertRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireContext();
    const params = request.nextUrl.searchParams;

    // Legacy: ?unplaced=true returns raw list without joins.
    if (params.get("unplaced") === "true") {
      const inserts = await insertRepository.listUnplaced({
        orgId: ctx.activeOrgId,
      });
      return NextResponse.json({ inserts });
    }

    const placementParam = params.get("placement");
    const placement: "placed" | "unplaced" | "all" =
      placementParam === "placed" || placementParam === "unplaced"
        ? placementParam
        : "all";

    const inserts = await insertRepository.listWithDetails({
      orgId: ctx.activeOrgId,
      templateId: params.get("templateId") ?? undefined,
      interfaceTypeId: params.get("interfaceTypeId") ?? undefined,
      moduleId: params.get("moduleId") ?? undefined,
      placement,
    });
    return NextResponse.json({ inserts });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireContext();
    const body = await request.json();
    const insert = await insertRepository.create({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      ...body,
    });
    return NextResponse.json({ insert }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
