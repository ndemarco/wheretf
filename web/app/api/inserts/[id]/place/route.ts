import { NextRequest, NextResponse } from "next/server";
import { insertRepository } from "@/repositories/insertRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const body = await request.json();
    const insert = await insertRepository.place({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      id,
      locationId: body.locationId,
    });
    return NextResponse.json({ insert });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const insert = await insertRepository.removeFromLocation({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      id,
    });
    return NextResponse.json({ insert });
  } catch (err) {
    return errorResponse(err);
  }
}
