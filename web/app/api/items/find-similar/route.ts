import { NextRequest, NextResponse } from "next/server";
import { itemRepository } from "@/repositories/itemRepository";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const standardId = searchParams.get("standardId");
    const designationId = searchParams.get("designationId");
    if (!standardId || !designationId) {
      return NextResponse.json(
        { error: "standardId and designationId are required" },
        { status: 400 }
      );
    }
    const candidates = await itemRepository.findSimilar({
      standardId,
      designationId,
    });
    return NextResponse.json({ candidates });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
