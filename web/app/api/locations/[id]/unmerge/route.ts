import { NextRequest, NextResponse } from "next/server";
import { locationRepository } from "@/repositories/locationRepository";
import { requireContext } from "@/lib/auth/route";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const result = await locationRepository.unmerge({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      originId: id,
    });
    return NextResponse.json({ unmerge: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    if (message.includes("No merged")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
