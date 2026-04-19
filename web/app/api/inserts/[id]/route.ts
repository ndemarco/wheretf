import { NextRequest, NextResponse } from "next/server";
import { insertRepository } from "@/repositories/insertRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const insert = await insertRepository.findById({
      orgId: ctx.activeOrgId,
      id,
    });
    if (!insert) {
      return NextResponse.json(
        { error: "Insert not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ insert });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const body = await request.json();
    const insert = await insertRepository.update({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      id,
      ...body,
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
    await insertRepository.remove({
      userId: ctx.userId,
      orgId: ctx.activeOrgId,
      id,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
