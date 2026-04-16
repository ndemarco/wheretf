import { NextRequest, NextResponse } from "next/server";
import { locationRepository } from "@/repositories/locationRepository";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { originId, aliasIds } = body ?? {};
    if (!originId || !Array.isArray(aliasIds)) {
      return NextResponse.json(
        { error: "originId and aliasIds[] required" },
        { status: 400 }
      );
    }
    const result = await locationRepository.merge({ originId, aliasIds });
    return NextResponse.json({ merge: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (
      message.includes("active assignments") ||
      message.includes("fixed") ||
      message.includes("contiguous") ||
      message.includes("same parent") ||
      message.includes("same insert") ||
      message.includes("already merged") ||
      message.includes("disabled cells")
    ) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
