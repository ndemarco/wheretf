import { NextRequest, NextResponse } from "next/server";
import { locationRepository } from "@/repositories/locationRepository";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { maxWidthMm, maxHeightMm, maxDepthMm, reason } = body ?? {};
    const location = await locationRepository.restrict({
      id,
      maxWidthMm: normalizeNum(maxWidthMm),
      maxHeightMm: normalizeNum(maxHeightMm),
      maxDepthMm: normalizeNum(maxDepthMm),
      reason: typeof reason === "string" ? reason : null,
    });
    return NextResponse.json({ location });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const location = await locationRepository.clearRestrict({ id });
    return NextResponse.json({ location });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function normalizeNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}
