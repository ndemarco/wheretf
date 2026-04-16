import { NextRequest, NextResponse } from "next/server";
import { itemRepository } from "@/repositories/itemRepository";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const aspectIds = searchParams.getAll("aspectId");
    const standardIds = searchParams.getAll("standardId");
    const limitStr = searchParams.get("limit");
    const limit = limitStr ? parseInt(limitStr, 10) : 3;

    const suggestions = await itemRepository.suggestCategories({
      aspectIds,
      standardIds,
      limit: Number.isFinite(limit) && limit > 0 ? limit : 3,
    });

    return NextResponse.json({ suggestions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
