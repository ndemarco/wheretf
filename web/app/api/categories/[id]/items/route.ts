import { NextRequest, NextResponse } from "next/server";
import { categoryRepository } from "@/repositories/categoryRepository";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limitStr = searchParams.get("limit");
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    const items = await categoryRepository.listItems({
      categoryId: id,
      limit: Number.isFinite(limit) && limit > 0 ? limit : 50,
    });
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
