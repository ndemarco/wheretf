import { NextRequest, NextResponse } from "next/server";
import { interfaceTypeRepository } from "@/repositories/interfaceTypeRepository";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceIds, targetId } = body ?? {};
    if (!Array.isArray(sourceIds) || typeof targetId !== "string") {
      return NextResponse.json(
        { error: "Body must be { sourceIds: string[], targetId: string }" },
        { status: 400 },
      );
    }
    const result = await interfaceTypeRepository.merge({
      sourceIds,
      targetId,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    if (/target.*not found|source not found/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (/target.*source|at least one sourceId/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
