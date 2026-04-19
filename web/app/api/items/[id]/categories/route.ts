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
    const categories = await itemRepository.getCategories({
      orgId: ctx.activeOrgId,
      itemId: id,
    });
    return NextResponse.json({ categories });
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
    const body = await request.json();
    const itemCategory = await itemRepository.addCategory({
      orgId: ctx.activeOrgId,
      itemId: id,
      categoryId: body.categoryId,
      isPrimary: body.isPrimary,
    });
    return NextResponse.json({ itemCategory }, { status: 201 });
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
    const { categoryId } = await request.json();
    await itemRepository.removeCategory({
      orgId: ctx.activeOrgId,
      itemId: id,
      categoryId,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
