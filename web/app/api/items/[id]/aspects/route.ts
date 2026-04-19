import { NextRequest, NextResponse } from "next/server";
import { itemRepository } from "@/repositories/itemRepository";
import { requireContext, errorResponse } from "@/lib/auth/route";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const aspects = await itemRepository.getAspects({
      orgId: ctx.activeOrgId,
      itemId: id,
    });
    return NextResponse.json({ aspects });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const { aspectId } = await request.json();
    const itemAspect = await itemRepository.applyAspect({
      orgId: ctx.activeOrgId,
      itemId: id,
      aspectId,
    });
    return NextResponse.json({ itemAspect }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const { aspectId } = await request.json();
    await itemRepository.removeAspect({
      orgId: ctx.activeOrgId,
      itemId: id,
      aspectId,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
